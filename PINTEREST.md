# Pinterest Integration — Context File

## Status

Pinterest developer app approved as of July 9, 2026. Ready to build CB_09.

**Pinterest App credentials are stored in:**
- Vercel environment variables: `VITE_PINTEREST_CLIENT_ID`
- Supabase Edge Function secrets: `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`

*(Credentials need to be added — approval just received)*

---

## What's Already Built

CB_12 (Bring Your Own Recipes — Airtable) was built before Pinterest was approved and established the Connected Sources framework that CB_09 will plug into. This is critical context.

**The Connected Sources framework already exists in the codebase:**
- `src/contexts/ConnectedSourcesContext.jsx` — manages all connected sources
- `src/lib/connectedSources.js` — feature flag registry (Pinterest adapter needs to be added here)
- `src/components/foryou/ConnectedSourceCard.jsx` — generic card component driven by feature flags
- `src/pages/ForYouPage.jsx` — For You deck with filter drawer, already supports multiple sources
- `src/hooks/useForYouDeck.js` — session swipe state, batch fetching, pool exhaustion logic
- `supabase/migrations/009_connected_sources.sql` — the `connected_sources` table is already live and source-agnostic
- `supabase/functions/airtable-oauth/` — OAuth Edge Function pattern to replicate for Pinterest

**Pinterest slots in as a new adapter — it does NOT require changes to:**
- The For You deck rendering
- The filter drawer
- The basket
- The ingredient aggregation flow
- Meal History

---

## CB_09 Specification

The full CB_09 brief lives at `docs/capability-briefs/CB_09_Connected_Sources.md`.

**Key decisions already made:**

### Pinterest OAuth
- OAuth via Pinterest API v5
- Scopes required: `boards:read`, `pins:read`, `user_accounts:read`
- Redirect URI: `https://app.jarrodmurray.com/auth/pinterest/callback`
- Token storage: Supabase `connected_sources` table (already exists)
- Automatic token refresh before each For You session
- Tokens expire after 30 days — silent refresh via refresh token (valid up to 1 year)

### Pinterest Data — Critical Policy Constraint
Per Pinterest Developer Guidelines, **no Pinterest API data may be stored in Supabase** beyond:
- `pin_id` (for basket deduplication)
- `destination_url` (the recipe page URL — needed for ingredient extraction)
- Selected board IDs (stored in `connected_sources.config`)

Pin images, titles, board names, and descriptions must be fetched fresh from the Pinterest API each session and held in React state only.

### Board Selection
- After OAuth, user selects which boards to pull from
- Multi-select checklist — same pattern as Dietary Preferences
- Only board IDs are stored in Supabase — board names/metadata fetched fresh each session
- Editable at any time from Settings → Connections

### For You Card — Pinterest Feature Flags
```javascript
{
  yes: true,
  no: true,
  never: false,        // hidden — user deliberately saved these
  favorites: true,
  ingredients_drawer: false,
  prep_time: false,
  difficulty: false,
  source_footer: true  // shows "Pinterest / [Board Name]"
}
```

### Card Rendering
- Pin image displayed at natural aspect ratio, aligned to top
- Pin title as card title
- Source footer: `Pinterest / [Board Name]`
- No difficulty/prep time badges
- No Never button
- Yes and No/Skip work identically to Spoonacular and Airtable

### Ingredient Extraction
- Ingredients are NOT extracted at swipe time — deferred to aggregation
- When a Yes-swiped Pinterest pin reaches the Ingredients page, the app fetches the `destination_url` and attempts Schema.org JSON-LD extraction via `/api/fetch-recipe`
- Same fallback chain as CB_10 and CB_12: JSON-LD → Spoonacular extract → friendly error with View Recipe link
- The `destination_url` from Pinterest's API `link` field is the recipe page URL

### Session Behavior
- No-swiped pin IDs: client-side session state only, never persisted
- Yes-swiped pins: only `pin_id` and `destination_url` stored in basket (Supabase)
- Basket display re-fetches pin title/image from Pinterest API using stored `pin_id`
- Board metadata fetched fresh from Pinterest API at session start

