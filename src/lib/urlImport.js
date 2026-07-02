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

function decodeJsonLd(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed
  } catch {
    return null
  }
}

export function extractIngredientsFromJsonLd(html) {
  if (!html || typeof html !== 'string') return []

  const normalized = html.replace(/\r/g, '')
  const scriptMatches = normalized.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  const candidates = []

  for (const match of scriptMatches) {
    const decoded = decodeJsonLd(match[1])
    if (!decoded) continue

    candidates.push(decoded)

    if (Array.isArray(decoded)) {
      for (const item of decoded) {
        if (item && typeof item === 'object') candidates.push(item)
      }
    }
  }

  const recipeBlocks = candidates.filter((item) => item && typeof item === 'object' && (item['@type'] === 'Recipe' || item['@type'] === 'HowTo' || item['recipeIngredient']))

  for (const block of recipeBlocks) {
    const ingredientList = Array.isArray(block.recipeIngredient)
      ? block.recipeIngredient
      : Array.isArray(block.recipeIngredients)
        ? block.recipeIngredients
        : null

    if (Array.isArray(ingredientList)) {
      return ingredientList
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim())
    }
  }

  return []
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

    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }

    if (!response.ok) {
      if (data?.error || data?.details) {
        throw makeFetchError('page_unreadable')
      }
      throw makeFetchError('fetch_failed')
    }

    return {
      title: data?.title || null,
      image_url: data?.image_url || null,
      source_domain: data?.source_domain || getSourceDomain(targetUrl),
      looksLikeRecipe: Boolean(data?.looksLikeRecipe),
    }
  } catch (error) {
    if (error?.name === 'AbortError' || error?.type === 'timeout') {
      throw makeFetchError('timeout')
    }
    if (error?.type === 'page_unreadable') {
      throw makeFetchError('page_unreadable')
    }
    throw makeFetchError('fetch_failed')
  }
}

export async function fetchRecipeIngredients(url) {
  const normalized = normalizeUrl(url)
  const targetUrl = normalized.startsWith('http') ? normalized : `https://${normalized}`
  const apiUrl = `${RECIPE_API_ROUTE}?url=${encodeURIComponent(targetUrl)}`

  try {
    const response = await fetchWithTimeout(apiUrl, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw makeFetchError('page_unreadable')
    }

    const data = await response.json()
    const ingredients = Array.isArray(data?.ingredients) ? data.ingredients : []

    if (ingredients.length > 0) {
      return ingredients
    }

    throw makeFetchError('page_unreadable')
  } catch (error) {
    if (error?.name === 'AbortError' || error?.type === 'timeout') {
      throw makeFetchError('timeout')
    }
    if (error?.type === 'page_unreadable') {
      throw makeFetchError('page_unreadable')
    }
    throw makeFetchError('fetch_failed')
  }
}
