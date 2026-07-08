import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const ConnectedSourcesContext = createContext(null)

// CB_09/CB_12: Connected Sources require a real Supabase subscription row —
// guest mode (localStorage-only, no Supabase writes) can't hold a connection,
// so this context is simply empty for guests rather than mirroring the
// guest/localStorage pattern the other contexts use.
export function ConnectedSourcesProvider({ children }) {
  const { subscription, isGuest, updateSubscription } = useAuth()
  const [connections, setConnections] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const activeSourceIds = subscription?.active_connected_source_ids ?? []

  function isSourceActive(connectionId) {
    return activeSourceIds.includes(connectionId)
  }

  // CB_12: "Filter selections persist across sessions (saved to Supabase on
  // the subscription record)... take effect immediately on the next batch pull."
  async function setActiveSourceIds(ids) {
    await updateSubscription({ active_connected_source_ids: ids })
  }

  async function toggleSourceActive(connectionId) {
    const next = isSourceActive(connectionId)
      ? activeSourceIds.filter((id) => id !== connectionId)
      : [...activeSourceIds, connectionId]
    await setActiveSourceIds(next)
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

  async function disconnectSource(connectionId) {
    await supabase.from('connected_sources').delete().eq('id', connectionId)
    setConnections((prev) => prev.filter((c) => c.id !== connectionId))
    if (isSourceActive(connectionId)) {
      await setActiveSourceIds(activeSourceIds.filter((id) => id !== connectionId))
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
        disconnectSource,
        updateConnectionTokens,
        markReconnectRequired,
        activeSourceIds,
        isSourceActive,
        toggleSourceActive,
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
