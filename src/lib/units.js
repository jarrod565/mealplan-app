// ── Unit normalization and ingredient aggregation ─────────────────────────────

// Volume base unit: tsp
const VOLUME_TO_TSP = {
  tsp: 1, teaspoon: 1, teaspoons: 1,
  tbsp: 3, tablespoon: 3, tablespoons: 3,
  'fl oz': 6, 'fluid ounce': 6, 'fluid ounces': 6,
  cup: 48, cups: 48,
  pint: 96, pints: 96,
  quart: 192, quarts: 192,
  gallon: 768, gallons: 768,
  ml: 0.202884, milliliter: 0.202884, milliliters: 0.202884,
  millilitre: 0.202884, millilitres: 0.202884,
  l: 202.884, liter: 202.884, liters: 202.884,
  litre: 202.884, litres: 202.884,
}

// Weight base unit: oz
const WEIGHT_TO_OZ = {
  oz: 1, ounce: 1, ounces: 1,
  lb: 16, lbs: 16, pound: 16, pounds: 16,
  g: 0.035274, gram: 0.035274, grams: 0.035274,
  kg: 35.274, kilogram: 35.274, kilograms: 35.274,
}

// Count: whole items with no unit or unit that just describes the item
const COUNT_UNITS = new Set([
  '', 'whole', 'each', 'large', 'medium', 'small',
  'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces',
  'fillet', 'fillets', 'stalk', 'stalks', 'sprig', 'sprigs',
  'leaf', 'leaves', 'head', 'heads', 'ear', 'ears',
  'strip', 'strips',
])

function getUnitFamily(unit) {
  const u = unit.toLowerCase().trim()
  if (VOLUME_TO_TSP[u] !== undefined) return 'volume'
  if (WEIGHT_TO_OZ[u] !== undefined) return 'weight'
  if (COUNT_UNITS.has(u)) return 'count'
  return u // "bunch", "can", "package", etc. — treated as opaque unit family
}

function toBaseTsp(amount, unit) {
  const u = unit.toLowerCase().trim()
  return amount * (VOLUME_TO_TSP[u] ?? 1)
}

function toBaseOz(amount, unit) {
  const u = unit.toLowerCase().trim()
  return amount * (WEIGHT_TO_OZ[u] ?? 1)
}

function round(n, dec = 1) {
  const f = Math.pow(10, dec)
  return Math.round(n * f) / f
}

function displayVolume(tsp) {
  if (tsp < 3) return { quantity: round(tsp, 2), unit: 'tsp' }
  if (tsp < 12) return { quantity: round(tsp / 3, 1), unit: 'tbsp' }
  const cups = tsp / 48
  if (cups < 4) {
    const q = Math.round(cups * 4) / 4
    return { quantity: q, unit: q <= 1 ? 'cup' : 'cups' }
  }
  const quarts = cups / 4
  return { quantity: round(quarts, 1), unit: quarts <= 1 ? 'quart' : 'quarts' }
}

function displayWeight(oz) {
  if (oz < 16) return { quantity: round(oz, 1), unit: 'oz' }
  return { quantity: round(oz / 16, 2), unit: 'lbs' }
}

function fromBase(baseAmount, family) {
  if (family === 'volume') return displayVolume(baseAmount)
  if (family === 'weight') return displayWeight(baseAmount)
  if (family === 'count') return { quantity: round(baseAmount, 1), unit: '' }
  return { quantity: round(baseAmount, 1), unit: family }
}

// Spoonacular aisle → display category
export function aisleToCategory(aisle) {
  if (!aisle) return 'Other'
  const a = aisle.toLowerCase()
  if (a.includes('produce') || a.includes('vegetable') || a.includes('fruit') || a.includes('herb')) return 'Produce'
  if (a.includes('meat') || a.includes('seafood') || a.includes('fish') || a.includes('poultry')) return 'Meat & Seafood'
  if (a.includes('dairy') || a.includes('cheese') || a.includes('milk') || a.includes('egg')) return 'Dairy & Eggs'
  if (a.includes('frozen')) return 'Frozen'
  if (a.includes('bakery') || a.includes('bread')) return 'Bakery'
  if (a.includes('beverage') || a.includes('drink') || a.includes('juice') ||
      a.includes('coffee') || a.includes('tea') || a.includes('alcohol')) return 'Beverages'
  // Pantry: spices, condiments, oils, pasta, canned, baking, dry goods, grains
  if (a.includes('spice') || a.includes('seasoning') || a.includes('condiment') ||
      a.includes('oil') || a.includes('vinegar') || a.includes('pasta') ||
      a.includes('rice') || a.includes('grain') || a.includes('canned') ||
      a.includes('baking') || a.includes('dry') || a.includes('sauce') ||
      a.includes('cereal') || a.includes('nut') || a.includes('flour') ||
      a.includes('sugar') || a.includes('salt')) return 'Pantry & Dry Goods'
  return 'Other'
}

export const CATEGORIES = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Pantry & Dry Goods',
  'Bakery',
  'Frozen',
  'Beverages',
  'Other',
]

/**
 * Combines ingredients from multiple meals into a single aggregated list.
 * contributions: [{ mealId, ingredients: [{ id, name, amount, unit, aisle }], multiplier }]
 */
export function aggregateIngredients(contributions) {
  // map key: `normalizedName::family`
  const map = new Map()

  for (const { mealId, ingredients, multiplier } of contributions) {
    for (const ing of ingredients) {
      const normalizedName = ing.name.toLowerCase().trim().replace(/\s+/g, ' ')
      const unit = (ing.unit ?? '').trim()
      const family = getUnitFamily(unit)
      const scaledAmount = (ing.amount ?? 0) * multiplier
      const key = `${normalizedName}::${family}`

      if (map.has(key)) {
        const entry = map.get(key)
        if (family === 'volume') {
          entry.baseAmount += toBaseTsp(scaledAmount, unit)
        } else if (family === 'weight') {
          entry.baseAmount += toBaseOz(scaledAmount, unit)
        } else {
          entry.baseAmount += scaledAmount
        }
        if (!entry.sourceMealIds.includes(mealId)) {
          entry.sourceMealIds.push(mealId)
        }
      } else {
        let baseAmount
        if (family === 'volume') baseAmount = toBaseTsp(scaledAmount, unit)
        else if (family === 'weight') baseAmount = toBaseOz(scaledAmount, unit)
        else baseAmount = scaledAmount

        map.set(key, {
          id: key,
          name: ing.name,
          baseAmount,
          family,
          category: aisleToCategory(ing.aisle),
          isCustom: false,
          sourceMealIds: [mealId],
        })
      }
    }
  }

  return Array.from(map.values()).map(entry => {
    const { quantity, unit } = fromBase(entry.baseAmount, entry.family)
    return {
      id: entry.id,
      name: entry.name,
      quantity,
      unit,
      category: entry.category,
      isCustom: entry.isCustom,
      sourceMealIds: entry.sourceMealIds,
    }
  })
}
