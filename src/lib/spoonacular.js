// ── Spoonacular API helpers ───────────────────────────────────────────────────
// All API calls are made client-side. API key is read from VITE_SPOONACULAR_API_KEY.

import { fetchRecipeIngredients } from '@/lib/urlImport'

const BASE = 'https://api.spoonacular.com'

// complexSearch with addRecipeInformation=true already returns extendedIngredients.
// We cache that data here so the Ingredients page avoids a second per-recipe fetch.
const ingredientCache = new Map()

function apiKey() {
  const key = import.meta.env.VITE_SPOONACULAR_API_KEY
  if (!key) throw new Error('Missing VITE_SPOONACULAR_API_KEY')
  return key
}

// Spoonacular recipe image URLs contain a size segment like "312x231".
// Swap it for the largest reliably available variant.
const IMAGE_SIZE_RE = /\d+x\d+/
function upgradeImageSize(url) {
  if (!url) return url
  return url.replace(IMAGE_SIZE_RE, '636x393')
}

function deriveDifficulty(readyInMinutes) {
  if (readyInMinutes <= 20) return 'Easy'
  if (readyInMinutes <= 45) return 'Medium'
  return 'Hard'
}

function parseIngredients(extendedIngredients) {
  return (extendedIngredients ?? []).map((ing) => ({
    id: ing.id,
    name: ing.name,
    original: ing.original,
    amount: ing.amount,
    unit: ing.unit,
    aisle: ing.aisle ?? 'Other',
  }))
}

// Accepts either the structured objects returned by /api/fetch-recipe (Spoonacular
// extract or JSON-LD, both { name, original, amount, unit, aisle }) or plain name
// strings (legacy persisted format), normalizing both into the same shape
// parseIngredients() produces so CB_06 aggregation can categorize, compute
// quantities, and combine duplicates identically to regular Spoonacular meals.
function parseUrlImportIngredients(items) {
  return (items ?? []).filter(Boolean).map((item, index) => {
    if (typeof item === 'string') {
      return { id: `url-import-${index}`, name: item, original: item, amount: null, unit: null, aisle: 'Other' }
    }
    return {
      id: item.id ?? `url-import-${index}`,
      name: item.name || item.original || `Ingredient ${index + 1}`,
      original: item.original || item.name || '',
      amount: typeof item.amount === 'number' ? item.amount : null,
      unit: item.unit || null,
      aisle: item.aisle || 'Other',
    }
  })
}

function toMeal(result) {
  // Pre-populate the cache from batch data so the Ingredients page
  // doesn't need a second per-recipe API call for recently swiped meals.
  if (result.extendedIngredients?.length) {
    ingredientCache.set(String(result.id), {
      ingredients: parseIngredients(result.extendedIngredients),
      servings: result.servings ?? null,
      difficulty: result.readyInMinutes ? deriveDifficulty(result.readyInMinutes) : null,
    })
  }
  return {
    meal_id: String(result.id),
    name: result.title,
    photo_url: upgradeImageSize(result.image ?? null),
    prep_time: result.readyInMinutes ?? null,
    servings: result.servings ?? null,
    difficulty: result.readyInMinutes ? deriveDifficulty(result.readyInMinutes) : null,
  }
}

/**
 * Fetches a batch of 20–25 meals from Spoonacular.
 * Applies dietary filters from CB_02. Returns an array of meal objects.
 */
