# Dinder — Project Context

## What Is Dinder?

Dinder is a weekly meal planning PWA for households. The core loop: swipe through meal cards (Tinder-style) to build a basket → combine ingredients into a smart shopping list → export to any app or voice assistant.

Built as both a personal utility and a portfolio case study demonstrating end-to-end product ownership, UX design, and AI-assisted development.

**Live URL:** https://mealplan-app-drab.vercel.app
**GitHub:** https://github.com/jarrod565/mealplan-app
**Status:** Deployed and functional — v1 complete

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

---

## Navigation Structure

**5 destinations (bottom nav on mobile, sidebar on desktop):**
- **Plan** — swipe deck
- **Basket** — selected meals
- **List** — shopping list
- **Favorites** — starred meals
- **Hidden** — dismissed meals

**Settings** is accessible via user avatar in the top right header only — not in the nav.

---

## Design Direction

- **Palette (light):** Warm greige/linen background, orange/amber primary accent, white cards with soft shadow
- **Palette (dark):** Warm dark charcoal surfaces, orange/amber accent carries through
- **Typography:** Clean sans-serif, strong hierarchy, generous whitespace
- **Vibe:** Fresh and natural — inspired by Zillow and Tonal simplicity
- **Swipe card:** Full-bleed photo, difficulty + prep time badges overlaid top left, favorite heart top right, meal name + ingredients row below as card footer, action buttons overlaid on photo

---

## Known Issues / Quirks

- Spoonacular data quality is inconsistent — some recipes have missing ingredient data (handled gracefully with warning state)
- Some ingredient units come back as "servings" from the API — displayed as "to taste"
- Image quality from Spoonacular free tier is low resolution
- Google OAuth consent screen shows Supabase domain ("ryhvxlryeldoxovastlq.supabase.co") — cosmetic issue, requires custom domain + Google app verification to fix
- Vercel URL is auto-generated (`mealplan-app-drab.vercel.app`) — not ideal for sharing

---

## What's Planned (Not Built)

**Premium AI features:**
- AI-suggested meals based on swipe history
- Smart ingredient substitutions
- Medical condition-aware filtering (e.g. Gout, Diabetes)
- Natural language meal planning ("plan a cozy week of comfort food")

**Integrations (future):**
- Instacart API
- Alexa shopping list
- Webhooks (placeholder exists in Settings)

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

---

## Capability Briefs

Full product specifications live in `/docs/capability-briefs/`. These were written before implementation and served as the authoritative source of truth for Claude Code during development.

| File | Capability |
|---|---|
| CB_01_Auth_Subscription.md | Authentication, SSO, sessions, subscription tiers |
| CB_02_Dietary_Preferences.md | Dietary restriction filters |
| CB_03_Meal_Discovery.md | Swipe deck, basket, Never flow |
| CB_04_Favorites.md | Favorites management |
| CB_05_Hidden.md | Hidden/Never pile management |
| CB_06_Ingredient_Aggregation.md | Smart ingredient combining |
| CB_07_Shopping_List.md | Shopping list persistence |
| CB_08_Export_Share.md | Clipboard copy and share sheet |

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

This project demonstrates the full arc: problem definition → product specification → AI-assisted implementation → deployment.
