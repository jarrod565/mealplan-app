# Capability Brief (CB): Connected Sources (Pinterest Integration — v1)

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Connected Sources (Pinterest Integration — v1) |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

The Spoonacular API provides a strong pool of meal discovery options, but it doesn't know what the household has already decided they love. Users accumulate saved recipes across external platforms — Pinterest boards, bookmarked sites, saved collections — and have no way to bring those into the weekly planning flow.

Additionally, the current architecture ties meal discovery exclusively to a single data source. As the platform grows, new sources (AnyList, personal recipe imports, future integrations) need a consistent, reusable pattern to plug into without requiring a redesign of the card deck, basket, or ingredient aggregation flow.

The platform must:

- Provide a reusable Connected Sources framework that any external integration can implement
- Support Pinterest as the first Connected Source in v1
- Surface pins from selected Pinterest boards as swipeable meal cards in a dedicated "For You" experience
- Handle OAuth connection, token management, and board selection in a way that is frictionless for a weekly user
- Extract ingredients from Pinterest pin URLs at basket time, not swipe time
- Restructure the navigation to accommodate the new For You destination

---

## Outcome

The platform provides a Connected Sources framework and a Pinterest integration that surfaces the household's saved Pinterest recipes as swipeable cards in a dedicated For You experience.

Once implemented:

- Users can connect their Pinterest account from Settings → Integrations
- Users select which Pinterest boards to pull from
- A dedicated "For You" nav destination shows Pinterest pins as swipe cards
- Pinterest cards display the pin image and title, with source and board name in the footer
- Pinterest cards support Yes (add to basket) and Favorites — Never and ingredients drawer are hidden
- When a Yes-swiped Pinterest pin reaches the Ingredients screen, the app attempts to extract ingredients from the pin URL using Schema.org JSON-LD
- If JSON-LD extraction fails, the user is offered a Spoonacular-powered fallback extraction or a direct link to the recipe
- Pinterest OAuth tokens refresh automatically in the background
- The basket is shared between Explore (Spoonacular) and For You (Pinterest)
- Navigation is restructured: Basket moves to the top header, Plan is renamed Explore, For You is added as a dedicated nav destination
- Connected source status (Connected / Reconnect needed) is visible in Settings → Integrations

---

## Users

**Primary users:**
- Household members who have saved recipes on Pinterest and want to incorporate them into weekly meal planning

**Secondary users:**
- Developers implementing future Connected Sources beyond Pinterest

---

## System Context

Connected Sources sits alongside Meal Discovery (CB_03) as a parallel card source. Both feed into the same Basket, Ingredient Aggregation, and Shopping List flow. The Connected Sources framework is designed to be source-agnostic so future integrations follow the same pattern.

**Flow — Setup:**

```
Settings → Integrations → Connect Pinterest
       ↓
Pinterest OAuth flow
       ↓
User grants read permissions
       ↓
Access token + refresh token stored on subscription record
       ↓
Board selection screen presented
       ↓
Selected boards saved to Connected Source record
       ↓
For You nav destination becomes active
```

**Flow — For You Experience:**

```
User navigates to For You
       ↓
Pinterest API called — pins fetched from selected boards (paginated, randomized)
       ↓
No-swiped and Yes-swiped pin IDs excluded from current session
       ↓
Pinterest cards displayed one at a time
       ↓
  Yes → Pin added to shared Basket
  No  → Pin excluded from current session pool
  Favorite → Pin saved to Favorites
       ↓
Deck depleted → Empty state with Reload button (full reset)
```

**Flow — Ingredient Extraction:**

```
User taps "View Ingredients List" from Basket (CB_06)
       ↓
For each Pinterest pin in basket:
  → Fetch pin URL
  → Attempt Schema.org JSON-LD extraction (client-side)
  → Success: ingredients passed to aggregation
  → Failure: friendly error shown with two options:
      1. "Try with Spoonacular" (triggers extract endpoint — one API call)
      2. "View Recipe" (opens pin URL in browser)
```

