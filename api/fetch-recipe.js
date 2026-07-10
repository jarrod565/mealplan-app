import { URL } from 'node:url'

// Pinterest appends tracking params to pin destination URLs (pins_campaign_id,
// pp, and sometimes utm_*/epik) that some recipe sites fail to render
// correctly for — the same URL works when fetched without them. Mirrors the
// stripping src/lib/pinterestAdapter.js applies before a URL is ever
// persisted; this is a safety net for URLs already stored with them
// attached (or any other caller that didn't strip them).
const TRACKING_PARAM_PATTERNS = [/^pins_/i, /^utm_/i, /^pp$/i, /^epik$/i]

function stripTrackingParams(parsedUrl) {
  for (const key of [...parsedUrl.searchParams.keys()]) {
    if (TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(key))) {
      parsedUrl.searchParams.delete(key)
    }
  }
  return parsedUrl
}

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

// Schema.org Recipe markup comes in two forms in the wild: JSON-LD (the
// `"@type": "Recipe"` pattern) and the older Microdata format
// (itemtype="https://schema.org/Recipe" on a container element). Some sites
// — including at least one WordPress recipe plugin configuration — only
// emit Microdata, with no JSON-LD block at all, so checking JSON-LD alone
// produces false negatives ("doesn't look like a recipe") on pages that
// genuinely are recipes.
function looksLikeRecipe(html) {
  if (/"@type"\s*:\s*"(Recipe|HowTo)"/i.test(html)) return true
  if (/itemtype\s*=\s*["'](?:https?:)?\/\/schema\.org\/(Recipe|HowTo)["']/i.test(html)) return true
  return false
}

// Extracts itemprop="recipeIngredient" text content for Microdata-marked-up
// pages. Regex-based (no DOM parser available in this runtime) — the
// backreference to the opening tag name keeps the match scoped to that
// element even if it has nested inline tags, and inner tags are stripped
// before decoding entities.
function extractMicrodataIngredients(html) {
  const matches = html.matchAll(/<([a-z0-9]+)([^>]*\bitemprop=["']recipeIngredient["'][^>]*)>([\s\S]*?)<\/\1>/gi)
  const ingredients = []

  for (const match of matches) {
    const text = decodeHtmlEntities(match[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
    if (text) ingredients.push(text)
  }

  return ingredients
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
      const jsonLdIngredients = ingredientList
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim())
      if (jsonLdIngredients.length > 0) return jsonLdIngredients
    }
  }

  // No JSON-LD ingredients found — try Microdata before giving up. Sites
  // that mark up the Recipe container via itemtype but only partially
  // implement it (e.g. no recipeIngredient itemprops at all) will still
  // return [] here, same as before; this only helps pages that actually
  // marked up their ingredient list this way.
  return extractMicrodataIngredients(normalized)
}

// Some recipe sites (WAFs, bot-protection plugins) block requests that
// self-identify as a bot or come from known server/datacenter user agents.
// A realistic desktop browser UA avoids the easy first-pass filter, though it
// won't help if a site blocks by IP range (e.g. Vercel/AWS) rather than UA.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': BROWSER_USER_AGENT,
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

const EMPTY_SPOONACULAR_RESULT = { ingredients: [], servings: null, title: null, image_url: null }

// Spoonacular's gateway occasionally returns a transient 5xx/network error even
// when the extraction itself would succeed — one quick retry clears most of these.
//
// Ingredient amounts in the extract response are for the recipe's own serving
// count (in `servings`), not pre-scaled per-serving — the caller must divide by
// this to scale, exactly once, by household serving size.
//
// Also carries title/image_url: Spoonacular's own infrastructure reaches many
// pages our direct fetchPage can't (WAF/IP-reputation/TLS-fingerprint blocking
// that no User-Agent header can get past), so the import step falls back to
// this same call for metadata rather than a second, separate request.
async function extractIngredientsFromSpoonacular(url) {
  const apiKey = process.env.VITE_SPOONACULAR_API_KEY
  if (!apiKey) return EMPTY_SPOONACULAR_RESULT

  const start = Date.now()

  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = SPOONACULAR_BUDGET_MS - (Date.now() - start)
    if (remaining < 500) return EMPTY_SPOONACULAR_RESULT

    try {
      const response = await requestSpoonacularExtract(url, apiKey, remaining)
      if (response.ok) {
        const data = await response.json()
        return {
          ingredients: parseSpoonacularIngredients(data),
          servings: typeof data?.servings === 'number' ? data.servings : null,
          title: typeof data?.title === 'string' && data.title.trim() ? data.title.trim() : null,
          image_url: typeof data?.image === 'string' && data.image.trim() ? data.image.trim() : null,
        }
      }
      if (response.status < 500) return EMPTY_SPOONACULAR_RESULT
    } catch {
      // network error or timeout — fall through to retry if budget remains
    }

    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, SPOONACULAR_RETRY_DELAY_MS))
  }

  return EMPTY_SPOONACULAR_RESULT
}

export default async function handler(request, response) {
  const { url, mode } = request.query ?? {}

  if (!url) {
    return response.status(400).json({ error: 'Missing url query parameter' })
  }

  try {
    const normalizedUrl = stripTrackingParams(new URL(url))

    if (mode === 'ingredients') {
      const spoonacular = await extractIngredientsFromSpoonacular(normalizedUrl.toString())
      if (spoonacular.ingredients.length > 0) {
        return response.status(200).json({ ingredients: spoonacular.ingredients, servings: spoonacular.servings, source: 'spoonacular' })
      }

      const html = await fetchPage(normalizedUrl.toString())
      // JSON-LD recipeIngredient entries are unstructured strings — no aisle/amount/unit
      // to extract, so those fields are left null and get categorized as "Other" downstream.
      // No reliable servings count either without further recipeYield parsing.
      const ingredients = extractIngredientsFromHtml(html).map((name) => ({
        id: null,
        name,
        original: name,
        amount: null,
        unit: null,
        aisle: null,
      }))
      return response.status(200).json({ ingredients, servings: null, source: 'json-ld' })
    }

    try {
      const html = await fetchPage(normalizedUrl.toString())
      const ingredients = extractIngredientsFromHtml(html)

      return response.status(200).json({
        title: extractTitle(html),
        image_url: extractImage(html),
        source_domain: normalizedUrl.hostname.replace(/^www\./, ''),
        looksLikeRecipe: looksLikeRecipe(html),
        ingredients,
      })
    } catch (pageError) {
      // Some sites block our direct fetch outright (WAF/IP-reputation/TLS
      // fingerprinting) regardless of User-Agent. Spoonacular's extract
      // endpoint reaches many of these from its own infrastructure — fall
      // back to it for title/image before giving up entirely.
      const spoonacular = await extractIngredientsFromSpoonacular(normalizedUrl.toString())
      if (!spoonacular.title) throw pageError

      return response.status(200).json({
        title: spoonacular.title,
        image_url: spoonacular.image_url,
        source_domain: normalizedUrl.hostname.replace(/^www\./, ''),
        looksLikeRecipe: true,
        ingredients: spoonacular.ingredients,
      })
    }
  } catch (error) {
    return response.status(502).json({
      error: 'Could not fetch recipe metadata',
      details: error.message,
    })
  }
}
