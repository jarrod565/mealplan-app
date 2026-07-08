import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useBasket } from '@/contexts/BasketContext'
import { useFavorites } from '@/contexts/FavoritesContext'
import { useConnectedSources } from '@/contexts/ConnectedSourcesContext'
import { listAirtableRecords, refreshAirtableToken } from '@/lib/airtable'
import { airtableRecordToCard, resolveCardMetadata } from '@/lib/airtableAdapter'

// Mirrors useMealDiscovery.js's session-state shape (CB_12: "No/Skip behaves
// identically to Spoonacular") — same shuffle, same No-pile Set, same
// reshuffle-then-empty progression. What differs is the source: Airtable
// rows fetched on demand instead of one Spoonacular batch call, across
// however many active connections there are, interleaved.

const PAGE_SIZE = 25
const MAX_PAGES_PER_SOURCE = 3 // bounded — CB_12: "no pre-fetching or caching of the full base"

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// status:
//   'init'  — refreshing tokens / loading first batch
//   'idle'  — deck has cards
//   'empty' — active pool exhausted this session (CB_12 Pool Exhaustion)
//   'error' — every active source failed to load

export function useForYouDeck() {
  const { addToBasket, isInBasket } = useBasket()
  const { isFavorited, toggleFavorite } = useFavorites()
  const {
    connections, activeSourceIds, updateConnectionTokens, markReconnectRequired,
  } = useConnectedSources()

  const [deck, setDeck] = useState([])
  const [status, setStatus] = useState('init')
  const [errorMessage, setErrorMessage] = useState(null)

  const fullPoolRef = useRef([]) // all cards fetched this session, across reshuffles
  const noPileRef = useRef(new Set()) // session-only No-swiped meal_ids — never persisted
  // Mirrors useMealDiscovery.js: a depleted pool is reshuffled once per
  // batch. Without this, swiping No on everything recycles the same cards
  // forever and the empty state never appears.
  const reshuffledRef = useRef(false)

  const activeConnections = connections.filter(
    (c) => activeSourceIds.includes(c.id) && c.status === 'connected'
  )

  // CB_09: refresh any connection whose token is expired or about to expire
  // before making any Airtable API calls. Failures drop that source from
  // this session's active set and flip it to reconnect_required.
  async function ensureFreshTokens(candidates) {
    const usable = []
    for (const connection of candidates) {
      const expiryMs = connection.token_expiry ? new Date(connection.token_expiry).getTime() : 0
      const needsRefresh = !expiryMs || expiryMs - new Date().getTime() < 60_000
      if (!needsRefresh) {
        usable.push(connection)
        continue
      }
      try {
        const tokens = await refreshAirtableToken(connection.refresh_token)
        usable.push(await updateConnectionTokens(connection.id, tokens))
      } catch {
        await markReconnectRequired(connection.id)
      }
    }
    return usable
  }

  // Pulls up to MAX_PAGES_PER_SOURCE pages per connection, stopping early once
  // a page yields at least one not-yet-swiped, not-already-in-basket card —
  // enough to keep the deck moving without pre-fetching a whole base at once.
  // Basket membership (permanent exclusion, per CB_12) is checked live via
  // isInBasket rather than a precomputed set, since it can change mid-session.
  async function fetchFreshCards(readyConnections, noPile) {
    const collected = []
    for (const connection of readyConnections) {
      let offset
      for (let page = 0; page < MAX_PAGES_PER_SOURCE; page++) {
        let result
        try {
          result = await listAirtableRecords(connection.access_token, connection.base_id, connection.table_id, {
            pageSize: PAGE_SIZE,
            offset,
          })
        } catch {
          break // this source failed this round — skip it, other sources still count
        }
        const cards = result.records
          .map((record) => airtableRecordToCard(record, connection))
          .filter((card) => !noPile.has(card.meal_id) && !isInBasket(card.meal_id))
        collected.push(...cards)
        offset = result.offset
        if (!offset || cards.length > 0) break
      }
    }
    return collected
  }

  const loadBatch = useCallback(async () => {
    setStatus('init')
    setErrorMessage(null)
    noPileRef.current = new Set()
    fullPoolRef.current = []
    reshuffledRef.current = false

    if (activeConnections.length === 0) {
      setDeck([])
      setStatus('empty')
      return
    }

    try {
      const ready = await ensureFreshTokens(activeConnections)
      if (ready.length === 0) {
        setErrorMessage('Reconnect your sources to continue — check Settings → Connections.')
        setStatus('error')
        return
      }

      const cards = await fetchFreshCards(ready, noPileRef.current)
      fullPoolRef.current = cards
      setDeck(shuffle(cards))
      setStatus(cards.length === 0 ? 'empty' : 'idle')
    } catch (err) {
      setErrorMessage(err?.message ?? null)
      setStatus('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(activeConnections.map((c) => c.id))])

  // CB_12: "Metadata extraction runs per card as it is about to be served —
  // not pre-fetched for the whole batch." Only the top two cards (what
  // PlanPage-style rendering actually shows: active + peek) get resolved,
  // and only when the mapped columns left a gap for the CB_10 OG fallback
  // to fill — cards with both title and image never hit the network here.
  useEffect(() => {
    const candidates = deck.slice(0, 2).filter((c) => !c.metadataResolved)
    if (candidates.length === 0) return
    let cancelled = false
    Promise.all(candidates.map((c) => resolveCardMetadata(c))).then((resolved) => {
      if (cancelled) return
      setDeck((prev) => prev.map((c) => resolved.find((r) => r.card_id === c.card_id) ?? c))
    })
    return () => { cancelled = true }
  }, [deck])

  function advanceDeck() {
    setDeck((prev) => {
      const next = prev.slice(1)
      if (next.length > 0) return next

      // Deck depleted — reshuffle this session's No-swiped cards once, same
      // progression as useMealDiscovery (Spoonacular) before showing empty.
      if (!reshuffledRef.current) {
        const reshuffled = shuffle(
          fullPoolRef.current.filter(
            (c) => noPileRef.current.has(c.meal_id) && !isInBasket(c.meal_id)
          )
        )
        if (reshuffled.length > 0) {
          reshuffledRef.current = true
          noPileRef.current = new Set()
          return reshuffled
        }
      }

      setStatus('empty')
      return []
    })
  }

  function swipeYes(card) {
    addToBasket({
      meal_id: card.meal_id,
      name: card.title,
      title: card.title,
      photo_url: card.image_url,
      image_url: card.image_url,
      source_type: card.source_type,
      destination_url: card.destination_url,
      source_domain: card.source_footer,
    }).catch((err) => {
      console.error('addToBasket failed:', err)
      toast.error(err?.message ?? 'Could not add to basket. Please try again.')
    })
    advanceDeck()
  }

  function swipeNo(card) {
    noPileRef.current.add(card.meal_id)
    advanceDeck()
  }

  // CB_12 Pool Exhaustion: "Start Over" resets the session pool — No-swiped
  // rows return, Yes-swiped (basket) rows remain excluded — and also re-pulls
  // fresh pages so newly-added Airtable rows become eligible, same trigger
  // point the brief describes for "new rows become eligible."
  const startOver = useCallback(() => {
    loadBatch()
  }, [loadBatch])

  return {
    deck,
    topCard: deck[0] ?? null,
    status,
    errorMessage,
    hasActiveSources: activeConnections.length > 0,
    swipeYes,
    swipeNo,
    startOver,
    loadBatch,
    isFavorited,
    toggleFavorite,
  }
}
