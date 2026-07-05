# Dinder — Project Context

## What Is Dinder?

Dinder is a weekly meal planning PWA for households. The core loop: swipe through meal cards (Tinder-style) to build a basket → combine ingredients into a smart shopping list → export to any app or voice assistant.

Built as both a personal utility and a portfolio case study demonstrating end-to-end product ownership, UX design, and AI-assisted development.

**Live URL:** https://mealplan-app-drab.vercel.app
**GitHub:** https://github.com/jarrod565/mealplan-app
**Status:** v1 deployed and functional — v2 in progress (CB_09 Connected Sources / Pinterest)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (PWA) |
| Component Library | shadcn/ui + Tailwind CSS |
| Swipe Gestures | react-spring + @use-gesture |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase (Postgres) |
| Payments | Stripe (Free / Premium tiers — Stripe not fully wired in v1) |
| Recipe Data | Spoonacular API |
| Connected Sources | Pinterest API v5 (CB_09 — in progress) |
| Hosting | Vercel (auto-deploys from GitHub main branch) |

---

## Key Product Decisions

- **Shared account model:** Two users share a single login — no separate profiles in v1
- **Session behavior:** Basket persists across app opens; swipe deck resets each session
- **Ingredient fetching:** Lazy — fetched on card tap, not pre-fetched in batch
- **Never/Hidden:** Permanent dismissal with optional reason chip (5 predefined options); recoverable via Hidden screen
- **Serving size:** Household default set in Settings; per-meal override on Ingredients screen
- **Export:** Web Clipboard API + Web Share API; unchecked items only by default
- **Spoonacular filtering:** `type=main course` applied to all batch queries to exclude beverages and desserts
- **Guest mode:** Full app access with localStorage only — no Supabase writes
- **Facebook SSO:** Removed in v1 — Google only
- **Stripe:** Configured but not fully active in v1 — Premium tier UI exists, upgrade flow is placeholder
- **Connected Sources:** Reusable integration framework introduced in CB_09 — Pinterest is v1 implementation; future sources follow the same adapter pattern
- **Ingredient extraction (Pinterest):** Schema.org JSON-LD scraped client-side at basket time; Spoonacular extract endpoint as user-triggered fallback only

---

## What's Built (v1 Complete)

- ✅ Google SSO + persistent sessions
- ✅ Guest mode (localStorage only)
- ✅ Swipe deck with Yes / Skip / Never (batched Spoonacular API, 20-25 meals/call)
- ✅ Never confirmation flow with 5 reason chips
- ✅ Persistent basket with ingredient drawer (shadcn Sheet)
- ✅ Favorites — star toggle on cards, dedicated screen, Add to Basket action
- ✅ Hidden screen — dismissed meals with Restore action
- ✅ Ingredient aggregation — unit normalization, serving size scaling, category grouping, editable list
- ✅ Shopping list — Supabase-persisted, check-off state, clear with confirmation
- ✅ Export / Share — clipboard copy + native share sheet, unchecked items only
- ✅ Dark mode — system default + manual override in Settings, saved to Supabase
- ✅ Dietary preferences — 11 restriction types, passed as Spoonacular filter params
- ✅ Responsive navigation — bottom nav (mobile) / sidebar (desktop)
- ✅ Dinder logo (SVG wordmark with icon)
- ✅ Deployed to Vercel with Google OAuth working on desktop and iPhone

## What's In Progress (v2)

- 🔄 CB_09 — Connected Sources (Pinterest integration)
  - Pinterest OAuth + token management
  - Board selection UI
  - For You swipe deck (Pinterest pins)
  - Schema.org JSON-LD ingredient extraction
  - Navigation restructure (see below)
- 🔄 CB_10 — URL Recipe Import
  - Paste-a-URL input field on Basket screen
  - Open Graph metadata fetch (title + image)
  - Recipe detection via Schema.org
  - Duplicate URL detection
  - Full error message matrix
  - Ingredient extraction deferred to CB_06 pipeline
- 🔄 CB_11 — Meal History
  - Chronological meal table (most recent first, paginated)
  - Auto-written at Shopping List generation time
  - Deduplication — one record per meal, updated on re-generation
  - Make This Again action (basket re-add for Spoonacular and URL imports)
  - Inline favorite prompt for non-favorited meals
  - Navigation restructure — Hidden moves to Settings, History added between List and Favorites

---

## Navigation Structure

**Current (v1):**
- Bottom nav (mobile) / sidebar (desktop): Plan, Basket, List, Favorites, Hidden
- Settings accessible via user avatar in top right header

**Upcoming (v2 — CB_09 + CB_11):**
- Bottom nav (mobile) / sidebar (desktop): Explore, For You (conditional), List, History, Favorites
- Basket moves to top header icon (no label) next to user avatar
- "Plan" renamed to "Explore"
- "For You" added — only visible when at least one Pinterest board is connected and selected
- "History" added between List and Favorites
- "Hidden" removed from nav — accessible via Settings → Hidden Meals at the bottom of the Settings screen
- Nav labels hidden on viewports narrower than 360px (mobile only)
- Settings remains accessible via user avatar only

---

## Design Direction

