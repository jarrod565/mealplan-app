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

---

## Capability Dependency Map

```
CB_01 Authentication & Subscription
       ↓
CB_02 Dietary Preferences
       ↓
CB_03 Meal Discovery (Swipe Experience)
       ↓         ↓            ↓
CB_04         CB_05         CB_06 Ingredient Aggregation
Favorites     Hidden               ↓
                             CB_07 Shopping List
                                   ↓
                             CB_08 Export / Share
```

All capabilities depend on CB_01 for session, subscription tier, and account-level settings.

---

## Application Overview

**App concept:** A weekly meal planning PWA for households. Users swipe through meal ideas, build a basket of selected meals, combine ingredients into a smart shopping list, and export that list to their preferred shopping app or voice assistant.

**Target users:** Households of two sharing a single subscription.

**Tech stack:**
- Frontend: React + Vite (PWA)
- Component library: shadcn/ui + Tailwind CSS
- Swipe gestures: react-spring + @use-gesture
- Backend / Auth: Supabase
- Payments: Stripe
- Recipe data: Spoonacular API

**Navigation (mobile):** Bottom navigation bar — Plan, Basket, Favorites, Hidden, Settings

**Navigation (desktop):** Sidebar — same five destinations

**Subscription tiers:**
- **Free** — full access to all core features (swipe, basket, aggregation, shopping list, export)
- **Premium** — all Free features plus AI-powered capabilities (future — not in scope for v1)

---

## Conventions Used in These Briefs

- **Subscription-level** — data or settings that are shared across both users on the account
- **Session-only** — data that is client-side and resets when the app is closed
- **v1** — the initial build scope; features marked as future enhancements are explicitly out of scope
- **CB_XX references** — when a brief references another brief by number, read that brief before implementing the dependency
