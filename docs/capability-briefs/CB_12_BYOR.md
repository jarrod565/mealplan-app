# Capability Brief (CB): Bring Your Own Recipes (Airtable Integration — v1)

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Bring Your Own Recipes (Airtable Integration — v1) |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

Spoonacular provides a strong pool of new recipe discoveries, but it has no knowledge of the recipes a household has already decided they love. Many users — particularly those who have spent years curating recipe collections on Pinterest, food blogs, or personal databases — arrive at Dinder with hundreds of recipes they want to cook again, not just discover for the first time.

Without a way to bring those existing collections into Dinder, the app solves only half the problem: it helps households discover new meals, but ignores the library they've already built. For users like this, the most valuable swipe deck isn't Spoonacular — it's their own saved recipes.

The platform must provide a way for households to connect an external recipe database (Airtable in v1) and surface those recipes as swipeable cards in the For You deck, alongside any other connected sources.

---

## Outcome

The platform provides a "Bring Your Own Recipes" integration that allows users to connect one or more Airtable bases as recipe sources, surface their own recipes as swipeable cards in the For You deck, and filter which sources are active at any time.

Once implemented:

- Users can connect one or more Airtable bases from Settings → Connections
- Dinder auto-detects the column mapping (image URL, recipe title, destination URL) and presents a live preview card for user confirmation
- Connected Airtable bases appear as selectable sources in the For You filter drawer
- Cards from Airtable bases are served in the For You deck on demand, in randomized batches, interleaved with other active sources
- Yes swipes add the recipe to the basket — same behavior as all other sources
- Never is hidden — the user deliberately added these recipes
- No/Skip behaves identically to Spoonacular — excluded from the current session pool, returns on reshuffle or next session
- When a finite Airtable pool is exhausted, an empty state prompts the user to change filters or restart
- New rows added to a connected Airtable base become eligible in the next batch pull
- Meal History records are written only when a Shopping List is generated — not on swipe
- The For You screen shows an empty state with dynamic connection options when no sources are connected
- A Filter drawer on the For You screen lets users select which sources are active — Airtable bases, Pinterest boards (when available), or any combination
- A "Manage Connections" link inside the Filter drawer navigates to Settings → Connections

---

## Users

**Primary users:**
- Households with existing recipe collections in Airtable who want to swipe through their own recipes

**Secondary users:**
- Developers implementing additional Connected Source adapters beyond Airtable

---

## System Context

Bring Your Own Recipes extends the Connected Sources framework established in CB_09. Airtable is implemented as a new source adapter — the For You deck, filter drawer, and basket behavior are unchanged. This capability introduces the For You navigation item (previously conditional on Pinterest), making it always visible once any source is connected.

**Flow — Setup:**

```
Settings → Connections → Add Connection → Airtable
       ↓
User authenticates with Airtable (OAuth)
       ↓
User selects a base from their Airtable workspace
       ↓
User selects a table within that base
       ↓
Dinder scans the table schema and auto-detects column mapping
       ↓
Live preview card shown with best-guess mapping
       ↓
User confirms or corrects: image column, title column, URL column
       ↓
Connection saved to Supabase — base is now an available source
       ↓
Source appears in For You filter drawer
```

**Flow — For You Swiping:**

```
User opens For You screen
       ↓
Filter drawer (or last saved filter) determines active sources
       ↓
Dinder fetches a batch of rows from active Airtable bases
  (on demand, randomized, excluding previously swiped row IDs)
       ↓
For each row: fetch recipe metadata via CB_10 extraction pipeline
  (title from mapped column or Open Graph, image from mapped column or Open Graph)
       ↓
Cards served one at a time in the For You deck
       ↓
Yes → added to basket
No  → excluded from current session pool (returns on reshuffle/next session)
Never → hidden (not applicable — button hidden for Airtable cards)
       ↓
Pool exhausted → empty state with options to change filters or restart
```

This capability depends on:

- CB_09: Connected Sources (framework, For You deck, filter drawer, feature flags)
- CB_10: URL Recipe Import (extraction pipeline for recipe metadata)
- CB_03: Meal Discovery (shared basket)
- CB_11: Meal History (history written at list generation, not swipe)

---

## Responsibilities

**This capability is responsible for:**

- Airtable OAuth connection and token storage
- Base and table selection UI
- Auto-detecting column mapping with live preview card confirmation
- Fetching rows from connected Airtable tables in randomized batches
- Passing each row's destination URL through the CB_10 extraction pipeline for card metadata
- Rendering Airtable cards in the For You deck using the CB_09 feature flag system
- For You screen empty state with dynamic connection options
- Filter drawer source selection (Airtable bases, future: Pinterest boards)
- "Manage Connections" link within the filter drawer
- Settings → Connections screen for managing all connected sources

**This capability is NOT responsible for:**

- Setting up or maintaining the user's Airtable base
- Validating recipe data quality in the user's Airtable base
- Writing Meal History (see CB_11 — written at Shopping List generation only)
- Pinterest integration (see CB_09)
- Google Sheets integration (future enhancement)

---

## Functional Rules

