// ── Airtable OAuth (CB_12) ────────────────────────────────────────────────────
// PKCE-based OAuth 2.0 flow + raw Airtable REST API wrappers. Token exchange
// and refresh happen server-side (supabase/functions/airtable-oauth) since
// the client secret must never reach the browser; everything else here
// (base/table/record fetching) runs client-side using the access token,
// same trust model this app already uses for the Spoonacular API key.

import { supabase } from '@/lib/supabase'

const AIRTABLE_AUTHORIZE_URL = 'https://airtable.com/oauth2/v1/authorize'
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0'
const SCOPES = 'data.records:read schema.bases:read'
const REDIRECT_PATH = '/settings/connections/airtable/callback'
const PKCE_STORAGE_KEY = 'airtable_oauth_pkce'

// TEMPORARY DEBUG — remove once VITE_AIRTABLE_CLIENT_ID build-time
// availability is confirmed. Logs only a short prefix, never the full ID.
console.log(
  '[airtable debug] VITE_AIRTABLE_CLIENT_ID present:',
  !!import.meta.env.VITE_AIRTABLE_CLIENT_ID,
  'prefix:',
  import.meta.env.VITE_AIRTABLE_CLIENT_ID
    ? import.meta.env.VITE_AIRTABLE_CLIENT_ID.slice(0, 4)
    : 'MISSING'
)

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

export function getAirtableRedirectUri() {
  return `${window.location.origin}${REDIRECT_PATH}`
}

// Redirects the browser to Airtable's consent screen. code_verifier and the
// CSRF state token are stashed in sessionStorage — read back and cleared by
// completeAirtableOAuth() when Airtable redirects back to our callback route.
export async function startAirtableOAuth() {
  const clientId = import.meta.env.VITE_AIRTABLE_CLIENT_ID
  if (!clientId) throw new Error('Missing VITE_AIRTABLE_CLIENT_ID')

  const verifier = generateRandomToken()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateRandomToken()

  sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify({ verifier, state }))

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getAirtableRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `${AIRTABLE_AUTHORIZE_URL}?${params}`
}

// Exchanges the authorization code for tokens via the airtable-oauth Edge
// Function. Returns { access_token, refresh_token, expires_in } — the caller
// is responsible for persisting a connected_sources row once base/table/
// column mapping are chosen (this function only completes the OAuth leg).
export async function completeAirtableOAuth(code, state) {
  const stored = sessionStorage.getItem(PKCE_STORAGE_KEY)
  if (!stored) throw new Error('Missing OAuth session — please try connecting again.')

  const { verifier, state: expectedState } = JSON.parse(stored)
  sessionStorage.removeItem(PKCE_STORAGE_KEY)

  if (!state || state !== expectedState) {
    throw new Error('OAuth state mismatch — please try connecting again.')
  }

  const { data, error } = await supabase.functions.invoke('airtable-oauth', {
    body: {
      action: 'exchange',
      code,
      code_verifier: verifier,
      redirect_uri: getAirtableRedirectUri(),
    },
  })
  if (error) throw error
  return data
}

// CB_09: "Token refresh is attempted at the start of every For You session
// before any API calls are made." Called with a connected_sources row's
// refresh_token; caller persists the returned tokens back to that row.
export async function refreshAirtableToken(refreshTokenValue) {
  const { data, error } = await supabase.functions.invoke('airtable-oauth', {
    body: { action: 'refresh', refresh_token: refreshTokenValue },
  })
  if (error) throw error
  return data
}

async function airtableFetch(accessToken, path, params) {
  const url = new URL(`${AIRTABLE_API_BASE}${path}`)
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
    const error = new Error(body?.error?.message || `Airtable API error ${response.status}`)
    error.status = response.status
    throw error
  }

  return response.json()
}

export async function listAirtableBases(accessToken) {
  const data = await airtableFetch(accessToken, '/meta/bases')
  return data.bases ?? []
}

// Returns each table's id, name, and field list (id/name/type) — the field
// list is what column-mapping auto-detection scans in the next build step.
export async function listAirtableTables(accessToken, baseId) {
  const data = await airtableFetch(accessToken, `/meta/bases/${baseId}/tables`)
  return data.tables ?? []
}

export async function listAirtableRecords(accessToken, baseId, tableId, { pageSize = 20, offset } = {}) {
  const data = await airtableFetch(accessToken, `/${baseId}/${tableId}`, { pageSize, offset })
  return { records: data.records ?? [], offset: data.offset ?? null }
}
