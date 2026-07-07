// ── CB_12 Airtable adapter ─────────────────────────────────────────────────────
// Converts raw Airtable records + a connection into the generic card shape
// ConnectedSourceCard renders, and resolves missing metadata via the CB_10
// extraction pipeline. This is the only file that knows Airtable's record
// shape — the deck, the card component, and the basket never do.

import { getSourceFeatureFlags } from '@/lib/connectedSources'
import { resolveFieldValue } from '@/lib/airtableMapping'
import { fetchRecipeMetadata } from '@/lib/urlImport'

// meal_id is stable across sessions (unlike url_import's synthetic, one-time
// IDs) since it's built from the Airtable record's own permanent id — so
// Airtable meals go through BasketContext's normal upsert path, get real
// Favorites support, and dedup in History exactly like Spoonacular meals,
// with no special-casing anywhere in those systems.
export function airtableMealId(connectionId, recordId) {
  return `airtable:${connectionId}:${recordId}`
}

// record: Airtable record ({ id, fields: { [columnName]: value } })
// connection: persisted connected_sources row (base_name, table_name, column_mapping)
export function airtableRecordToCard(record, connection) {
  const mapping = connection.column_mapping ?? {}

  function mappedValue(role) {
    const columnName = mapping[role]
    if (!columnName) return null
    // No field schema available here (only column names were persisted) —
    // resolveFieldValue duck-types Attachment-shaped values from the raw
    // value itself when field is omitted.
    return resolveFieldValue(undefined, record.fields?.[columnName])
  }

  return {
    card_id: record.id,
    meal_id: airtableMealId(connection.id, record.id),
    source_type: 'airtable',
    connection_id: connection.id,
    title: mappedValue('title'),
    image_url: mappedValue('image'),
    destination_url: mappedValue('url'),
    source_footer: `${connection.base_name} / ${connection.table_name}`,
    featureFlags: getSourceFeatureFlags('airtable'),
  }
}

// CB_12: "1. mapped image column, 2. mapped title column, 3. if either is
// missing or invalid, fall back to the CB_10 Open Graph extraction pipeline
// using the destination URL." Called lazily per card as it's about to be
// served, not pre-fetched for the whole batch.
//
// Always returns metadataResolved: true, even when the OG fallback can't
// find an image — callers (useForYouDeck) use that flag, not a truthiness
// check on image_url, to decide whether a card still needs resolving. A
// truthiness check would retry forever on a card that genuinely has no
// image anywhere, since image_url would stay null across every attempt.
export async function resolveCardMetadata(card) {
  if (card.metadataResolved) return card
  if ((card.title && card.image_url) || !card.destination_url) {
    return { ...card, title: card.title || 'Untitled recipe', metadataResolved: true }
  }

  try {
    const metadata = await fetchRecipeMetadata(card.destination_url)
    return {
      ...card,
      title: card.title || metadata.title || 'Untitled recipe',
      image_url: card.image_url || metadata.image_url || null,
      metadataResolved: true,
    }
  } catch {
    return { ...card, title: card.title || 'Untitled recipe', metadataResolved: true }
  }
}
