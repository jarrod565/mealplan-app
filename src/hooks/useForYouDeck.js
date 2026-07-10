import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useBasket } from '@/contexts/BasketContext'
import { useFavorites } from '@/contexts/FavoritesContext'
import { useConnectedSources } from '@/contexts/ConnectedSourcesContext'
import { listAirtableRecords, refreshAirtableToken } from '@/lib/airtable'
import { airtableRecordToCard, resolveCardMetadata } from '@/lib/airtableAdapter'
import { listPinterestBoards, listPinterestBoardPins, refreshPinterestToken } from '@/lib/pinterest'
import { pinterestPinToCard } from '@/lib/pinterestAdapter'

// Mirrors useMealDiscovery.js's No-pile Set/session-swipe-state shape, but
// NOT its reshuffle-then-empty progression. CB_09/CB_12 are explicit that a
// depleted For You deck goes straight to the empty state — No-swiped cards
// only come back via an explicit Start Over / Reload tap (loadBatch), never
// automatically. That's a deliberate divergence from Explore (CB_03), where
// a depleted deck auto-reshuffles the No pile once before going empty.

const PAGE_SIZE = 25
// Neither Airtable's `offset` nor Pinterest's `bookmark` is a jump-to-index
// param — each is an opaque cursor only obtainable from a prior response,
// and neither API offers a random-sort option. To still land on a different
// slice of the corpus each fetch, randomAirtableOffset/randomPinterestBookmark
// below walk forward through 0-MAX_SKIP_PAGES throwaway pages (fetched at
// this larger size to minimize round trips) purely to discover a cursor,
// discarding the records — never cached, never rendered.
const SKIP_PAGE_SIZE = 100
const MAX_SKIP_PAGES = 5
const LOW_WATER_MARK = 8 // fetch the next batch once the deck drops to this many cards
// A single random slice can land entirely on already-swiped/basketed cards.
// Retry with a fresh slice a few times before accepting "nothing new this
// round" rather than surfacing a false empty state from one unlucky sample.
const MAX_FETCH_ATTEMPTS = 4
// Consecutive empty rounds (across loadMore calls) before background
// top-ups stop retrying for the rest of this session — random sampling can
// never be 100% sure the pool is exhausted, so this is a practical cutoff,
// not a hard guarantee. Reset on every loadBatch (fresh session).
const MAX_CONSECUTIVE_EMPTY = 3

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Walks forward through 0-MAX_SKIP_PAGES throwaway pages (large page size,
// records discarded) to land on a random Airtable offset. Wraps back to the
// start (offset undefined) if the walk runs off the end of the table — e.g.
// a base smaller than the randomly chosen skip depth — rather than stalling
// with no usable cursor. Module-level (like shuffle) rather than defined
// inside useForYouDeck: it calls Math.random(), and the React Compiler
// flags impure calls in functions defined within a hook's render body.
async function randomAirtableOffset(connection) {
  const skipPages = Math.floor(Math.random() * (MAX_SKIP_PAGES + 1))
  let offset
  for (let i = 0; i < skipPages; i++) {
    let result
    try {
      result = await listAirtableRecords(connection.access_token, connection.base_id, connection.table_id, {
        pageSize: SKIP_PAGE_SIZE,
        offset,
      })
    } catch {
      break
    }
    if (!result.offset) {
      offset = undefined
      break
    }
    offset = result.offset
  }
  return offset
}

// Same throwaway-walk technique as randomAirtableOffset, but over
// Pinterest's `bookmark` cursor for a single board.
async function randomPinterestBookmark(connection, boardId) {
  const skipPages = Math.floor(Math.random() * (MAX_SKIP_PAGES + 1))
  let bookmark
  for (let i = 0; i < skipPages; i++) {
    let result
    try {
      result = await listPinterestBoardPins(connection.access_token, boardId, { pageSize: SKIP_PAGE_SIZE, bookmark })
    } catch {
      break
    }
    if (!result.bookmark) {
      bookmark = undefined
      break
    }
    bookmark = result.bookmark
  }
  return bookmark
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
    connections, activeSourceIds, activePinterestBoardIds, updateConnectionTokens, markReconnectRequired,
  } = useConnectedSources()

  const [deck, setDeck] = useState([])
  const [status, setStatus] = useState('init')
  const [errorMessage, setErrorMessage] = useState(null)

  const noPileRef = useRef(new Set()) // session-only No-swiped meal_ids — never persisted

  // Pinterest board names are fetched fresh each session (never persisted —
  // CB_09 policy) and cached here per connection so repeated fetches within
  // the same session don't re-list boards just to re-derive names.
  const pinterestBoardNamesRef = useRef({})
  const isLoadingMoreRef = useRef(false) // guards overlapping background top-ups
  const consecutiveEmptyRef = useRef(0)

  // Airtable stays connection-level (activeSourceIds); Pinterest is
  // board-level now — a Pinterest connection only counts as active if at
  // least one of its selected boards is toggled on (activePinterestBoardIds).
  // A connection with zero active boards is treated as fully inactive, per
  // CB_09's filter drawer spec.
  const activeConnections = connections.filter((c) => {
    if (c.status !== 'connected') return false
    if (c.source_type === 'pinterest') {
      const boardIds = c.config?.selected_board_ids ?? []
      return boardIds.some((id) => activePinterestBoardIds.includes(id))
    }
    return activeSourceIds.includes(c.id)
  })

  // CB_09: refresh any connection whose token is expired or about to expire
  // before making any source API calls. Failures drop that source from this
  // session's active set and flip it to reconnect_required.
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
        const refresh = connection.source_type === 'pinterest' ? refreshPinterestToken : refreshAirtableToken
        const tokens = await refresh(connection.refresh_token)
        usable.push(await updateConnectionTokens(connection.id, tokens))
      } catch {
        await markReconnectRequired(connection.id)
      }
    }
    return usable
  }

  // One random-slice attempt for this connection — a different slice every
  // call, not a continuation of a previous one. Basket membership (permanent
  // exclusion, per CB_12) is checked live via isInBasket rather than a
  // precomputed set, since it can change mid-session.
  async function fetchAirtableCards(connection, noPile) {
    const offset = await randomAirtableOffset(connection)
    let result
    try {
      result = await listAirtableRecords(connection.access_token, connection.base_id, connection.table_id, {
        pageSize: PAGE_SIZE,
        offset,
      })
    } catch {
      return [] // this source failed this round — skip it, other sources still count
    }
    return result.records
      .map((record) => airtableRecordToCard(record, connection))
      .filter((card) => !noPile.has(card.meal_id) && !isInBasket(card.meal_id))
  }

  // One random-slice attempt across this connection's active boards (not
  // every selected board — a board can be selected but toggled off in the
  // filter drawer, per CB_09's board-level activation). Board *order* is
  // reshuffled every call too, so repeated fetches don't always favor
  // whichever board happens to be first.
  async function fetchPinterestCards(connection, noPile) {
    const boardIds = (connection.config?.selected_board_ids ?? [])
      .filter((id) => activePinterestBoardIds.includes(id))
    if (boardIds.length === 0) return []

    let boardNameById = pinterestBoardNamesRef.current[connection.id]
    if (!boardNameById) {
      try {
        const boards = await listPinterestBoards(connection.access_token)
        boardNameById = new Map(boards.map((b) => [b.id, b.name]))
        pinterestBoardNamesRef.current[connection.id] = boardNameById
      } catch {
        return [] // this source failed this round — skip it, other sources still count
      }
    }

    const collected = []
    for (const boardId of shuffle(boardIds)) {
      const bookmark = await randomPinterestBookmark(connection, boardId)
      let result
      try {
        result = await listPinterestBoardPins(connection.access_token, boardId, { pageSize: PAGE_SIZE, bookmark })
      } catch {
        continue
      }
      const cards = result.pins
        .map((pin) => pinterestPinToCard(pin, connection, boardNameById.get(pin.board_id ?? boardId)))
        .filter((card) => !noPile.has(card.meal_id) && !isInBasket(card.meal_id))
      collected.push(...cards)
    }
    return collected
  }

  async function fetchFreshCards(readyConnections, noPile) {
    const collected = []
    for (const connection of readyConnections) {
      const cards = connection.source_type === 'pinterest'
        ? await fetchPinterestCards(connection, noPile)
        : await fetchAirtableCards(connection, noPile)
      collected.push(...cards)
    }
    return collected
  }

  // Retries fresh random slices (each fetchFreshCards call is itself a new
  // random sample, per source) until one yields a usable card or the
  // attempt budget runs out. Dedupes within this call's own accumulated
  // results — cross-attempt overlap is possible since each attempt samples
  // independently rather than continuing from the last one.
  async function collectRandomCards(readyConnections, noPile) {
    const collected = []
    const seen = new Set()
    for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS && collected.length === 0; attempt++) {
      const cards = await fetchFreshCards(readyConnections, noPile)
      for (const card of cards) {
        if (seen.has(card.meal_id)) continue
        seen.add(card.meal_id)
        collected.push(card)
      }
    }
    return collected
  }

  const loadBatch = useCallback(async () => {
    setStatus('init')
    setErrorMessage(null)
    noPileRef.current = new Set()
    pinterestBoardNamesRef.current = {}
    consecutiveEmptyRef.current = 0

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

      const cards = await collectRandomCards(ready, noPileRef.current)
      setDeck(shuffle(cards))
      setStatus(cards.length === 0 ? 'empty' : 'idle')
    } catch (err) {
      setErrorMessage(err?.message ?? null)
      setStatus('error')
    }
    // activePinterestBoardIds is a separate dependency from the connection-id
    // list above: a Pinterest connection can stay "active" overall (still
    // has >=1 active board) while which specific boards are active changes —
    // that wouldn't change activeConnections' set of ids, so without this,
    // loadBatch would keep a stale closure over the old board selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(activeConnections.map((c) => c.id)), JSON.stringify(activePinterestBoardIds)])

  // Background top-up — fetches a fresh random slice per source and appends
  // to the existing deck, without touching status/noPileRef the way
  // loadBatch does. This is what lets pagination continue as the user swipes
  // instead of capping at whatever loadBatch fetched once on load. Triggered
  // by the low-water-mark effect below, not called directly from swipe
  // handlers.
  async function loadMore() {
    if (isLoadingMoreRef.current) return
    if (activeConnections.length === 0) return
    if (consecutiveEmptyRef.current >= MAX_CONSECUTIVE_EMPTY) return

    isLoadingMoreRef.current = true
    try {
      const ready = await ensureFreshTokens(activeConnections)
      if (ready.length === 0) return

      const cards = await collectRandomCards(ready, noPileRef.current)
      if (cards.length === 0) {
        consecutiveEmptyRef.current += 1
        return
      }
      consecutiveEmptyRef.current = 0

      setDeck((prev) => {
        const existingIds = new Set(prev.map((c) => c.meal_id))
        const fresh = cards.filter((c) => !existingIds.has(c.meal_id))
        if (fresh.length === 0) return prev
        return [...prev, ...shuffle(fresh)]
      })
      // A low-water-mark top-up can land after the deck already emptied out
      // (advanceDeck flips to 'empty' the moment it hits zero) — recover
      // back to 'idle' now that fresh cards are here instead of leaving the
      // empty state showing over a non-empty deck.
      setStatus((prev) => (prev === 'empty' ? 'idle' : prev))
    } catch {
      // Background top-ups fail silently — the visible deck is unaffected,
      // and this will simply be retried the next time deck.length is low.
    } finally {
      isLoadingMoreRef.current = false
    }
  }

  // CB_09/CB_12 note the deck should never go empty just because the next
  // batch wasn't fetched ahead of time — this fires loadMore() while cards
  // still remain, well before the user actually runs out.
  useEffect(() => {
    if (activeConnections.length === 0) return
    if (status === 'init' || status === 'error') return
    if (deck.length > LOW_WATER_MARK) return
    loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.length, status])

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

  // CB_09/CB_12: deck depletion goes straight to the empty state — no
  // automatic reshuffle. No-swiped cards only return via an explicit
  // Start Over / Reload tap, unlike Explore's Spoonacular deck.
  function advanceDeck() {
    setDeck((prev) => {
      const next = prev.slice(1)
      if (next.length > 0) return next
      setStatus('empty')
      return []
    })
  }

  // CB_09 Pinterest compliance: "The Yes button stores only the pin ID and
  // destination URL in the Basket — not the image, title, or any other
  // Pinterest content." Every other field is deliberately omitted (not just
  // left falsy) so BasketContext's `?? null` fallback persists nulls rather
  // than any Pinterest-sourced display data. `name` is the one exception —
  // basket_items.name is NOT NULL — so it gets a fixed, non-Pinterest
  // placeholder rather than card.title; BasketPage re-fetches the real title
  // by pin_id at render time and never reads this stored value for display.
  function swipeYes(card) {
    const meal = card.source_type === 'pinterest'
      ? {
          meal_id: card.meal_id,
          name: 'Pinterest recipe',
          source_type: card.source_type,
          destination_url: card.destination_url,
        }
      : {
          meal_id: card.meal_id,
          name: card.title,
          title: card.title,
          photo_url: card.image_url,
          image_url: card.image_url,
          source_type: card.source_type,
          destination_url: card.destination_url,
          source_domain: card.source_footer,
        }

    addToBasket(meal).catch((err) => {
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
