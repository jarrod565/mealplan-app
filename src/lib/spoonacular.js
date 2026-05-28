// ── Spoonacular API helpers ───────────────────────────────────────────────────
// All API calls are made client-side. API key is read from VITE_SPOONACULAR_API_KEY.
// Ingredient data is fetched LAZILY — only when the user taps a card to expand it.

const BASE = 'https://api.spoonacular.com'

function apiKey() {
  const key = import.meta.env.VITE_SPOONACULAR_API_KEY
  if (!key) throw new Error('Missing VITE_SPOONACULAR_API_KEY')
  return key
}

function deriveDifficulty(readyInMinutes) {
  if (readyInMinutes <= 20) return 'Easy'
  if (readyInMinutes <= 45) return 'Medium'
  return 'Hard'
}

function toMeal(result) {
  return {
    meal_id: String(result.id),
    name: result.title,
    photo_url: result.image ?? null,
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
 * Fetches full ingredient details for a single meal.
 * Called lazily when the user taps a card to expand it.
 * Returns { ingredients, difficulty, servings }.
 */
export async function fetchMealDetails(mealId) {
  const params = new URLSearchParams({
    apiKey: apiKey(),
    includeNutrition: 'false',
  })

  const res = await fetch(`${BASE}/recipes/${mealId}/information?${params}`)
  if (!res.ok) {
    throw new Error(`Spoonacular error ${res.status} for meal ${mealId}`)
  }

  const data = await res.json()

  const ingredients = (data.extendedIngredients ?? []).map((ing) => ({
    id: ing.id,
    name: ing.name,
    original: ing.original,
    amount: ing.amount,
    unit: ing.unit,
    aisle: ing.aisle ?? 'Other',
  }))

  return {
    ingredients,
    servings: data.servings ?? null,
    difficulty: data.readyInMinutes ? deriveDifficulty(data.readyInMinutes) : null,
  }
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