### Basket Deduplication
- Pinterest pins use stable `pin_id` from Pinterest's API
- Dedup key: `pin_id` (same as Spoonacular's `meal_id` approach)
- Use `pinterest:${pinId}` as the `meal_id` format in the basket

### Pool Exhaustion
- When all pins from active boards are swiped, show empty state
- Empty state: explain user has seen all pins, offer "Change Filters" and "Start Over"
- "Start Over" resets No-swiped pin IDs (full reset) — Yes-swiped pins remain excluded
- Never auto-reload

---

## Navigation Context

**Current nav (as of CB_11 + CB_12):**
- Mobile bottom nav: Plan, For You (visible when any source connected), List, History, Favorites
- Desktop sidebar: same
- Basket: header icon (top right, next to avatar)
- Hidden: Settings → Hidden Meals (bottom of Settings screen)
- Settings: avatar in top right header

**CB_09 does NOT change the navigation** — For You already exists and already conditionally shows when sources are connected. Pinterest boards will appear as a new source type in the existing filter drawer.

---

## Existing Airtable OAuth Pattern to Mirror

The Pinterest OAuth Edge Function should follow `supabase/functions/airtable-oauth/index.ts` exactly:
- PKCE flow
- Server-side token exchange (client secret never reaches browser)
- Handles both `exchange` and `refresh` actions
- Mirrors Stripe function's auth/CORS pattern

**Pinterest-specific differences:**
- Authorization endpoint: `https://www.pinterest.com/oauth/`
- Token endpoint: `https://api.pinterest.com/v5/oauth/token`
- Scopes: `boards:read pins:read user_accounts:read`
- Token lifetime: 30 days (access), up to 1 year (refresh)

---

## Pinterest API Endpoints Needed

```
GET https://api.pinterest.com/v5/boards          — list user's boards
GET https://api.pinterest.com/v5/boards/{board_id}/pins  — get pins from a board
GET https://api.pinterest.com/v5/pins/{pin_id}   — get individual pin details
```

Pin object key fields:
- `id` — stable pin ID
- `title` — recipe name
- `media.images.original.url` — full resolution image
- `link` — destination URL (the recipe page) ← critical for ingredient extraction
- `board_id` — which board it belongs to

**Pagination:** Pinterest uses cursor-based pagination (`bookmark` parameter) — same as the Airtable pattern already built in `useForYouDeck.js`

---

## Settings → Connections

Pinterest connection management lives in the same `ConnectionsPage.jsx` as Airtable. It should appear as a new source type with:
- "Connect Pinterest" button (triggers OAuth)
- Board selection screen after OAuth
- Connection status badge (Connected / Reconnect needed)
- Disconnect option

---

## Supabase Migration

No new migration needed — `009_connected_sources.sql` created a source-agnostic `connected_sources` table that Pinterest slots into with `source_type: 'pinterest'`.

The `config` JSONB column stores `{ selected_board_ids: ['board_id_1', 'board_id_2'] }` for Pinterest, same pattern as Airtable's `{ base_id, table_id, column_mapping }`.

---

## Known Issues / Quirks

- Pinterest tokens expire after 30 days — auto-refresh must work reliably or the For You deck breaks silently
- Some Pinterest pins have no `link` field (pins uploaded directly to Pinterest, not saved from a website) — these show a card but ingredient extraction will fail gracefully with the View Recipe fallback
- Pinterest's API has rate limits — batch fetching should respect these; cursor pagination is the right approach
- The `destination_url` / `link` field is the most critical piece of data — without it ingredients can't be extracted

---

## Build Order for CB_09

1. Pinterest OAuth Edge Function (`supabase/functions/pinterest-oauth/`)
2. `src/lib/pinterest.js` — PKCE flow, token refresh, API wrappers (boards, pins)
3. `src/pages/PinterestCallbackPage.jsx` — completes OAuth, redirects to Settings → Connections
4. Pinterest adapter in `ConnectionsPage.jsx` — board selection UI (simpler than Airtable — no column mapping needed)
5. Pinterest feature flags in `src/lib/connectedSources.js`
6. `pinterestAdapter.js` — converts Pinterest pin API response to generic card shape
7. `useForYouDeck.js` — add Pinterest as a new source type (follows same batch/pagination pattern as Airtable)
8. Ingredient extraction — add `'pinterest'` to the `source_type` branch in `IngredientsPage.jsx` and basket drawer (same as `'url_import'` and `'airtable'`)
9. Basket re-fetch — when displaying a Pinterest pin in the basket, re-fetch title/image from Pinterest API using stored `pin_id` (Pinterest policy: no storing pin content)

---

## Environment Variables Needed

**Vercel:**
- `VITE_PINTEREST_CLIENT_ID`

**Supabase Edge Function secrets:**
- `PINTEREST_CLIENT_ID`
- `PINTEREST_CLIENT_SECRET`

**Pinterest app redirect URI to register:**
- `https://app.jarrodmurray.com/auth/pinterest/callback`
