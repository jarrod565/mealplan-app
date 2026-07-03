import { URL } from 'node:url'

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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

function extractTitle(html) {
  const ogTitle = extractMetaContent(html, ['og:title', 'twitter:title'])
  if (ogTitle) return ogTitle

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return titleMatch?.[1]?.trim() || null
}

function extractImage(html) {
  return extractMetaContent(html, ['og:image', 'twitter:image'])
}

function looksLikeRecipe(html) {
  return /"@type"\s*:\s*"(Recipe|HowTo)"/i.test(html)
}

function decodeJsonLd(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function extractIngredientsFromHtml(html) {
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

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; DinderBot/1.0)',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`)
  }

  return response.text()
}

const SPOONACULAR_BASE = 'https://api.spoonacular.com'
const SPOONACULAR_BUDGET_MS = 6000
const SPOONACULAR_RETRY_DELAY_MS = 250

async function requestSpoonacularExtract(url, apiKey, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const apiUrl = `${SPOONACULAR_BASE}/recipes/extract?url=${encodeURIComponent(url)}&apiKey=${apiKey}`

  try {
    return await fetch(apiUrl, { headers: { Accept: 'application/json' }, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

// Preserve Spoonacular's structured fields (aisle/amount/unit/clean name) — the
// extract endpoint returns the same extendedIngredients shape as the recipe
// information endpoint, which CB_06 aggregation (parseIngredients) relies on
// for categorization, quantity math, and combining duplicates across meals.
function parseSpoonacularIngredients(data) {
  const extended = Array.isArray(data?.extendedIngredients) ? data.extendedIngredients : []

  return extended
    .filter((ingredient) => typeof ingredient?.original === 'string' && ingredient.original.trim())
    .map((ingredient) => ({
      id: ingredient.id ?? null,
      name: ingredient.nameClean || ingredient.name || ingredient.original.trim(),
      original: ingredient.original.trim(),
      amount: typeof ingredient.amount === 'number' ? ingredient.amount : null,
      unit: typeof ingredient.unit === 'string' ? ingredient.unit : '',
      aisle: ingredient.aisle || null,
    }))
}

// Spoonacular's gateway occasionally returns a transient 5xx/network error even
// when the extraction itself would succeed — one quick retry clears most of these.
async function extractIngredientsFromSpoonacular(url) {
  const apiKey = process.env.VITE_SPOONACULAR_API_KEY
  if (!apiKey) return []

  const start = Date.now()

  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = SPOONACULAR_BUDGET_MS - (Date.now() - start)
    if (remaining < 500) return []

    try {
      const response = await requestSpoonacularExtract(url, apiKey, remaining)
      if (response.ok) return parseSpoonacularIngredients(await response.json())
      if (response.status < 500) return []
    } catch {
      // network error or timeout — fall through to retry if budget remains
    }

    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, SPOONACULAR_RETRY_DELAY_MS))
  }

  return []
}

export default async function handler(request, response) {
  const { url, mode } = request.query ?? {}

  if (!url) {
    return response.status(400).json({ error: 'Missing url query parameter' })
  }

  try {
    const normalizedUrl = new URL(url)

    if (mode === 'ingredients') {
      const spoonacularIngredients = await extractIngredientsFromSpoonacular(normalizedUrl.toString())
      if (spoonacularIngredients.length > 0) {
        return response.status(200).json({ ingredients: spoonacularIngredients, source: 'spoonacular' })
      }

      const html = await fetchPage(normalizedUrl.toString())
      // JSON-LD recipeIngredient entries are unstructured strings — no aisle/amount/unit
      // to extract, so those fields are left null and get categorized as "Other" downstream.
      const ingredients = extractIngredientsFromHtml(html).map((name) => ({
        id: null,
        name,
        original: name,
        amount: null,
        unit: null,
        aisle: null,
      }))
      return response.status(200).json({ ingredients, source: 'json-ld' })
    }

    const html = await fetchPage(normalizedUrl.toString())
    const ingredients = extractIngredientsFromHtml(html)

    return response.status(200).json({
      title: extractTitle(html),
      image_url: extractImage(html),
      source_domain: normalizedUrl.hostname.replace(/^www\./, ''),
      looksLikeRecipe: looksLikeRecipe(html),
      ingredients,
    })
  } catch (error) {
    return response.status(502).json({
      error: 'Could not fetch recipe metadata',
      details: error.message,
    })
  }
}