### Airtable Connection

- Users connect Airtable via OAuth from Settings → Connections → Add Connection
- After authentication, the user selects a base from their Airtable workspace
- The user then selects a specific table within that base
- Dinder scans the table schema and attempts to auto-detect three columns:
  - **Image column** — a URL column whose values contain image file extensions or image CDN domains
  - **Title column** — a text column whose values look like recipe names (short, title-cased strings)
  - **Destination URL column** — a URL column whose values point to recipe pages (not image files)
- Dinder presents a live preview card using the first row of the table with the best-guess mapping applied
- The preview shows: image, title, and source domain parsed from the destination URL
- The user can correct any mapping by selecting a different column from a dropdown per field
- Column mapping must be confirmed before the connection is saved
- If the table has too many columns for confident auto-detection, Dinder surfaces its best guess and clearly indicates the user should verify
- Multiple Airtable bases can be connected — each base/table combination is a separate connection

### Connection Management

- All connected sources (Airtable bases, future Pinterest boards) are visible in Settings → Connections
- Each connection shows: source type, base name, table name, and connection status
- Users can disconnect any source from Settings → Connections
- Users can re-run column mapping confirmation for any existing connection
- Connection tokens are stored encrypted in Supabase on the subscription record

### For You Screen — Empty State

- When no sources are connected, the For You screen shows a dynamic empty state
- The empty state must include:
  - A friendly explanation of what For You is
  - A "Connect Your Recipes" CTA linking to Settings → Connections
  - A "Connect Pinterest" CTA (visible only when Pinterest integration is available — CB_09)
- Once at least one source is connected and active, the empty state is replaced by the swipe deck

### Filter Drawer

- A Filter button is visible on the For You screen at all times (when at least one source is connected)
- Tapping Filter opens a bottom drawer (same pattern as the ingredients drawer)
- The drawer lists all connected sources with a toggle per source
- Multiple sources can be active simultaneously — cards from all active sources are interleaved randomly
- The drawer includes a "Manage Connections" link at the bottom that navigates to Settings → Connections
- Filter selections persist across sessions (saved to Supabase on the subscription record)
- Changes to filter selection take effect immediately on the next batch pull

### Card Behavior — Airtable Source

Airtable cards use the CB_09 feature flag system:

- `yes` — true
- `no` — true
- `never` — false (button hidden)
- `favorites` — true
- `ingredients_drawer` — false (no pre-fetched ingredient data)
- `prep_time` — false
- `difficulty` — false
- `source_footer` — true (displays base name and table name)

Card footer format: `[Base Name] / [Table Name]`

### Batch Fetching

- Airtable rows are fetched on demand in batches (same batch size as Spoonacular — 20-25 per call)
- Rows are randomized before serving to avoid always showing the same recipes in the same order
- Previously Yes-swiped and No-swiped row IDs are excluded from the current session pool
- Yes-swiped row IDs are excluded permanently (meal is in basket)
- No-swiped row IDs are excluded for the current session only — same behavior as Spoonacular
- New rows added to the Airtable base become eligible in the next batch pull
- No pre-fetching or caching of the full Airtable base — rows are fetched on demand

### Metadata Extraction

- For each Airtable row, card metadata is resolved in this order:
  1. Use the mapped image column value as the card image
  2. Use the mapped title column value as the card title
  3. If either is missing or invalid, fall back to the CB_10 Open Graph extraction pipeline using the destination URL
- Ingredient extraction is deferred — same as CB_10 — fetched lazily when the basket drawer opens or the Ingredients page loads

### Pool Exhaustion

- When all rows from active sources have been swiped in the current session, an empty state is shown
- The empty state must:
  - Communicate that the user has seen all available recipes from the active sources
  - Offer two options: "Change Filters" (opens the filter drawer) and "Start Over" (resets the session pool — No-swiped rows return, Yes-swiped rows remain excluded)
- The empty state must not auto-reset — the user must explicitly choose

### No/Skip Behavior

- No/Skip behaves identically to Spoonacular:
  - Excluded from the current session pool
  - Returns in the next session or on "Start Over"
  - Session swipe state is client-side only — never persisted to Supabase

### Meal History

- Airtable-sourced meals are written to Meal History only when a Shopping List is generated (CB_11)
- Swiping Yes on an Airtable card does NOT write to History — only list generation does
- "Make This Again" in History re-adds the recipe using the stored destination URL via the CB_10 pipeline

---

## Constraints

- Airtable OAuth must use Airtable's official OAuth 2.0 flow
- Connection tokens stored encrypted in Supabase on the subscription record
- No caching of Airtable row data beyond the current session — rows are fetched on demand per Airtable's terms of use
- Column mapping is confirmed by the user before any rows are fetched for swiping
- The CB_09 Connected Sources adapter pattern must be used — no Airtable-specific logic in the core For You deck
- Google Sheets integration is explicitly out of scope for v1

---

## Not In Scope

