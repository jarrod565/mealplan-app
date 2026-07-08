import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useBasket } from '@/contexts/BasketContext'
import { useHidden } from '@/contexts/HiddenContext'
import { buildSpoonacularDietParams, fetchMealBatch } from '@/lib/spoonacular'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// status:
//   'init'  — loading first batch on mount
//   'idle'  — deck has cards
//   'empty' — pool fully exhausted
//   'error' — Spoonacular API failure

export function useMealDiscovery() {
  const { subscription } = useAuth()
  const { addToBasket, removeFromBasket, isInBasket, pendingReturns, clearPendingReturns } =
    useBasket()
  const { hiddenIds, addToHidden } = useHidden()

  const [deck, setDeck] = useState([])
  const [status, setStatus] = useState('init')
  const [errorMessage, setErrorMessage] = useState(null)

  // Refs hold session-only state that shouldn't trigger re-renders
  const fullBatchRef = useRef([])
  const noPileRef = useRef(new Set())
  // CB_03: a depleted batch is reshuffled once — if that reshuffled pool
  // also empties out, the empty state shows (fresh API call only on Reload).
  // Without this, a user who keeps swiping No recycles the same pool forever
  // and the empty state never appears.
  const reshuffledRef = useRef(false)
  // Stable snapshot of dietParams to avoid double-fetching on context updates
  const dietParamsRef = useRef(null)

  const restrictions = subscription?.dietary_restrictions ?? []

  useEffect(() => {
    const params = buildSpoonacularDietParams(restrictions)
    const key = JSON.stringify(params)
    // Only fetch on first load; diet param changes take effect next session per CB_02
    if (dietParamsRef.current !== null) return
    dietParamsRef.current = key

    async function loadBatch(params) {
      setStatus('init')
      try {
        const meals = await fetchMealBatch(params)
        fullBatchRef.current = meals
        noPileRef.current = new Set()
        reshuffledRef.current = false
        const visible = meals.filter((m) => !hiddenIds.has(m.meal_id))
        setDeck(visible)
        setStatus(visible.length === 0 ? 'empty' : 'idle')
      } catch (err) {
        setErrorMessage(err?.message ?? null)
        setStatus('error')
      }
    }

    loadBatch(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.id]) // run once when subscription resolves

  // Return meals removed from basket back to the bottom of the deck
  useEffect(() => {
    if (pendingReturns.length === 0) return
    setDeck((prev) => {
      const existingIds = new Set(prev.map((m) => m.meal_id))
      const toAdd = pendingReturns.filter((m) => !existingIds.has(m.meal_id))
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev
    })
    clearPendingReturns()
  }, [pendingReturns, clearPendingReturns])

  function advanceDeck() {
    setDeck((prev) => {
      const next = prev.slice(1)
      if (next.length > 0) return next

      // Deck depleted — reshuffle No-swiped meals from this session, but only
      // once per batch. A second depletion (of the reshuffled pool) goes
      // straight to empty instead of recycling the same meals forever.
      if (!reshuffledRef.current) {
        const reshuffled = shuffle(
          fullBatchRef.current.filter(
            (m) => noPileRef.current.has(m.meal_id) && !hiddenIds.has(m.meal_id)
          )
        )
        if (reshuffled.length > 0) {
          reshuffledRef.current = true
          noPileRef.current = new Set()
          return reshuffled
        }
      }

      // Both pools empty — trigger reload prompt
      setStatus('empty')
      return []
    })
  }

  function swipeYes(meal) {
    addToBasket(meal).catch((err) => {
      console.error('addToBasket failed:', err)
      toast.error(err?.message ?? 'Could not add to basket. Please try again.')
    })
    advanceDeck()
  }

  function swipeNo(meal) {
    noPileRef.current.add(meal.meal_id)
    advanceDeck()
  }

  async function swipeNever(meal, reason = null) {
    try {
      await addToHidden(meal, reason)
    } catch {
      // best-effort; hidden write failure should not block deck advance
    }
    // CB_05 edge case: silently remove from basket if present
    if (isInBasket(meal.meal_id)) {
      removeFromBasket(meal.meal_id).catch(() => {})
    }
    advanceDeck()
  }

  const reload = useCallback(async () => {
    const params = buildSpoonacularDietParams(restrictions)
    setStatus('init')
    try {
      const meals = await fetchMealBatch(params)
      fullBatchRef.current = meals
      noPileRef.current = new Set()
      reshuffledRef.current = false
      const visible = meals.filter((m) => !hiddenIds.has(m.meal_id))
      setDeck(visible)
      setStatus(visible.length === 0 ? 'empty' : 'idle')
    } catch (err) {
      setErrorMessage(err?.message ?? null)
      setStatus('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(restrictions), hiddenIds])

  return {
    deck,
    topMeal: deck[0] ?? null,
    status,
    errorMessage,
    swipeYes,
    swipeNo,
    swipeNever,
    reload,
  }
}
