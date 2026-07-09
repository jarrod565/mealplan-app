// CB_09: Pinterest OAuth 2.0 (API v5) token exchange + refresh.
//
// Mirrors supabase/functions/airtable-oauth/index.ts exactly, per
// PINTEREST.md's explicit decision to reuse that pattern: PKCE flow,
// server-side token exchange (PINTEREST_CLIENT_SECRET never reaches the
// client bundle), and the same exchange/refresh action shape. Pinterest's
// v5 API doesn't require PKCE the way Airtable does, but supports it —
// keeping it here trades nothing for a real security upside and keeps
// this function a straight mirror of the Airtable one.
//
// Pinterest specifics:
//   - Token endpoint: https://api.pinterest.com/v5/oauth/token
//   - Auth: HTTP Basic (client_id:client_secret), same as Airtable
//   - Access tokens last 30 days; refresh tokens last up to 1 year
//   - Scopes requested client-side: boards:read pins:read user_accounts:read

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const PINTEREST_TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token'
const CLIENT_ID = Deno.env.get('PINTEREST_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('PINTEREST_CLIENT_SECRET') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function basicAuthHeader() {
  return `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`
}

async function exchangeCode({ code, code_verifier, redirect_uri }: {
  code: string
  code_verifier: string
  redirect_uri: string
}) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri,
    code_verifier,
  })

  const response = await fetch(PINTEREST_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(),
    },
    body,
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || data?.error || 'Pinterest token exchange failed')
  }
  return data
}

async function refreshToken({ refresh_token }: { refresh_token: string }) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token,
  })

  const response = await fetch(PINTEREST_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(),
    },
    body,
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || data?.error || 'Pinterest token refresh failed')
  }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return jsonResponse({ error: 'Pinterest OAuth is not configured' }, 500)
    }

    const payload = await req.json()

    if (payload.action === 'exchange') {
      const tokens = await exchangeCode(payload)
      return jsonResponse({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
      })
    }

    if (payload.action === 'refresh') {
      const tokens = await refreshToken(payload)
      return jsonResponse({
        access_token: tokens.access_token,
        // Pinterest may omit refresh_token on a refresh response (the
        // original refresh token just stays valid) — fall back to the one
        // the caller sent so updateConnectionTokens never gets a blank value.
        refresh_token: tokens.refresh_token ?? payload.refresh_token,
        expires_in: tokens.expires_in,
      })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (err) {
    console.error('pinterest-oauth error:', err)
    return jsonResponse({ error: err.message || 'Internal server error' }, 500)
  }
})