- Google Sheets integration (future enhancement)
- Setting up or maintaining the user's Airtable base
- Writing data back to Airtable (read-only integration)
- Validating recipe data quality — if a URL is broken or the recipe is inaccessible, the CB_10 error handling applies
- Bulk import of Airtable rows into Dinder's own database
- AI-powered recipe recommendations based on Airtable content (future Premium feature)
- Sorting Airtable cards by any field other than random

---

## Edge Cases

- Airtable table has no detectable URL columns — connection setup shows an error explaining the table needs at least one URL column
- Airtable table has only one URL column — Dinder uses it as the destination URL and falls back to Open Graph for the image
- Mapped image column contains a non-image URL — Open Graph fallback used for image
- Mapped destination URL is broken or returns an error — CB_10 error handling applies; card shows title only with a "View Recipe" link
- User disconnects a source mid-session — any unserved cards from that source are removed from the current pool silently
- User adds new rows to Airtable base mid-session — new rows are not eligible until the next batch pull
- All active sources are exhausted simultaneously — combined empty state shown
- Airtable OAuth token expires — connection status updates to "Reconnect" in Settings → Connections; For You deck shows a prompt to reconnect that source
- Two users on the same subscription simultaneously swiping For You — last write wins on session state; basket additions persist immediately
- User connects the same Airtable base/table combination twice — Dinder detects the duplicate and prevents it

---

## Success Metrics

- Airtable OAuth completes without error and bases are available for selection
- Column mapping auto-detection correctly identifies image, title, and URL columns for a well-structured Airtable base
- Live preview card renders correctly before the user confirms the mapping
- Cards from connected Airtable bases appear in the For You deck interleaved with other active sources
- No/Skip behavior matches Spoonacular behavior exactly
- Pool exhaustion empty state appears with correct options and "Start Over" correctly resets No-swiped rows
- Filter drawer correctly toggles sources and changes take effect on the next batch
- Meal History is written only at Shopping List generation — never on swipe
- Settings → Connections shows all connected sources with accurate status

---

## Example Workflow

1. User navigates to Settings → Connections → Add Connection → Airtable
2. Airtable OAuth flow completes — user grants read access
3. User selects "Recipe Collection" base → "Dinners" table
4. Dinder scans the table schema: detects "Photo URL," "Recipe Name," and "Recipe Link" columns
5. Live preview card shown: photo from "Photo URL," title from "Recipe Name," domain from "Recipe Link"
6. User confirms — connection is saved
7. User repeats for a "Desserts" table in a separate base
8. User navigates to For You — filter drawer defaults to both sources active
9. Cards from both tables appear interleaved randomly in the swipe deck
10. User opens filter drawer — deselects "Desserts" — only dinner recipes show
11. User taps "Manage Connections" — navigates to Settings → Connections
12. User swipes through dinner recipes — Yes adds to basket, No skips for this session
13. Pool exhausted — empty state shown: "Change Filters" or "Start Over"
14. User taps "Start Over" — No-swiped recipes return, session begins again
15. User generates Shopping List — Airtable-sourced meals written to Meal History

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- Airtable OAuth: Airtable OAuth 2.0
- Connection token storage: Supabase (subscription record, encrypted)
- Row fetching: Airtable REST API (on demand, paginated)
- Metadata extraction: CB_10 `/api/fetch-recipe` pipeline (Open Graph + Spoonacular fallback)
- For You deck: CB_09 Connected Sources adapter pattern

### Dependencies

- CB_09: Connected Sources (For You deck, filter drawer, feature flag system, card rendering)
- CB_10: URL Recipe Import (metadata extraction pipeline)
- CB_03: Meal Discovery (shared basket)
- CB_11: Meal History (history written at list generation)

### Data Model

**Airtable Connection record (per subscription, per base/table):**
- `connection_id`
- `subscription_id`
- `source_type` (airtable)
- `access_token` (encrypted)
- `refresh_token` (encrypted)
- `token_expiry`
- `status` (connected | reconnect_required)
- `base_id`
- `base_name`
- `table_id`
- `table_name`
- `column_mapping` (JSON: `{ image: "Photo URL", title: "Recipe Name", url: "Recipe Link" }`)
- `created_at`
- `updated_at`

**Filter preference record (per subscription):**
- `subscription_id`
- `active_source_ids` (array of connection_ids currently toggled on)
- `updated_at`

**Session swipe state (client-side only — never persisted):**
- `no_swiped_row_ids` (array of Airtable record IDs swiped No in current session)

### Key Rules

- Airtable rows are never stored in Supabase — fetched on demand per session
- Column mapping is stored in the connection record and applied at fetch time
- No-swiped row IDs are client-side session state only — reset on "Start Over" or new session
- Yes-swiped row IDs are tracked via basket contents — a row already in the basket is excluded from the deck
- Metadata extraction runs per card as it is about to be served — not pre-fetched for the whole batch
- Filter preferences are written to Supabase immediately on change in the filter drawer
- The CB_09 feature flag system governs all card UI — no Airtable-specific rendering logic in the deck
- "Manage Connections" in the filter drawer is a navigation link only — no inline connection management
- Token refresh follows the same pattern as CB_09 Pinterest tokens — attempted at session start, status updated to "reconnect_required" on failure
