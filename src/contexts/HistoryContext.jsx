import { createContext, useContext, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const HistoryContext = createContext(null)

const GUEST_KEY = 'guest_history'
const PAGE_SIZE = 20

function loadGuestHistory() {
  try {
    const stored = localStorage.getItem(GUEST_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveGuestHistory(records) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(records))
}

// Meal identity for dedup purposes: meal_id is stable for Spoonacular/Pinterest
// meals, but url_import meal_ids are synthetic and regenerated on every add
// (see BasketPage.jsx addImportedMeal), so those must match on destination_url
// instead. Mirrors the two partial unique indexes in migration 008.
function recordMatchesMeal(record, meal) {
  if (meal.source_type === 'url_import') {
    return record.source_type === 'url_import' && record.destination_url === meal.destination_url
  }
  return record.source_type !== 'url_import' && record.meal_id === meal.meal_id
}

function toHistoryFields(meal, now) {
  return {
    meal_id: meal.source_type === 'url_import' ? null : meal.meal_id,
    source_type: meal.source_type ?? 'spoonacular',
    title: meal.title || meal.name || 'Untitled meal',
    image_url: meal.image_url || meal.photo_url || null,
    destination_url: meal.destination_url ?? null,
    last_made_at: now,
  }
}

export function HistoryProvider({ children }) {
  const { subscription, isGuest } = useAuth()

  const [records, setRecords] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const offsetRef = useRef(0)

  // Loads the first page fresh — call when the History screen mounts.
  // Pagination is not eager (unlike Basket/Favorites/ShoppingList) since
  // History can grow indefinitely and most sessions never open this screen.
  async function refresh() {
    offsetRef.current = 0
    setIsLoading(true)
    try {
      if (isGuest) {
        const all = loadGuestHistory().sort(
          (a, b) => new Date(b.last_made_at) - new Date(a.last_made_at)
        )
        const page = all.slice(0, PAGE_SIZE)
        setRecords(page)
        offsetRef.current = page.length
        setHasMore(offsetRef.current < all.length)
        return
      }
      if (!subscription?.id) {
        setRecords([])
        setHasMore(false)
        return
      }
      const { data, error } = await supabase
        .from('meal_history')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('last_made_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)
      if (error) throw error
      const page = data ?? []
      setRecords(page)
      offsetRef.current = page.length
      setHasMore(page.length === PAGE_SIZE)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadMore() {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      if (isGuest) {
        const all = loadGuestHistory().sort(
          (a, b) => new Date(b.last_made_at) - new Date(a.last_made_at)
        )
        const offset = offsetRef.current
        const page = all.slice(offset, offset + PAGE_SIZE)
        setRecords((prev) => [...prev, ...page])
        offsetRef.current = offset + page.length
        setHasMore(offsetRef.current < all.length)
        return
      }
      if (!subscription?.id) return
      const offset = offsetRef.current
      const { data, error } = await supabase
        .from('meal_history')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('last_made_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throw error
      const page = data ?? []
      setRecords((prev) => [...prev, ...page])
      offsetRef.current = offset + page.length
      setHasMore(page.length === PAGE_SIZE)
    } finally {
      setIsLoadingMore(false)
    }
  }

  function writeGuestHistory(basketItems) {
    const existing = loadGuestHistory()
    const now = new Date().toISOString()

    for (const meal of basketItems) {
      const fields = toHistoryFields(meal, now)
      const idx = existing.findIndex((record) => recordMatchesMeal(record, meal))
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], last_made_at: now }
      } else {
        existing.unshift({
          id: `guest-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...fields,
          created_at: now,
        })
      }
    }
    saveGuestHistory(existing)
  }

  async function writeSupabaseHistory(subscriptionId, basketItems) {
    const now = new Date().toISOString()

    for (const meal of basketItems) {
      const fields = toHistoryFields(meal, now)
      if (fields.source_type !== 'url_import' && !fields.meal_id) continue
      if (fields.source_type === 'url_import' && !fields.destination_url) continue

      let existingQuery = supabase
        .from('meal_history')
        .select('id')
        .eq('subscription_id', subscriptionId)

      existingQuery = fields.source_type === 'url_import'
        ? existingQuery.eq('source_type', 'url_import').eq('destination_url', fields.destination_url)
        : existingQuery.neq('source_type', 'url_import').eq('meal_id', fields.meal_id)

      const { data: existing } = await existingQuery.maybeSingle()

      if (existing) {
        await supabase.from('meal_history').update({ last_made_at: now }).eq('id', existing.id)
      } else {
        await supabase.from('meal_history').insert({ subscription_id: subscriptionId, ...fields })
      }
    }
  }

  // Fire-and-forget by design: called from doGenerate() alongside
  // generateShoppingList() and must never block or fail visibly to the user —
  // the shopping list, not History, is what they're waiting on.
  async function writeHistory(basketItems) {
    if (!basketItems?.length) return
    try {
      if (isGuest) {
        writeGuestHistory(basketItems)
        return
      }
      if (!subscription?.id) return
      await writeSupabaseHistory(subscription.id, basketItems)
    } catch (err) {
      console.log('[history] write failed (non-fatal)', err)
    }
  }

  return (
    <HistoryContext.Provider
      value={{ records, isLoading, isLoadingMore, hasMore, refresh, loadMore, writeHistory }}
    >
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  const ctx = useContext(HistoryContext)
  if (!ctx) throw new Error('useHistory must be used within HistoryProvider')
  return ctx
}