- **Palette (light):** Warm greige/linen background, orange/amber primary accent, white cards with soft shadow
- **Palette (dark):** Warm dark charcoal surfaces, orange/amber accent carries through
- **Typography:** Clean sans-serif, strong hierarchy, generous whitespace
- **Vibe:** Fresh and natural — inspired by Zillow and Tonal simplicity
- **Swipe card (Explore):** Full-bleed photo, difficulty + prep time badges overlaid top left, favorite heart top right, meal name + ingredients row below as card footer, action buttons overlaid on photo
- **Swipe card (For You / Pinterest):** Natural aspect ratio image aligned to top, pin title, source footer ("Pinterest / [Board Name]"), no difficulty/prep time/Never button/ingredients drawer

---

## Connected Sources Framework (CB_09)

CB_09 introduces a reusable pattern for external integrations. Key principles:

- Each Connected Source has a source type, auth method, feature flag set, and card schema
- Feature flags define which interactions are available per source (Yes, No, Never, Favorites, Ingredients, source footer)
- Source-specific logic lives in an adapter — not in the core card deck or basket
- All Connected Sources share the same Basket, Ingredient Aggregation, and Shopping List flow
- Pinterest is the first adapter — future sources follow the same pattern without core architecture changes

**Pinterest-specific:**
- OAuth via Pinterest API v5
- Tokens stored encrypted on subscription record in Supabase
- Automatic token refresh before each For You session
- Board selection persisted in Connected Source config (JSON)
- Cursor-based pagination, randomized per session
- Schema.org JSON-LD extraction client-side; Spoonacular extract as user-triggered fallback

---

## Known Issues / Quirks

- Spoonacular data quality is inconsistent — some recipes have missing ingredient data (handled gracefully with warning state)
- Some ingredient units come back as "servings" from the API — displayed as "to taste"
- Image quality from Spoonacular free tier is low resolution
- Google OAuth consent screen shows Supabase domain ("ryhvxlryeldoxovastlq.supabase.co") — cosmetic issue, requires custom domain + Google app verification to fix
- Vercel URL is auto-generated (`mealplan-app-drab.vercel.app`) — not ideal for sharing

---

## What's Planned (Not Yet Built)

**Connected Sources (future beyond Pinterest):**
- AnyList integration
- Instacart integration
- Alexa shopping list
- Webhooks (placeholder exists in Settings)
- URL Recipe Import (CB_10) — paste any recipe URL directly into the basket

**Premium AI features:**
- AI-suggested meals based on swipe history
- Smart ingredient substitutions
- Medical condition-aware filtering (e.g. Gout, Diabetes)
- Natural language meal planning ("plan a cozy week of comfort food")

**Other future enhancements:**
- Apple Sign-In
- Cuisine-style preferences
- Multiple shopping lists
- Favorites-only swipe mode
- Sorting/filtering on Favorites and Hidden screens

---

## Supabase Configuration

**Project URL:** https://ryhvxlryeldoxovastlq.supabase.co
**Auth providers:** Google OAuth enabled
**Redirect URLs configured for:**
- https://mealplan-app-drab.vercel.app/**
- https://jarrodmurray.vercel.app/**
- https://mealplan-app.vercel.app/**

**Migrations:** All 4 migration files have been run against the hosted Supabase project.
**CB_09 migration:** Not yet written — required for Connected Sources table.

---

## Capability Briefs

Full product specifications live in `/docs/capability-briefs/`. These are the authoritative source of truth for all implementation decisions.

| File | Capability | Status |
|---|---|---|
| CB_01_Auth_Subscription.md | Authentication, SSO, sessions, subscription tiers | ✅ Built |
| CB_02_Dietary_Preferences.md | Dietary restriction filters | ✅ Built |
| CB_03_Meal_Discovery.md | Swipe deck, basket, Never flow | ✅ Built |
| CB_04_Favorites.md | Favorites management | ✅ Built |
| CB_05_Hidden.md | Hidden/Never pile management | ✅ Built |
| CB_06_Ingredient_Aggregation.md | Smart ingredient combining | ✅ Built |
| CB_07_Shopping_List.md | Shopping list persistence | ✅ Built |
| CB_08_Export_Share.md | Clipboard copy and share sheet | ✅ Built |
| CB_09_Connected_Sources.md | Pinterest OAuth, For You deck, ingredient extraction, nav restructure | 🔄 In Progress |
| CB_10_URL_Recipe_Import.md | Paste-a-URL import, Open Graph fetch, recipe detection, basket card | 🔄 In Progress |
| CB_11_Meal_History.md | Chronological history, Make This Again, inline favorite prompt, nav restructure | 🔄 In Progress |

---

## Development Workflow

- **Local dev:** `npm run dev` → http://localhost:5173
- **Mobile testing:** `npm run dev -- --host` → use `ipconfig getifaddr en1` to find local IP
- **Deploy:** `git push` → Vercel auto-deploys from main branch
- **Claude Code:** Run `claude` from inside `/mealplan-app` directory

---

## Project Background

Built by Jarrod Murray — Designer and Product Owner with a background spanning graphic design, UX research, and product management. Previously Director of Product and UX at Captivated (B2B business texting platform) for 4 years.

Dinder was conceived, specified, and built using a structured workflow:
1. Product vision and decisions captured through a Q&A process with Claude
2. Capability Briefs written as AI-consumable markdown specs
3. Claude Code used for full implementation pass against the briefs
4. Iterative UI polish and bug fixes via Claude Code

This project demonstrates the full arc: problem definition → product specification → AI-assisted implementation → deployment → iteration.
