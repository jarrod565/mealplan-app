// ── Pinterest OAuth (CB_09) ──────────────────────────────────────────────────
// PKCE-based OAuth 2.0 flow (Pinterest API v5) + raw Pinterest REST API
// wrappers. Token exchange and refresh happen server-side
// (supabase/functions/pinterest-oauth) since the client secret must never
// reach the browser — same trust model as lib/airtable.js.
//
// Per CB_09's Pinterest API compliance constraint, nothing in this file ever
// writes to Supabase. Board and pin reads return data for callers to hold in
// React state only; only pin_id/destination_url/selected board ids are ever
// persisted, and that persistence happens elsewhere (ConnectedSourcesContext,
// useForYouDeck's basket writes).

import { supabase } from '@/lib/supabase'

const PINTEREST_AUTHORIZE_URL = 'https://www.pinterest.com/oauth/'
const PINTEREST_API_BASE = 'https://api.pinterest.com/v5'
// Pinterest's v5 authorize endpoint expects a comma-separated scope list.
const SCOPES = 'boards:read,pins:read,user_accounts:read'
const REDIRECT_PATH = '/settings/connections/pinterest/callback'
const PKCE_STORAGE_KEY = 'pinterest_oauth_pkce'

function base64UrlEncode(bytes) {
  let str = btoa(String.fromCharCode(...bytes))
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateRandomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return base64UrlEncode(bytes)
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

export function getPinterestRedirectUri() {
  return `${window.location.origin}${REDIRECT_PATH}`
}

// Redirects the browser to Pinterest's consent screen. code_verifier and the
// CSRF state token are stashed in sessionStorage — read back and cleared by
// completePinterestOAuth() when Pinterest redirects back to our callback route.
//
// reconnectConnectionId, when passed, rides along in the same sessionStorage
// payload so it survives the full-page redirect to Pinterest and back. The
// callback page uses it to update an existing connection's tokens in place
// instead of routing into the board-selection wizard.
export async function startPinterestOAuth({ reconnectConnectionId } = {}) {
  const clientId = import.meta.env.VITE_PINTEREST_CLIENT_ID
  if (!clientId) throw new Error('Missing VITE_PINTEREST_CLIENT_ID')

  const verifier = generateRandomToken()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateRandomToken()

  sessionStorage.setItem(
    PKCE_STORAGE_KEY,
    JSON.stringify({ verifier, state, reconnectConnectionId: reconnectConnectionId ?? null })
  )

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getPinterestRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `${PINTEREST_AUTHORIZE_URL}?${params}`
}

// Exchanges the authorization code for tokens via the pinterest-oauth Edge
// Function. Returns { access_token, refresh_token, expires_in, reconnectConnectionId }
// — the caller persists a connected_sources row once board selection is
// confirmed (this function only completes the OAuth leg), or updates an
// existing row's tokens when reconnectConnectionId is present.
export async function completePinterestOAuth(code, state) {
  const stored = sessionStorage.getItem(PKCE_STORAGE_KEY)
  if (!stored) throw new Error('Missing OAuth session — please try connecting again.')

  const { verifier, state: expectedState, reconnectConnectionId } = JSON.parse(stored)
  sessionStorage.removeItem(PKCE_STORAGE_KEY)

  if (!state || state !== expectedState) {
    throw new Error('OAuth state mismatch — please try connecting again.')
  }

  const { data, error } = await supabase.functions.invoke('pinterest-oauth', {
    body: {
      action: 'exchange',
      code,
      code_verifier: verifier,
      redirect_uri: getPinterestRedirectUri(),
    },
  })
  if (error) throw error
  return { ...data, reconnectConnectionId: reconnectConnectionId ?? null }
}

// CB_09: "Token refresh is attempted at the start of every For You session
// before any API calls are made." Called with a connected_sources row's
// refresh_token; caller persists the returned tokens back to that row.
export async function refreshPinterestToken(refreshTokenValue) {
  const { data, error } = await supabase.functions.invoke('pinterest-oauth', {
    body: { action: 'refresh', refresh_token: refreshTokenValue },
  })
  if (error) throw error
  return data
}

async function pinterestFetch(accessToken, path, params) {
  const url = new URL(`${PINTEREST_API_BASE}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null) url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const error = new Error(body?.message || `Pinterest API error ${response.status}`)
    error.status = response.status
    throw error
  }

  return response.json()
}

// Board id/name/pin_count — display-only, held in React state by the caller.
// CB_09: "board names, pin counts, and other metadata are never persisted."
export async function listPinterestBoards(accessToken) {
  const data = await pinterestFetch(accessToken, '/boards', { page_size: 100 })
  return data.items ?? []
}

// Cursor-based pagination via Pinterest's `bookmark` param — same shape as
// the Airtable `offset` pattern already built in useForYouDeck.js.
export async function listPinterestBoardPins(accessToken, boardId, { pageSize = 25, bookmark } = {}) {
  const data = await pinterestFetch(accessToken, `/boards/${boardId}/pins`, { page_size: pageSize, bookmark })
  return { pins: data.items ?? [], bookmark: data.bookmark ?? null }
}

// Used for the basket re-fetch (CB_09: "Basket display re-fetches pin
// title/image from Pinterest API using stored pin_id").
export async function getPinterestPin(accessToken, pinId) {
  return pinterestFetch(accessToken, `/pins/${pinId}`)
}