This capability depends on:

- CB_01: Authentication & Subscription (subscription record, OAuth token storage)
- CB_03: Meal Discovery (shared Basket, card component pattern)
- CB_04: Favorites Management (star toggle on Pinterest cards)
- CB_06: Ingredient Aggregation (receives Pinterest pin ingredients)

---

## Responsibilities

**This capability is responsible for:**

- Defining and implementing the reusable Connected Source data model and framework
- Pinterest OAuth connection, token storage, and automatic token refresh
- Board selection UI and persistence
- Fetching and paginating Pinterest pins from selected boards
- Rendering Pinterest cards in the For You deck
- Ingredient extraction via Schema.org JSON-LD with Spoonacular fallback
- Connected source status display in Settings → Integrations
- Navigation restructure (Basket to header, Plan → Explore, For You added)

**This capability is NOT responsible for:**

- Managing the shared Basket (see CB_03)
- Favorites storage (see CB_04)
- Ingredient aggregation logic (see CB_06)
- Implementing future Connected Sources beyond Pinterest (future capability)

---

## Functional Rules

### Connected Sources Framework

- A Connected Source is any external platform that can supply meal cards to the deck
- Each Connected Source has: a source type, an authentication method, an auth token, a feature flag set, and a card schema
- Feature flags per source define which card interactions are available (Yes, No, Never, Favorites, Ingredients)
- The framework must be implemented generically so future sources can be added without modifying the core card deck or basket logic
- Connected Source status must be visible in Settings → Integrations: "Connected" (green), "Reconnect" (token lapsed or revoked)

### Pinterest OAuth

- Pinterest OAuth must be initiated from Settings → Integrations → Connect Pinterest
- The OAuth flow must request read access to the user's boards and pins
- Access token and refresh token must be stored on the subscription record in Supabase
- Token expiry must be tracked and refresh must happen automatically in the background before each For You session
- If token refresh fails, the Connected Source status must update to "Reconnect" and the user must be prompted to re-authenticate from Settings → Integrations
- Token refresh must not interrupt an active For You session

### Board Selection

- After successful OAuth connection, the user must be presented with a list of their Pinterest boards
- The user must be able to select one or more boards to pull from
- Board selection is a multi-select checklist — the same pattern as Dietary Preferences
- Board selection must be editable at any time from Settings → Integrations → Pinterest
- Changes to board selection take effect on the next For You session
- At least one board must be selected for the For You destination to be active

### For You Card Deck

- For You cards are fetched from selected Pinterest boards via the Pinterest API
- Cards are paginated using Pinterest's cursor-based pagination and randomized before display
- A new batch is fetched only when the current pool is depleted
- No-swiped and Yes-swiped pin IDs are excluded from the current session pool (client-side, session-only)
- For You cards display: pin image (natural aspect ratio, aligned to top), pin title, and a footer showing source and board name in the format: `Pinterest / [Board Name]`
- The following are hidden on For You cards: Never button, ingredients drawer, prep time, difficulty badge
- The Favorites star is visible and functional on For You cards
- The Yes button adds the pin to the shared Basket

### For You Empty State

- When all pins in the current session pool have been swiped, an empty state is shown
- The empty state communicates that the user has seen all available pins from their selected boards
- A primary "Reload" button resets the session pool to include all pins (full reset — No-swiped pins return)
- Yes-swiped pins (already in basket) are excluded from the reset pool
- The empty state must not auto-reload — the user must explicitly tap Reload

### Ingredient Extraction

