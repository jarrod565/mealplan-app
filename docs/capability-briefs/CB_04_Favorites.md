# Capability Brief (CB): Favorites Management

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Favorites Management |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

Users may discover meals they love and want to save for easy reference and future use — independent of whether they are planning a specific week. Without a favorites capability, those meals are lost to the random shuffle and users have no way to return to them intentionally.

Favorites must be:

- Easy to add or remove from anywhere a meal card is shown
- Accessible from their own dedicated screen in the main navigation
- Actionable — users should be able to add favorites directly to the basket without swiping

---

## Outcome

The platform provides a subscription-level favorites list that allows users to save meals for future reference and add them directly to the basket from a dedicated screen.

Once implemented:

- Users can favorite or unfavorite any meal by tapping the star icon on its card
- Favorites are stored at the subscription level and shared across both users
- A dedicated Favorites screen is accessible from the bottom navigation (mobile) and sidebar (desktop)
- Favorited meals are displayed as a simple scrollable list of cards
- Users can add any favorited meal directly to the basket from the Favorites screen
- Favorited meals may still appear randomly in the swipe deck
- The star icon on swipe deck cards reflects the current favorite state at all times

---

## Users

**Primary users:**
- Household members saving and revisiting preferred meals

---

## System Context

Favorites Management is a subscription-level capability that runs in parallel with Meal Discovery. It is accessible from both the swipe deck and the dedicated Favorites screen.

**Flow:**

```
Meal card displayed (swipe deck or Favorites screen)
       ↓
User taps star icon
       ↓
  Inactive → Active: meal added to Favorites
  Active → Inactive: meal removed from Favorites
       ↓
Favorites screen: user browses saved meals
       ↓
User taps "Add to Basket" on a favorited meal
       ↓
Meal added to Basket (CB_03)
```

This capability is accessed from:

- CB_03: Meal Discovery (star icon on swipe deck cards)

This capability feeds into:

- CB_03: Meal Discovery (Basket — meal added directly)

---

## Responsibilities

**This capability is responsible for:**

- Storing and managing the favorites list at the subscription level
- Providing a star icon toggle on all meal cards (active/inactive state)
- Providing the dedicated Favorites screen with a scrollable list of saved meals
- Allowing users to add favorited meals directly to the basket
- Allowing users to unfavorite meals from the Favorites screen
- Reflecting favorite state accurately on swipe deck cards

**This capability is NOT responsible for:**

- Swipe deck logic or card rendering (see CB_03: Meal Discovery)
- Basket management beyond triggering an add (see CB_03: Meal Discovery)
- Preventing favorited meals from appearing in the swipe deck

---

## Functional Rules

### Favoriting

- Any meal card must display a star icon regardless of context (swipe deck or Favorites screen)
- Tapping the star icon toggles the favorite state immediately
- Favoriting is independent of swiping — a meal can be favorited and swiped Yes, No, or Never independently
- Favorites are stored at the subscription level and shared across both users
- There is no limit to the number of favorites in v1

### Favorites Screen

- The Favorites screen must be accessible from the bottom navigation bar (mobile) and sidebar (desktop) under the label "Favorites"
- Favorited meals must be displayed as a simple scrollable list of cards
- Each card must display: meal name, photo, and prep time
- Each card must display the star icon in its active (favorited) state
- Each card must include an "Add to Basket" action
- Each card must allow the user to unfavorite the meal directly from this screen
- No sorting or filtering is required in v1 — meals appear in order of when they were favorited (most recent first)

### Adding to Basket

- Tapping "Add to Basket" on a favorited meal must add it to the basket immediately
- No confirmation is required
- If the meal is already in the basket, the action must be disabled or indicate it is already added
- Adding to basket from Favorites does not remove the meal from the Favorites list

### Relationship with Swipe Deck

- Favorited meals may still appear in the swipe deck and must display the star in its active state
- If a user swipes Never on a favorited meal, the meal is added to the Hidden list but is NOT automatically removed from Favorites — the user must manually unfavorite it
- If a user unfavorites a meal from the Favorites screen, it does not affect its status in the swipe deck

---

## Constraints

- Favorites must be stored in Supabase on the subscription record
- Star icon state must be derived from the live Favorites list — not cached locally beyond the current session

---

## Not In Scope

- Sorting or filtering the Favorites list (future enhancement)
- Sharing favorites with other users outside the subscription
- Favoriting custom or user-generated recipes (v1 is Spoonacular meals only)
- Favorites-only swipe mode (future enhancement)
- Notifications or suggestions based on favorites (future Premium AI feature)

---

## Edge Cases

- User favorites a meal and then swipes Never on it — meal exists in both Favorites and Hidden list; user must manually unfavorite it
- User taps "Add to Basket" on a meal already in the basket — action is disabled or shows an "Already in Basket" indicator
- User unfavorites all meals — Favorites screen shows an empty state encouraging them to star meals while swiping
- Two users simultaneously favorite or unfavorite the same meal — last write wins
- A Spoonacular meal ID is no longer available via the API — the favorited card should display gracefully with cached data or a fallback state

---

## Success Metrics

- Star icon state is accurate and consistent across the swipe deck and Favorites screen
- Favorited meals appear on the Favorites screen immediately after being starred
- "Add to Basket" correctly adds meals to the basket without removing them from Favorites
- Unfavoriting a meal removes it from the Favorites screen immediately
- Favorites persist correctly across sessions

---

## Example Workflow

1. User is swiping through the deck and taps the star on a meal card — star becomes active, meal is saved to Favorites
2. User continues swiping — the meal may appear again in a future session with the star already active
3. User navigates to Favorites via the bottom nav
4. User sees a scrollable list of saved meals
5. User taps "Add to Basket" on a meal — it is added to the basket, the card shows "Already in Basket"
6. User decides they no longer want a meal in their Favorites — taps the star to unfavorite it, it is removed from the list immediately
7. User returns to the swipe deck — the unfavorited meal may appear again with an inactive star

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- Favorites storage: Supabase (linked to subscription record)
- Navigation: bottom nav bar (mobile) / sidebar (desktop) — label: "Favorites"

### Dependencies

- CB_01: Authentication & Subscription (subscription record)
- CB_03: Meal Discovery (star icon on swipe deck cards, basket integration)

### Data Model

**Favorites record (persisted per subscription):**
- `subscription_id`
- `meal_id` (Spoonacular ID)
- `name`
- `photo_url`
- `prep_time`
- `favorited_at`

### Key Rules

- Favorites are written to Supabase immediately on star toggle
- Star icon state is resolved by checking the live Favorites list for the current subscription
- "Add to Basket" writes directly to the Basket record (CB_03 data model)
- Unfavoriting deletes the record from the Favorites list in Supabase
- A meal in both Favorites and Hidden is valid — no automatic reconciliation between the two lists
