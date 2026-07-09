// ── CB_09 Pinterest adapter ───────────────────────────────────────────────────
// Converts raw Pinterest pin API responses + a connection into the generic
// card shape ConnectedSourceCard renders. This is the only file that knows
// Pinterest's pin/board response shape — the deck, the card component, and
// the basket never do.
//
// Unlike the Airtable adapter, Pinterest cards need no CB_10 metadata
// resolution pass — title, image, and board name come straight off the
// Pinterest API response fetched this session, so every card is created
// already resolved.

import { getSourceFeatureFlags } from '@/lib/connectedSources'

// meal_id doubles as the basket dedup key (CB_09: "Dedup key: pin_id — use
// pinterest:${pinId} as the meal_id format in the basket").
export function pinterestMealId(pinId) {
  return `pinterest:${pinId}`
}

// pin: raw Pinterest pin object ({ id, title, media, link, board_id })
// connection: persisted connected_sources row
// boardName: fetched fresh from the Pinterest API this session — held in
// React state only by the caller, never persisted (CB_09 policy).
export function pinterestPinToCard(pin, connection, boardName) {
  return {
    card_id: pin.id,
    pin_id: pin.id,
    meal_id: pinterestMealId(pin.id),
    source_type: 'pinterest',
    connection_id: connection.id,
    title: pin.title || pin.description || 'Untitled pin',
    image_url: pin.media?.images?.original?.url ?? null,
    destination_url: pin.link ?? null,
    source_footer: boardName ? `Pinterest / ${boardName}` : 'Pinterest',
    featureFlags: getSourceFeatureFlags('pinterest'),
    metadataResolved: true,
  }
}