export async function fetchMealBatch(dietParams = {}) {
  const params = new URLSearchParams({
    apiKey: apiKey(),
    number: '5',
    type: 'main course',
    addRecipeInformation: 'true',
    instructionsRequired: 'true',
    sort: 'random',
    ...dietParams,
  })

  const res = await fetch(`${BASE}/recipes/complexSearch?${params}`)
  if (!res.ok) {
    if (res.status === 402) {
      throw new Error('Spoonacular daily quota exceeded. Try again tomorrow.')
    }
    const text = await res.text().catch(() => '')
    throw new Error(`Spoonacular error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return (data.results ?? []).map(toMeal)
}

/**
 * Returns ingredient details for a meal. Checks the batch cache first (populated
 * when the meal was fetched in complexSearch), falling back to a per-recipe call.
 */
export async function fetchMealDetails(mealId, meal = null) {
  console.log('[spoonacular] fetchMealDetails', { mealId, source_type: meal?.source_type })

  if (ingredientCache.has(mealId)) {
    console.log('[spoonacular] returning from ingredientCache for', mealId)
    return ingredientCache.get(mealId)
  }

  // If the meal row already contains persisted extracted ingredients, use them
  if (meal?.extracted_ingredients && Array.isArray(meal.extracted_ingredients) && meal.extracted_ingredients.length > 0) {
    console.log('[spoonacular] using persisted extracted_ingredients for', mealId)
    const details = {
      ingredients: parseUrlImportIngredients(meal.extracted_ingredients),
      servings: meal.extracted_servings ?? null,
      difficulty: meal.extracted_difficulty ?? null,
      source_type: 'url_import',
      source_url: meal.destination_url || meal.destinationUrl || meal.url || null,
    }
    ingredientCache.set(mealId, details)
    return details
  }

  if (meal?.source_type === 'url_import') {
    const url = meal.destination_url || meal.destinationUrl || meal.url || null
    if (!url) {
      throw new Error('URL import is missing a destination URL')
    }

    console.log('[spoonacular] url_import branch for', mealId, 'url=', url)
    try {
      console.log('[spoonacular] calling fetchRecipeIngredients for', url)
      const ingredients = await fetchRecipeIngredients(url)
      const details = {
        ingredients: parseUrlImportIngredients(ingredients),
        servings: null,
        difficulty: null,
        source_type: 'url_import',
        source_url: url,
      }
      ingredientCache.set(mealId, details)

      // TODO(future optimization): persist extracted ingredients back to the basket
      // row so subsequent opens and the Ingredients page can reuse the cached data.
      // Requires running migrations/007_add_extracted_ingredients.sql against the
      // hosted Supabase project first (extracted_ingredients/extracted_at columns
      // don't exist there yet, which was causing a 400 on this write). For now we
      // re-fetch from Spoonacular on each open.

      return details
    } catch (err) {
      console.log('[spoonacular] url_import fetch failed for', mealId, err)
      throw new Error('URL import ingredients unavailable')
    }
  }

  const params = new URLSearchParams({
    apiKey: apiKey(),
    includeNutrition: 'false',
  })

  const res = await fetch(`${BASE}/recipes/${mealId}/information?${params}`)
  if (!res.ok) {
    throw new Error(`Spoonacular error ${res.status} for meal ${mealId}`)
  }

  const data = await res.json()
  const details = {
    ingredients: parseIngredients(data.extendedIngredients),
    servings: data.servings ?? null,
    difficulty: data.readyInMinutes ? deriveDifficulty(data.readyInMinutes) : null,
  }

  ingredientCache.set(mealId, details)
  return details
}

// ── CB_02 restriction ↔ Spoonacular param mapping ────────────────────────────

const RESTRICTION_MAP = {
  vegetarian:     { type: 'diet',        value: 'Vegetarian' },
  vegan:          { type: 'diet',        value: 'Vegan' },
  ketogenic:      { type: 'diet',        value: 'Ketogenic' },
  paleo:          { type: 'diet',        value: 'Paleo' },
  gluten_free:    { type: 'diet',        value: 'Gluten Free' },
  dairy_free:     { type: 'intolerance', value: 'Dairy' },
  nut_free:       { type: 'intolerance', value: 'Tree Nut' },
  peanut_free:    { type: 'intolerance', value: 'Peanut' },
  shellfish_free: { type: 'intolerance', value: 'Shellfish' },
  egg_free:       { type: 'intolerance', value: 'Egg' },
  soy_free:       { type: 'intolerance', value: 'Soy' },
}

export function buildSpoonacularDietParams(restrictions = []) {
  const diets = []
  const intolerances = []

  for (const key of restrictions) {
    const mapping = RESTRICTION_MAP[key]
    if (!mapping) continue
    if (mapping.type === 'diet') diets.push(mapping.value)
    else intolerances.push(mapping.value)
  }

  const params = {}
  if (diets.length > 0) params.diet = diets.join(',')
  if (intolerances.length > 0) params.intolerances = intolerances.join(',')
  return params
}

export const SUPPORTED_RESTRICTIONS = [
  { key: 'vegetarian',     label: 'Vegetarian' },
  { key: 'vegan',          label: 'Vegan' },
  { key: 'gluten_free',    label: 'Gluten-Free' },
  { key: 'dairy_free',     label: 'Dairy-Free' },
  { key: 'nut_free',       label: 'Nut-Free (Tree Nuts)' },
  { key: 'peanut_free',    label: 'Peanut-Free' },
  { key: 'shellfish_free', label: 'Shellfish-Free' },
  { key: 'egg_free',       label: 'Egg-Free' },
  { key: 'soy_free',       label: 'Soy-Free' },
  { key: 'ketogenic',      label: 'Ketogenic' },
  { key: 'paleo',          label: 'Paleo' },
]