- Ingredient extraction for Pinterest pins is triggered at Ingredient Aggregation time (CB_06), not at swipe time
- For each Pinterest pin in the basket, the app fetches the pin's destination URL and attempts to extract a Schema.org JSON-LD recipe block
- If JSON-LD extraction succeeds, ingredients are passed to CB_06 in the same format as Spoonacular ingredients
- If JSON-LD extraction fails, the pin is shown in the aggregation screen with a friendly error state containing:
  - A message explaining that ingredients couldn't be extracted automatically
  - A "Try with Spoonacular" button that triggers the Spoonacular extract endpoint for that URL (one API call, user-initiated)
  - A "View Recipe" link that opens the original pin URL in the browser
- If Spoonacular extraction also fails, only the "View Recipe" link remains
- Extraction failures must never block the aggregation of other basket items

### Navigation Restructure

- Basket is removed from the bottom navigation bar and sidebar
- Basket icon (no label) is added to the top header, next to the user avatar, on all screens
- The basket icon must display a count badge when meals are in the basket
- "Plan" is renamed to "Explore" in the navigation and all screen titles
- "For You" is added as a new navigation destination between Explore and List
- For You is only visible in the navigation when at least one Pinterest board is connected and selected
- Bottom nav order (mobile): Explore, For You (if active), List, Favorites, Hidden
- Sidebar order (desktop): same five destinations, same conditional visibility
- On viewports narrower than 360px, bottom nav labels are hidden — icons only

### Session Behavior

- For You session state (No-swiped pin IDs) is client-side only and resets on Reload or app close
- Yes-swiped pins persist in the shared Basket (Supabase) across sessions
- Pinterest card swipe state does not affect Explore (Spoonacular) session state and vice versa

---

## Constraints

- Pinterest OAuth must use Pinterest API v5
- Token storage must use Supabase on the subscription record — no tokens stored client-side beyond the current session
- Schema.org JSON-LD extraction must be performed client-side at ingredient aggregation time
- Spoonacular extract endpoint is only called on explicit user action — never automatically
- The Connected Sources framework must be implemented as a reusable pattern, not Pinterest-specific code
- Navigation restructure must maintain responsive behavior — bottom nav on mobile, sidebar on desktop

---

## Not In Scope

- Additional Connected Sources beyond Pinterest (future capability)
- Two-way Pinterest integration (saving meals back to Pinterest boards)
- Importing Pinterest pins into the Spoonacular-based Explore deck
- Mixing Pinterest and Spoonacular cards in the same deck
- AI-powered pin matching or recommendation based on Pinterest history
- Pinterest board creation or management
- Offline ingredient extraction caching

---

## Edge Cases

- User revokes Pinterest access from their Pinterest account settings — Connected Source status must update to "Reconnect" on next session
- User deselects all Pinterest boards — For You nav destination is hidden until at least one board is reselected
- Pinterest API rate limit reached during pin fetch — graceful error state with retry option
- Pinterest pin has no destination URL (image-only pin) — shown in basket with "No recipe link available" and View Recipe button disabled
- Pinterest pin URL is behind a paywall or login wall — JSON-LD extraction fails gracefully, Spoonacular fallback offered
- User has Pinterest connected but no boards selected — For You shows an onboarding state prompting board selection
- Two users on the same subscription simultaneously swiping For You cards — last write wins on session state; basket additions persist immediately
- Token refresh fails silently — status updates to "Reconnect" on next app open, user is notified via Settings indicator not an interrupting modal
- Viewport narrower than 360px — bottom nav labels hidden, icons only

---

## Success Metrics

- Pinterest OAuth completes without error and boards are displayed for selection
- Pins from selected boards appear as cards in the For You deck
- Card images render without breaking the deck layout regardless of pin aspect ratio
- Yes-swiped Pinterest pins appear in the shared Basket correctly
- Schema.org JSON-LD extraction succeeds for the majority of major recipe sites
- Spoonacular fallback extraction is available and functional when triggered by the user
- Token refresh happens silently without interrupting the For You session
- Navigation restructure renders correctly on mobile and desktop at all viewport sizes
- Nav labels are hidden correctly on viewports narrower than 360px

---

## Example Workflow

