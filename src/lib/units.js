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

// Strip unit abbreviations that Spoonacular sometimes embeds at the start of a name
function stripUnitPrefix(name) {
  return name.trim().replace(/^(fl\s+oz|oz|lbs?|kg|g|tbsp|tsp|ml|l)\s+/i, '').trim()
}

function getUnitFamily(unit) {
  const u = unit.toLowerCase().trim()
  if (u === 'serving' || u === 'servings') return 'taste'
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
  // Cups stay cups up through a half gallon (8 cups) — a more practical grocery
  // unit than quarts at that range. Only switch to quarts beyond that.
  if (cups <= 8) {
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
  // Spices & Seasonings: split out of Pantry so these skippable items can be
  // visually grouped and bulk-skipped/removed at the bottom of the list
  if (a.includes('spice') || a.includes('seasoning')) return 'Spices & Seasonings'
  // Pantry: condiments, oils, pasta, canned, baking, dry goods, grains
  if (a.includes('condiment') ||
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
  'Spices & Seasonings',
  'Bakery',
  'Frozen',
  'Beverages',
  'Other',
]

function uniqueIds(arrays) {
  return [...new Set(arrays.flat())]
}

/**
 * Combines ingredients from multiple meals into a single aggregated list.
 * contributions: [{ mealId, ingredients: [{ id, name, amount, unit, aisle }], multiplier }]
 *
 * Returned items may include an `extras` array for cross-family quantities
 * (e.g. onion measured as count in one recipe and cups in another).
 */
export function aggregateIngredients(contributions) {
  // Pass 1: accumulate per normalizedName::family
  const map = new Map()

  for (const { mealId, ingredients, multiplier } of contributions) {
    for (const ing of ingredients) {
      const displayName = stripUnitPrefix(ing.name ?? '')
      const normalizedName = displayName.toLowerCase().replace(/\s+/g, ' ')
      const unit = (ing.unit ?? '').trim()
      const family = getUnitFamily(unit)
      const scaledAmount = (ing.amount ?? 0) * multiplier
      const key = `${normalizedName}::${family}`

      if (map.has(key)) {
        const entry = map.get(key)
        if (family === 'volume') entry.baseAmount += toBaseTsp(scaledAmount, unit)
        else if (family === 'weight') entry.baseAmount += toBaseOz(scaledAmount, unit)
        else if (family !== 'taste') entry.baseAmount += scaledAmount
        if (!entry.sourceMealIds.includes(mealId)) entry.sourceMealIds.push(mealId)
      } else {
        let baseAmount
        if (family === 'volume') baseAmount = toBaseTsp(scaledAmount, unit)
        else if (family === 'weight') baseAmount = toBaseOz(scaledAmount, unit)
        else if (family === 'taste') baseAmount = null
        else baseAmount = scaledAmount

        map.set(key, {
          id: key,
          name: displayName,
          normalizedName,
          baseAmount,
          family,
          category: aisleToCategory(ing.aisle),
          isCustom: false,
          sourceMealIds: [mealId],
        })
      }
    }
  }

  // Pass 2: group by normalizedName to detect cross-family duplicates
  const byName = new Map()
  for (const entry of map.values()) {
    const group = byName.get(entry.normalizedName)
    if (group) group.push(entry)
    else byName.set(entry.normalizedName, [entry])
  }

  const result = []
  for (const entries of byName.values()) {
    const tasteEntries = entries.filter(e => e.family === 'taste')
    const numericEntries = entries.filter(e => e.family !== 'taste')

    if (numericEntries.length === 0) {
      // All to-taste — emit a single "to taste" line
      const first = tasteEntries[0]
      result.push({
        id: first.id,
        name: first.name,
        quantity: null,
        unit: 'servings',
        category: first.category,
        isCustom: false,
        sourceMealIds: uniqueIds(entries.map(e => e.sourceMealIds)),
      })
    } else if (numericEntries.length === 1) {
      const entry = numericEntries[0]
      const { quantity, unit } = fromBase(entry.baseAmount, entry.family)
      result.push({
        id: entry.id,
        name: entry.name,
        quantity,
        unit,
        category: entry.category,
        isCustom: false,
        sourceMealIds: entry.sourceMealIds,
      })
    } else {
      // Multiple numeric families — primary + extras displayed as "2.5 + 1.5 cups"
      const primary = numericEntries[0]
      const { quantity, unit } = fromBase(primary.baseAmount, primary.family)
      const extras = numericEntries.slice(1).map(e => {
        const { quantity: q, unit: u } = fromBase(e.baseAmount, e.family)
        return { quantity: q, unit: u }
      })
      result.push({
        id: primary.id,
        name: primary.name,
        quantity,
        unit,
        extras,
        category: primary.category,
        isCustom: false,
        sourceMealIds: uniqueIds(numericEntries.map(e => e.sourceMealIds)),
      })
    }
  }

  return result
}
