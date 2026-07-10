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

// Pinterest appends tracking params to a pin's destination URL
// (pins_campaign_id, pp, and sometimes utm_*/epik) that some recipe sites
// fail to render correctly for — the same URL works when fetched without
// them. Stripped here so only the clean URL ever reaches
// basket_items.destination_url; api/fetch-recipe.js applies the same
// stripping as a safety net for URLs already stored with them attached.
const TRACKING_PARAM_PATTERNS = [/^pins_/i, /^utm_/i, /^pp$/i, /^epik$/i]

function stripTrackingParams(url) {
  if (!url) return url
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(key))) {
        parsed.searchParams.delete(key)
      }
    }
    return parsed.toString()
  } catch {
    return url
  }
}

// Pinterest's media.images response is keyed by size name, and which keys
// show up depends on the app's approved access level — "original" is only
// present for apps with elevated image-size approval, which this app's
// current approval doesn't include. Most responses only carry the standard
// breakpoints below. Try them largest-first, then fall back to whatever key
// is actually present rather than assuming any one of them exists.
const IMAGE_SIZE_PRIORITY = ['original', '1200x', '600x', '400x300', '150x150']

export function pinterestPinImageUrl(pin) {
  const images = pin.media?.images
  if (!images) return null
  for (const size of IMAGE_SIZE_PRIORITY) {
    if (images[size]?.url) return images[size].url
  }
  return Object.values(images)[0]?.url ?? null
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
    image_url: pinterestPinImageUrl(pin),
    destination_url: stripTrackingParams(pin.link) ?? null,
    source_footer: boardName ? `Pinterest / ${boardName}` : 'Pinterest',
    featureFlags: getSourceFeatureFlags('pinterest'),
    metadataResolved: true,
  }
}
