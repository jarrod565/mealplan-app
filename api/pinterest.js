// ── Pinterest API proxy (CB_09) ──────────────────────────────────────────────
// Pinterest's v5 REST API does not send CORS headers, so browser-side fetch()
// calls to api.pinterest.com are blocked outright. This mirrors the
// fetch-recipe.js pattern: the browser calls this same-origin Vercel function,
// which makes the real request server-side and relays the response back.
//
// The access token itself still belongs to the user's own Pinterest
// connection (exchanged via supabase/functions/pinterest-oauth) — this proxy
// never sees or stores Pinterest client credentials, it just forwards a
// bearer token the caller already holds.

const PINTEREST_API_BASE = 'https://api.pinterest.com/v5'

// This proxy takes a caller-supplied access_token and forwards it wherever
// `path` points, so `path` must be restricted to the exact endpoints this
// app actually calls — otherwise it's an open relay for any Pinterest API
// call under whatever token gets posted to it.
const ALLOWED_PATH_PATTERNS = [
  /^\/boards$/,
  /^\/boards\/[^/]+\/pins$/,
  /^\/pins\/[^/]+$/,
]

function isAllowedPath(path) {
  return ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(path))
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const { access_token, path, params } = request.body ?? {}

  if (!access_token || typeof access_token !== 'string') {
    return response.status(400).json({ error: 'Missing access_token' })
  }
  if (!path || typeof path !== 'string' || !isAllowedPath(path)) {
    return response.status(400).json({ error: 'Invalid or unsupported Pinterest API path' })
  }

  const url = new URL(`${PINTEREST_API_BASE}${path}`)
  if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      if (value != null) url.searchParams.set(key, String(value))
    }
  }

  try {
    const pinterestResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    const data = await pinterestResponse.json().catch(() => null)

    if (!pinterestResponse.ok) {
      return response
        .status(pinterestResponse.status)
        .json(data ?? { message: `Pinterest API error ${pinterestResponse.status}` })
    }

    return response.status(200).json(data)
  } catch (error) {
    return response.status(502).json({ error: 'Could not reach Pinterest', details: error.message })
  }
}
