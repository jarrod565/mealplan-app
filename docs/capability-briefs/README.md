# Capability Briefs

## What is a Capability Brief?

A Capability Brief (CB) is the single source of truth for a discrete, buildable capability within this application. Each brief defines what a capability does, why it exists, who it serves, how it behaves, and how it should be implemented.

Capability Briefs are written for both human collaborators and AI-assisted development. They are the authoritative specification — not suggestions, not guidelines. When building any feature, the relevant CB governs all decisions about scope, behavior, rules, and data.

---

## How to Use These Briefs

**Before writing any code for a feature:**
1. Read the relevant CB in full
2. Check the Dependencies section — read those CBs too if you haven't already
3. Follow the Functional Rules exactly — they are explicit and intentional
4. Respect the Not In Scope section — do not build what is listed there
5. Use the AI Implementation Context section for architecture, data model, and key implementation rules
6. Reference the Edge Cases — handle each one

**When in doubt:** the CB takes precedence over assumptions. If something is not covered in the brief, flag it rather than assume.

---

## Brief Index

| # | Capability | Description |
|---|---|---|
| CB_01 | Authentication & Subscription | SSO login, persistent sessions, Free/Premium tiers, Account Settings |
| CB_02 | Dietary Preferences | Subscription-level dietary restriction filters applied to meal discovery |
| CB_03 | Meal Discovery (Swipe Experience) | Tinder-style swipe deck, Yes/No/Hidden outcomes, persistent basket |
| CB_04 | Favorites Management | Star-based meal saving, Favorites screen, add to basket from Favorites |
| CB_05 | Hidden | Permanent meal dismissal, dismissal reasons, restore flow |
| CB_06 | Ingredient Aggregation | Smart combining, unit normalization, serving size scaling, list editing |
| CB_07 | Shopping List | Persistent checklist, check-off state, clear flow |
| CB_08 | Export / Share | Clipboard copy, native share sheet, plain text formatting |
| CB_09 | Connected Sources (Pinterest — v1) | Reusable integration framework, Pinterest OAuth, For You deck, Schema.org ingredient extraction |
| CB_10 | URL Recipe Import | Paste-a-URL recipe import, Open Graph metadata fetch, recipe detection, basket card creation |
| CB_11 | Meal History | Chronological meal history, Make This Again action, inline favorite prompt, nav restructure |
| CB_12 | Bring Your Own Recipes (Airtable — v1) | Airtable OAuth, column mapping with live preview, For You filter drawer, BYOR card adapter |

---

## Capability Dependency Map

```
CB_01 Authentication & Subscription
       ↓
CB_02 Dietary Preferences
       ↓
CB_03 Meal Discovery (Swipe Experience)
       ↓         ↓            ↓            ↓
CB_04         CB_05         CB_06         CB_09 Connected Sources
Favorites     Hidden        Ingredient         (Pinterest — v1)
                            Aggregation              ↓
                                 ↓            CB_10 URL Recipe Import
                            CB_07 Shopping List      ↓
                                 ↓            CB_12 Bring Your Own Recipes
                            CB_08 Export / Share     (Airtable — v1)
                            CB_11 Meal History
```

All capabilities depend on CB_01 for session, subscription tier, and account-level settings.
CB_09 depends on CB_03 (shared Basket, card pattern), CB_04 (Favorites), and CB_06 (ingredient aggregation).
CB_10 depends on CB_03 (Basket screen and data model), CB_06 (ingredient extraction), and CB_09 (shared extraction pipeline and fallback behavior).
CB_11 depends on CB_03 (basket state), CB_04 (Favorites), CB_07 (triggered at list generation), and CB_10 (URL import re-addition).
CB_12 depends on CB_09 (Connected Sources adapter pattern, For You deck), CB_10 (metadata extraction pipeline), CB_03 (shared basket), and CB_11 (history written at list generation).

---

## Application Overview

**App concept:** A weekly meal planning PWA for households. Users swipe through meal ideas (Explore) or their own saved recipes from connected sources (For You), build a basket of selected meals, combine ingredients into a smart shopping list, and export that list to their preferred shopping app or voice assistant.

**Target users:** Households of two sharing a single subscription.

**Tech stack:**
- Frontend: React + Vite (PWA)
- Component library: shadcn/ui + Tailwind CSS
- Swipe gestures: react-spring + @use-gesture
- Backend / Auth: Supabase
- Payments: Stripe
- Recipe data: Spoonacular API
- Connected Sources: Pinterest API v5 (v1), extensible to future integrations

**Navigation (mobile):** Bottom navigation bar — Explore, For You (conditional), List, Favorites, Hidden. Basket is a header icon. Settings is accessible via user avatar in the top right header.

**Navigation (desktop):** Sidebar — same destinations. Labels hidden on viewports narrower than 360px (mobile bottom nav only).

**Subscription tiers:**
- **Free** — full access to all core features (swipe, basket, aggregation, shopping list, export, connected sources)
- **Premium** — all Free features plus AI-powered capabilities (future — not in scope for v1)

---

## Connected Sources Framework

CB_09 introduces a reusable Connected Sources pattern. Each Connected Source is an external platform that supplies meal cards to the deck. Pinterest is the first implementation.

**Key architectural principles:**
- Source-specific logic lives in an adapter — not in the core card deck or basket
- Feature flags per source define which card interactions are available (Yes, No, Never, Favorites, Ingredients, source footer)
- All Connected Sources feed into the shared Basket, Ingredient Aggregation, and Shopping List flow
- Future sources follow the same adapter pattern — no core architecture changes required

---

## Conventions Used in These Briefs

- **Subscription-level** — data or settings that are shared across both users on the account
- **Session-only** — data that is client-side and resets when the app is closed
- **v1** — the initial build scope; features marked as future enhancements are explicitly out of scope
- **CB_XX references** — when a brief references another brief by number, read that brief before implementing the dependency
- **Connected Source** — an external platform integrated via the CB_09 framework that supplies cards to the For You deck
- **Explore** — the Spoonacular-powered swipe deck (formerly Plan)
- **For You** — the Connected Sources swipe deck (Pinterest pins from selected boards)
