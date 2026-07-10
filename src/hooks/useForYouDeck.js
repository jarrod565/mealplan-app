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
const MAX_PAGES_PER_SOURCE = 3 // bounded — CB_12: "no pre-fetching or caching of the full base"
const LOW_WATER_MARK = 8 // fetch the next page once the deck drops to this many cards

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

  const noPileRef = useRef(new Set()) // session-only No-swiped meal_ids — never persisted

  // Pagination cursors, keyed by connection.id, persisted across fetch calls
  // for the life of the session (reset on loadBatch/Start Over). Shape
  // differs by source since Airtable paginates the whole table with one
  // offset while Pinterest paginates per board:
  //   airtable:  { offset, exhausted }
  //   pinterest: { [boardId]: { bookmark, exhausted } }
  // Without this, offset/bookmark only ever lived in a local variable inside
  // a single fetch call and was thrown away as soon as that call returned —
  // the deck could never grow past its first page.
  const cursorsRef = useRef({})
  // Pinterest board names are fetched fresh each session (never persisted —
  // CB_09 policy) and cached here per connection so a background top-up
  // doesn't re-list all boards just to re-derive names it already has.
  const pinterestBoardNamesRef = useRef({})
  const isLoadingMoreRef = useRef(false) // guards overlapping background top-ups

  const activeConnections = connections.filter(
    (c) => activeSourceIds.includes(c.id) && c.status === 'connected'
  )

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

  // Pulls up to MAX_PAGES_PER_SOURCE pages per connection, stopping early once
  // a page yields at least one not-yet-swiped, not-already-in-basket card —
  // enough to keep the deck moving without pre-fetching a whole base at once.
  // Basket membership (permanent exclusion, per CB_12) is checked live via
  // isInBasket rather than a precomputed set, since it can change mid-session.
  //
  // Resumes from wherever this connection's cursor left off (cursorsRef) and
  // writes the new cursor back before returning — this is what lets repeated
  // calls (loadBatch, then loadMore as the deck runs low) walk forward
  // through the table instead of each one restarting from the beginning.
  async function fetchAirtableCards(connection, noPile) {
    const cursor = cursorsRef.current[connection.id] ?? { offset: undefined, exhausted: false }
    if (cursor.exhausted) return []

    const collected = []
    let offset = cursor.offset
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
    cursorsRef.current[connection.id] = { offset, exhausted: !offset }
    return collected
  }

  // Same bounded-pagination shape as fetchAirtableCards, but paginates each
  // selected board via Pinterest's cursor-based `bookmark` param instead of
  // Airtable's `offset`, and each board carries its own independent cursor
  // (cursorsRef.current[connection.id][boardId]) since boards paginate
  // separately. Board names are fetched fresh once per connection per
  // session (never persisted — CB_09 policy) and cached in
  // pinterestBoardNamesRef so a later top-up call doesn't re-list boards
  // just to re-derive names it already has.
  async function fetchPinterestCards(connection, noPile) {
    const boardIds = connection.config?.selected_board_ids ?? []
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

    const boardCursors = cursorsRef.current[connection.id] ?? {}
    cursorsRef.current[connection.id] = boardCursors

    const collected = []
    for (const boardId of boardIds) {
      const cursor = boardCursors[boardId] ?? { bookmark: undefined, exhausted: false }
      if (cursor.exhausted) continue

      let bookmark = cursor.bookmark
      for (let page = 0; page < MAX_PAGES_PER_SOURCE; page++) {
        let result
        try {
          result = await listPinterestBoardPins(connection.access_token, boardId, { pageSize: PAGE_SIZE, bookmark })
        } catch {
          break
        }
        const cards = result.pins
          .map((pin) => pinterestPinToCard(pin, connection, boardNameById.get(pin.board_id ?? boardId)))
          .filter((card) => !noPile.has(card.meal_id) && !isInBasket(card.meal_id))
        collected.push(...cards)
        bookmark = result.bookmark
        if (!bookmark || cards.length > 0) break
      }
      boardCursors[boardId] = { bookmark, exhausted: !bookmark }
    }
    return collected
  }

  // Cheap short-circuit so the low-water-mark effect stops firing background
  // fetches once every active source has genuinely run out of pages, instead
  // of re-deriving "nothing left" on every render while the deck sits low.
  function allSourcesExhausted(readyConnections) {
    return readyConnections.every((connection) => {
      const cursor = cursorsRef.current[connection.id]
      if (!cursor) return false // never fetched yet — can't be exhausted
      if (connection.source_type === 'pinterest') {
        const boardIds = connection.config?.selected_board_ids ?? []
        return boardIds.every((boardId) => cursor[boardId]?.exhausted)
      }
      return cursor.exhausted === true
    })
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

  const loadBatch = useCallback(async () => {
    setStatus('init')
    setErrorMessage(null)
    noPileRef.current = new Set()
    // Full reset — matches CB_12's "Start Over ... re-pulls fresh pages so
    // newly-added rows become eligible." Without clearing these, a repeat
    // loadBatch (Start Over, or a source becoming active again) would
    // resume from wherever the previous session's cursors left off instead
    // of walking the pool from the beginning.
    cursorsRef.current = {}
    pinterestBoardNamesRef.current = {}

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
      setDeck(shuffle(cards))
      setStatus(cards.length === 0 ? 'empty' : 'idle')
    } catch (err) {
      setErrorMessage(err?.message ?? null)
      setStatus('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(activeConnections.map((c) => c.id))])

  // Background top-up — fetches the next page per source using each
  // connection's persisted cursor and appends to the existing deck, without
  // touching status/noPileRef the way loadBatch does. This is what lets
  // pagination continue as the user swipes instead of capping at whatever
  // loadBatch fetched once on load. Triggered by the low-water-mark effect
  // below, not called directly from swipe handlers.
  async function loadMore() {
    if (isLoadingMoreRef.current) return
    if (activeConnections.length === 0) return
    if (allSourcesExhausted(activeConnections)) return

    isLoadingMoreRef.current = true
    try {
      const ready = await ensureFreshTokens(activeConnections)
      if (ready.length === 0) return

      const cards = await fetchFreshCards(ready, noPileRef.current)
      if (cards.length === 0) return

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

  // CB_09/CB_12 note the deck should never go empty just because pagination
  // wasn't fetched ahead of time — this fires loadMore() while cards still
  // remain, well before the user actually runs out.
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
