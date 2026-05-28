import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Formats an ingredient's quantity + unit for display.
 * Spoonacular returns "servings" as the unit for loose ingredients like salt
 * and spices — these are shown as "to taste" instead of a meaningless number.
 */
export function formatIngredientQty(amount, unit, extras) {
  if (unit?.toLowerCase() === 'servings') return 'to taste'
  const parts = []
  if (amount != null) {
    const rounded = Math.round(amount * 4) / 4
    parts.push(Number.isInteger(rounded) ? rounded : Number(rounded.toFixed(2)))
  }
  if (unit) parts.push(unit)
  let base = parts.join(' ')
  if (extras?.length) {
    const extrasStr = extras.map(({ quantity, unit: u }) => {
      const r = Math.round((quantity ?? 0) * 4) / 4
      const q = Number.isInteger(r) ? r : Number(r.toFixed(2))
      return u ? `${q} ${u}` : String(q)
    }).join(' + ')
    base = base ? `${base} + ${extrasStr}` : extrasStr
  }
  return base || ''
}
