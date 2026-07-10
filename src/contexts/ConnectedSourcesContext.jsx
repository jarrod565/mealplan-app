import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { listPinterestBoards } from '@/lib/pinterest'

const ConnectedSourcesContext = createContext(null)

// CB_09/CB_12: Connected Sources require a real Supabase subscription row —
// guest mode (localStorage-only, no Supabase writes) can't hold a connection,
// so this context is simply empty for guests rather than mirroring the
// guest/localStorage pattern the other contexts use.
export function ConnectedSourcesProvider({ children }) {
  const { subscription, isGuest, updateSubscription } = useAuth()
  const [connections, setConnections] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  // CB_09 policy: board names are never persisted, only ever fetched fresh
  // and held in session state. { [connectionId]: { [boardId]: name } } — the
  // one shared place other consumers (e.g. ForYouPage's filter drawer) can
  // read a Pinterest connection's board names from, instead of each needing
  // its own private fetch.
  const [pinterestBoardNames, setPinterestBoardNames] = useState({})

  const activeSourceIds = subscription?.active_connected_source_ids ?? []
  // Board-level equivalent of activeSourceIds, for Pinterest — a single
  // Pinterest connection can have many selected boards, and the filter
  // drawer toggles boards individually rather than the whole connection.
  const activePinterestBoardIds = subscription?.active_pinterest_board_ids ?? []

  function isSourceActive(connectionId) {
    return activeSourceIds.includes(connectionId)
  }

  function isBoardActive(boardId) {
    return activePinterestBoardIds.includes(boardId)
  }

  // CB_12: "Filter selections persist across sessions (saved to Supabase on
  // the subscription record)... take effect immediately on the next batch pull."
  async function setActiveSourceIds(ids) {
    await updateSubscription({ active_connected_source_ids: ids })
  }

  async function setActivePinterestBoardIds(ids) {
    await updateSubscription({ active_pinterest_board_ids: ids })
    // updateSubscription already applies its own response to local state,
    // but explicitly re-read the column here too so a write that silently
    // didn't persist (e.g. an RLS policy no-op, or a stale schema cache)
    // surfaces as a thrown error instead of the toggle looking successful
    // while the database disagrees.
    const { data, error } = await supabase
      .from('subscriptions')
      .select('active_pinterest_board_ids')
      .eq('id', subscription.id)
      .single()
    if (error) throw error
    const persisted = data?.active_pinterest_board_ids ?? []
    const persistedMatches = persisted.length === ids.length && ids.every((id) => persisted.includes(id))
    if (!persistedMatches) {
      throw new Error('Board selection did not save — please try again.')
    }
  }

  async function toggleSourceActive(connectionId) {
    const next = isSourceActive(connectionId)
      ? activeSourceIds.filter((id) => id !== connectionId)
      : [...activeSourceIds, connectionId]
    await setActiveSourceIds(next)
  }

  async function toggleBoardActive(boardId) {
    const next = isBoardActive(boardId)
      ? activePinterestBoardIds.filter((id) => id !== boardId)
      : [...activePinterestBoardIds, boardId]
    await setActivePinterestBoardIds(next)
  }

  async function refresh() {
    if (isGuest || !subscription?.id) {
      setConnections([])
      return
    }
    setIsLoading(true)
    try {
      const { data } = await supabase
        .from('connected_sources')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('created_at', { ascending: true })
      setConnections(data ?? [])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.id, isGuest])

  const pinterestConnections = connections.filter(
    (c) => c.source_type === 'pinterest' && c.status === 'connected'
  )

  // Fetches board names fresh for any connected Pinterest connection —
  // never stored in Supabase, only held here for consumers like ForYouPage's
  // filter drawer to read for display. Keyed on connection id (+ token, so a
  // reconnect re-fetches) rather than the whole `connections` array, since
  // that array gets a new reference on unrelated updates too.
  useEffect(() => {
    if (pinterestConnections.length === 0) return
    let cancelled = false
    Promise.all(
      pinterestConnections.map(async (connection) => {
        try {
          const boards = await listPinterestBoards(connection.access_token)
          return [connection.id, Object.fromEntries(boards.map((b) => [b.id, b.name]))]
        } catch {
          return [connection.id, {}]
        }
      })
    ).then((entries) => {
      if (cancelled) return
      setPinterestBoardNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pinterestConnections.map((c) => [c.id, c.access_token]))])

  // Called once column mapping is confirmed (CB_12: "Column mapping must be
  // confirmed before the connection is saved" — nothing is persisted before
  // this point in the wizard). connectionId present = re-mapping an existing
  // connection (update); absent = a brand new one (insert).
  async function saveConnection({ connectionId, tokens, base, table, columnMapping, cachedFields }) {
    if (!subscription?.id) throw new Error('No subscription — please sign out and sign back in.')

    const record = {
      subscription_id: subscription.id,
      source_type: 'airtable',
      status: 'connected',
      base_id: base.id,
      base_name: base.name,
      table_id: table.id,
      table_name: table.name,
      column_mapping: columnMapping,
      // Field list snapshot — lets a future Remap pre-populate the mapping UI
      // straight from Supabase, with no Airtable API call until Save.
      ...(cachedFields && { cached_fields: cachedFields }),
      ...(tokens && {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        // Remapping an existing connection reuses its already-stored tokens,
        // which carry no expires_in — omit token_expiry entirely rather than
        // nulling out a still-valid expiry the caller doesn't actually know.
        ...(typeof tokens.expires_in === 'number' && {
          token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        }),
      }),
    }

    if (connectionId) {
      const { data, error } = await supabase
        .from('connected_sources')
        .update(record)
        .eq('id', connectionId)
        .select()
        .single()
      if (error) throw error
      setConnections((prev) => prev.map((c) => (c.id === connectionId ? data : c)))
      return data
    }

    const { data, error } = await supabase
      .from('connected_sources')
      .insert(record)
      .select()
      .single()
    if (error) throw error
    setConnections((prev) => [...prev, data])
    // New connections default to active — CB_12's example workflow has a
    // freshly-connected source show up already-active in the filter drawer,
    // no extra trip required.
    await setActiveSourceIds([...activeSourceIds, data.id])
    return data
  }

  // CB_09: Pinterest's only wizard step after OAuth is board selection — no
  // base/table/column-mapping like Airtable. A subscription may hold at most
  // one Pinterest connection (enforced by connected_sources_pinterest_key in
  // migration 011), so this always upserts against that single row rather
  // than inserting duplicates. tokens is omitted when only editing board
  // selection on an already-connected source ("Board selection must be
  // editable at any time from Settings → Integrations → Pinterest").
  async function savePinterestConnection({ connectionId, tokens, selectedBoardIds }) {
    if (!subscription?.id) throw new Error('No subscription — please sign out and sign back in.')

    const newBoardIds = selectedBoardIds ?? []
    const record = {
      subscription_id: subscription.id,
      source_type: 'pinterest',
      status: 'connected',
      // CB_09 policy: only board IDs are ever persisted — names/counts are
      // fetched fresh from the Pinterest API each session.
      config: { selected_board_ids: newBoardIds },
      ...(tokens && {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        ...(typeof tokens.expires_in === 'number' && {
          token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        }),
      }),
    }

    if (connectionId) {
      const existing = connections.find((c) => c.id === connectionId)
      const oldBoardIds = existing?.config?.selected_board_ids ?? []

      const { data, error } = await supabase
        .from('connected_sources')
        .update(record)
        .eq('id', connectionId)
        .select()
        .single()
      if (error) throw error
      setConnections((prev) => prev.map((c) => (c.id === connectionId ? data : c)))

      // Newly selected boards default to active (same "just connected, show
      // up active" precedent as a brand new connection); boards no longer
      // selected are dropped so the active list doesn't accumulate ids for
      // boards that can never be fetched again. Boards that stay selected
      // keep whatever active state the user already gave them.
      const removedBoardIds = oldBoardIds.filter((id) => !newBoardIds.includes(id))
      const addedBoardIds = newBoardIds.filter((id) => !oldBoardIds.includes(id))
      if (removedBoardIds.length > 0 || addedBoardIds.length > 0) {
        const next = [
          ...activePinterestBoardIds.filter((id) => !removedBoardIds.includes(id)),
          ...addedBoardIds,
        ]
        await setActivePinterestBoardIds([...new Set(next)])
      }
      return data
    }

    const { data, error } = await supabase
      .from('connected_sources')
      .insert(record)
      .select()
      .single()
    if (error) throw error
    setConnections((prev) => [...prev, data])
    // New connections default to active, same as saveConnection — CB_09's
    // example workflow has the For You nav item become active immediately
    // once boards are selected, no extra trip required. Board-level (not
    // connection-level) since that's what governs Pinterest activity now.
    await setActivePinterestBoardIds([...new Set([...activePinterestBoardIds, ...newBoardIds])])
    return data
  }

  async function disconnectSource(connectionId) {
    const target = connections.find((c) => c.id === connectionId)
    await supabase.from('connected_sources').delete().eq('id', connectionId)
    setConnections((prev) => prev.filter((c) => c.id !== connectionId))
    if (isSourceActive(connectionId)) {
      await setActiveSourceIds(activeSourceIds.filter((id) => id !== connectionId))
    }
    // Board ids only ever mean something in the context of the connection
    // they came from — clean them out of the active list rather than
    // leaving them to linger forever once that connection is gone.
    if (target?.source_type === 'pinterest') {
      const boardIds = target.config?.selected_board_ids ?? []
      if (boardIds.length > 0) {
        await setActivePinterestBoardIds(activePinterestBoardIds.filter((id) => !boardIds.includes(id)))
      }
    }
  }

  // CB_09: "Token refresh is attempted at the start of every For You session
  // before any API calls are made." Separate from saveConnection so a session
  // refresh doesn't need to carry base/table/column_mapping just to touch tokens.
  async function updateConnectionTokens(connectionId, tokens) {
    const { data, error } = await supabase
      .from('connected_sources')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: typeof tokens.expires_in === 'number'
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        status: 'connected',
      })
      .eq('id', connectionId)
      .select()
      .single()
    if (error) throw error
    setConnections((prev) => prev.map((c) => (c.id === connectionId ? data : c)))
    return data
  }

  // CB_09: "If token refresh fails, the Connected Source status must update
  // to 'Reconnect' and the user must be prompted to re-authenticate."
  async function markReconnectRequired(connectionId) {
    const { data, error } = await supabase
      .from('connected_sources')
      .update({ status: 'reconnect_required' })
      .eq('id', connectionId)
      .select()
      .single()
    if (!error) setConnections((prev) => prev.map((c) => (c.id === connectionId ? data : c)))
  }

  return (
    <ConnectedSourcesContext.Provider
      value={{
        connections,
        isLoading,
        refresh,
        saveConnection,
        savePinterestConnection,
        pinterestBoardNames,
        disconnectSource,
        updateConnectionTokens,
        markReconnectRequired,
        activeSourceIds,
        isSourceActive,
        toggleSourceActive,
        activePinterestBoardIds,
        isBoardActive,
        toggleBoardActive,
      }}
    >
      {children}
    </ConnectedSourcesContext.Provider>
  )
}

export function useConnectedSources() {
  const ctx = useContext(ConnectedSourcesContext)
  if (!ctx) throw new Error('useConnectedSources must be used within ConnectedSourcesProvider')
  return ctx
}
