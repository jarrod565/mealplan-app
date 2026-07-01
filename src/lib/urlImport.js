const DIRECT_FETCH_TIMEOUT_MS = 8000
const RECIPE_API_ROUTE = '/api/fetch-recipe'

export function isValidUrl(value) {
  if (!value || typeof value !== 'string') return false
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

export function normalizeUrl(value) {
  if (!value) return ''
  try {
    return new URL(value).toString()
  } catch {
    return value.trim()
  }
}

export function getSourceDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function isPinterestUrl(url) {
  try {
    return new URL(url).hostname.includes('pinterest')
  } catch {
    return false
  }
}

function extractMetaContent(html, propertyNames) {
  const normalized = html.replace(/\r/g, '')
  const patterns = propertyNames.map((name) => new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'))

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1]) return decodeHtmlEntities(match[1]).trim()
  }

  return null
}

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DIRECT_FETCH_TIMEOUT_MS)

  return fetch(url, { ...options, signal: controller.signal, redirect: 'follow' }).finally(() => {
    clearTimeout(timeout)
  })
}

function makeFetchError(type) {
  const error = new Error(type)
  error.type = type
  return error
}

export async function fetchRecipeMetadata(url) {
  const normalized = normalizeUrl(url)
  const targetUrl = normalized.startsWith('http') ? normalized : `https://${normalized}`
  const apiUrl = `${RECIPE_API_ROUTE}?url=${encodeURIComponent(targetUrl)}`

  try {
    const response = await fetchWithTimeout(apiUrl, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw makeFetchError('fetch_failed')
    }

    const data = await response.json()
    return {
      title: data.title || null,
      image_url: data.image_url || null,
      source_domain: data.source_domain || getSourceDomain(targetUrl),
      looksLikeRecipe: Boolean(data.looksLikeRecipe),
    }
  } catch (error) {
    if (error?.name === 'AbortError' || error?.type === 'timeout') {
      throw makeFetchError('timeout')
    }
    throw makeFetchError('fetch_failed')
  }
}
