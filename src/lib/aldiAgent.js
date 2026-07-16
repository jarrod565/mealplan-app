// CB_17: formats the current shopping list into a deterministic prompt for
// Claude in Chrome. Pure function of its input — same list always produces
// the same prompt — so nothing here needs to be persisted.

function formatQuantity(qty) {
  if (qty == null) return ''
  if (Number.isInteger(qty)) return String(qty)
  return parseFloat(Number(qty).toFixed(2)).toString()
}

function formatItemLine(item) {
  const parts = []
  const qty = formatQuantity(item.quantity)
  if (qty) parts.push(qty)
  if (item.unit?.trim()) parts.push(item.unit.trim())
  const qtyPart = parts.join(' ')
  return qtyPart ? `- ${item.name} (${qtyPart})` : `- ${item.name}`
}

/**
 * Copies unchecked items only; falls back to the full list if everything is
 * checked — same convention as formatListAsText (CB_08). Returns an empty
 * string if there's nothing to send.
 */
export function buildAldiAgentPrompt(allItems) {
  if (!allItems?.length) return ''

  const allChecked = allItems.every((i) => i.checked)
  const source = allChecked ? allItems : allItems.filter((i) => !i.checked)
  if (!source.length) return ''

  const itemLines = source.map(formatItemLine).join('\n')

  return `You are helping add grocery items to an Aldi cart.

Here is the shopping list:
${itemLines}

Instructions:
1. Navigate to aldi.us/store/aldi/buy_it_again if not already there
2. Click "All items" tab
3. For each item on the list:
   a. Look for a matching product in Buy It Again
   b. If found, click the Add button
   c. If not found, search Aldi's main search for the item
   d. If a reasonable match is found in search, add it and note it as unverified
   e. If no match anywhere, add the item to your needs-review list
4. When finished, report back:
   - How many items were added from Buy It Again
   - How many items were added from general search (list each)
   - Which items could not be found (list each)
5. Do not proceed to checkout. Do not enter any payment information.`
}