1. User navigates to Settings → Integrations and taps "Connect Pinterest"
2. Pinterest OAuth flow opens — user grants read access
3. Board selection screen shows all boards: Dinners, Casseroles, Desserts, etc.
4. User selects Dinners and Casseroles — For You nav item becomes active
5. User navigates to For You — pins from Dinners and Casseroles load as swipe cards
6. Card shows pin image (natural aspect ratio), pin title, and "Pinterest / Dinners" in the footer
7. User swipes Yes on a casserole pin — it is added to the shared Basket
8. User navigates to Basket (via header icon) — sees Spoonacular meals and the Pinterest pin together
9. User taps "View Ingredients List" — aggregation screen loads
10. App attempts JSON-LD extraction on the Pinterest pin URL — succeeds, ingredients appear
11. For a second pin, JSON-LD extraction fails — friendly error shown with "Try with Spoonacular" and "View Recipe" options
12. User taps "Try with Spoonacular" — ingredients are returned and added to the aggregation list
13. User depletes the For You deck — empty state shown with "You've seen everything" message and Reload button
14. User taps Reload — full pin pool resets, previously No-swiped pins return

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- Pinterest OAuth: Pinterest API v5 OAuth 2.0 flow
- Token storage: Supabase (subscription record)
- Pin fetching: Pinterest API v5 boards and pins endpoints (cursor-based pagination)
- Ingredient extraction: client-side Schema.org JSON-LD parser + Spoonacular extract endpoint fallback
- Navigation: restructured bottom nav (mobile) and sidebar (desktop)

### Dependencies

- CB_01: Authentication & Subscription (subscription record, OAuth token storage, Integrations placeholder in Settings)
- CB_03: Meal Discovery (shared Basket, card component pattern, session swipe state pattern)
- CB_04: Favorites Management (star toggle)
- CB_06: Ingredient Aggregation (receives extracted ingredients in standard format)
- Pinterest Developer App with OAuth 2.0 credentials configured
- Spoonacular extract endpoint (user-triggered fallback only)

### Data Model

**Connected Source record (per subscription, per source type):**
- `source_id`
- `subscription_id`
- `source_type` (pinterest | future_source)
- `access_token` (encrypted)
- `refresh_token` (encrypted)
- `token_expiry`
- `status` (connected | reconnect_required)
- `config` (JSON — source-specific config, e.g. selected board IDs for Pinterest)
- `created_at`
- `updated_at`

**Pinterest board (fetched at connection time, stored in config):**
- `board_id`
- `board_name`
- `pin_count`
- `is_selected` (boolean)

**Pinterest pin card (session-only, not persisted beyond basket):**
- `pin_id`
- `source_type` (pinterest)
- `board_id`
- `board_name`
- `title`
- `image_url`
- `destination_url`
- `added_to_basket_at` (if Yes-swiped)

**Feature flag set — Pinterest source:**
- `yes` — true
- `no` — true
- `never` — false
- `favorites` — true
- `ingredients_drawer` — false
- `prep_time` — false
- `difficulty` — false
- `source_footer` — true

### Key Rules

- Connected Source framework is source-agnostic — Pinterest-specific logic lives in a Pinterest adapter, not in the core card deck or basket
- Feature flags are read from the Connected Source record at render time — card UI is driven by flags, not hardcoded per source
- Token refresh is attempted at the start of every For You session before any API calls are made
- Schema.org JSON-LD extraction runs client-side using the pin's destination URL — no server-side proxy required for most sites
- Spoonacular extract endpoint is never called automatically — only on explicit user tap
- Session swipe state (No-swiped pin IDs) is stored in React state only — never persisted to Supabase
- Yes-swiped pins are written to the Basket in Supabase immediately on swipe, using the same Basket record structure as CB_03
- For You is conditionally rendered in navigation — hidden when no Pinterest boards are selected or source status is reconnect_required
- Nav label visibility breakpoint (< 360px) must be implemented with a CSS media query, not JavaScript
