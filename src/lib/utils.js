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
export function formatIngredientQty(amount, unit) {
  if (unit?.toLowerCase() === 'servings') return 'to taste'
  const parts = []
  if (amount != null) {
    const rounded = Math.round(amount * 4) / 4
    parts.push(Number.isInteger(rounded) ? rounded : Number(rounded.toFixed(2)))
  }
  if (unit) parts.push(unit)
  return parts.join(' ')
}
