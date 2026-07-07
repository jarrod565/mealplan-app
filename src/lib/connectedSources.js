// ── CB_09 Connected Sources framework — feature flags ─────────────────────────
// Read by ConnectedSourceCard at render time to decide which interactions and
// UI elements a source's cards support. Source-specific behavior (metadata
// resolution, identity, etc.) lives in that source's own adapter — this file
// and the card component stay source-agnostic so a future source (e.g.
// Pinterest) only needs a new entry here, not changes to the deck or card.

const FEATURE_FLAGS = {
  airtable: {
    yes: true,
    no: true,
    never: false,
    favorites: true,
    ingredientsDrawer: false,
    prepTime: false,
    difficulty: false,
    sourceFooter: true,
  },
}

export function getSourceFeatureFlags(sourceType) {
  return FEATURE_FLAGS[sourceType] ?? FEATURE_FLAGS.airtable
}
