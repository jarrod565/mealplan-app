// CB_12: Airtable OAuth 2.0 token exchange + refresh.
//
// Holds AIRTABLE_CLIENT_SECRET — this must never reach the client bundle,
// which is why the exchange/refresh calls happen here rather than in
// api/fetch-recipe.js (a Vercel function, and the only precedent for
// server-side code in this repo, but it holds no genuine secrets today).
// Mirrors the create-checkout-session Edge Function's auth/CORS pattern.
//
// Airtable requires PKCE for the authorization_code grant; the client
// generates the code_verifier/code_challenge pair and only ever sends the
// verifier here, never the client secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const AIRTABLE_TOKEN_URL = 'https://airtable.com/oauth2/v1/token'
const CLIENT_ID = Deno.env.get('AIRTABLE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('AIRTABLE_CLIENT_SECRET') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function basicAuthHeader() {
  return `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`
}

async function exchangeCode({ code, code_verifier, redirect_uri }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri,
    client_id: CLIENT_ID,
    code_verifier,
  })

  const response = await fetch(AIRTABLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(),
    },
    body,
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'Airtable token exchange failed')
  }
  return data
}

async function refreshToken({ refresh_token }) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token,
    client_id: CLIENT_ID,
  })

  const response = await fetch(AIRTABLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(),
    },
    body,
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'Airtable token refresh failed')
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
      return jsonResponse({ error: 'Airtable OAuth is not configured' }, 500)
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
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
      })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (err) {
    console.error('airtable-oauth error:', err)
    return jsonResponse({ error: err.message || 'Internal server error' }, 500)
  }
})
