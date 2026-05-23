import { CATEGORIES } from '@/lib/units'

function formatQuantity(qty) {
  if (qty == null) return ''
  if (Number.isInteger(qty)) return String(qty)
  return parseFloat(Number(qty).toFixed(2)).toString()
}

function formatItem(item) {
  const parts = []
  const qty = formatQuantity(item.quantity)
  if (qty) parts.push(qty)
  if (item.unit?.trim()) parts.push(item.unit.trim())
  parts.push(item.name)
  return parts.join(' ')
}

/**
 * Formats a shopping list as human-readable plain text for clipboard/share.
 * Copies unchecked items only; copies all if everything is checked.
 * Returns an empty string if there are no items to copy.
 */
export function formatListAsText(allItems) {
  if (!allItems.length) return ''

  const allChecked = allItems.every(i => i.checked)
  const source = allChecked ? allItems : allItems.filter(i => !i.checked)
  if (!source.length) return ''

  const lines = ['🛒 My Shopping List', '']

  for (const cat of CATEGORIES) {
    const catItems = source.filter(i => (i.category || 'Other') === cat)
    if (!catItems.length) continue
    lines.push(cat.toUpperCase())
    catItems.forEach(item => lines.push(formatItem(item)))
    lines.push('')
  }

  // Drop trailing blank line
  while (lines.at(-1) === '') lines.pop()

  return lines.join('\n')
}
