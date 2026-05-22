# Capability Brief (CB): Meal Discovery (Swipe Experience)

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Meal Discovery (Swipe Experience) |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

Deciding what to cook each week is a repeated source of friction for households. Users need an engaging, low-effort way to browse meal options and build a shortlist without feeling overwhelmed or having to think too hard.

The platform must provide:

- A fast, intuitive swipe-based meal discovery experience
- Three distinct swipe outcomes: Yes, No, and Never
- A persistent basket where selected meals accumulate across sessions
- Smart API usage that avoids unnecessary calls while keeping the deck fresh
- Dietary restriction filtering applied before meals are surfaced
- Favorite toggling directly from the meal card
- A recoverable empty state when the meal pool is exhausted

---

## Outcome

The platform provides an engaging swipe-based meal discovery experience that allows users to build a weekly meal basket at their own pace across multiple sessions.

Once implemented:

- Users are presented with meal cards one at a time, loaded in batches from the Spoonacular API
- Each card displays the meal name, photo, and prep time
- Users can tap a card to reveal additional detail (ingredients and difficulty)
- Users swipe or tap to indicate Yes, No, or Never for each meal
- Yes meals are added to a persistent basket accessible at any time during the session
- No meals are excluded from the current pool but may reappear in future sessions
- Never meals trigger a confirmation step with an optional reason selection and are permanently excluded
- The basket persists across app opens until the user removes meals or converts the basket to a shopping list
- The swipe deck resets with a reshuffled pool each session, excluding Never meals
- A favorites star on each card allows users to save meals independently of swiping
- An active filter indicator is visible when dietary restrictions are applied

---

## Users

**Primary users:**
- Household members browsing and selecting meals for the week

**Secondary users:**
- Developers integrating Spoonacular API data into the swipe deck

---

## System Context

Meal Discovery is the core interactive experience of the platform. It sits downstream of Authentication & Subscription and Dietary Preferences, and upstream of the Basket, Ingredient Aggregation, and Shopping List capabilities.

**Flow:**

```
Session established (user identity + subscription tier)
       ↓
Dietary Preferences resolved
       ↓
Never Pile resolved (permanently excluded meal IDs)
       ↓
Spoonacular API called with dietary filters (batch of 20–25 meals)
       ↓
Swipe deck populated (Never meals excluded)
       ↓
User swipes through deck
       ↓
  Yes → Meal added to Basket
  No  → Meal excluded from current pool
  Never → Confirmation + optional reason → Meal added to Never Pile
       ↓
Deck depleted → reshuffle remaining pool (refetch if pool exhausted)
       ↓
User opens Basket → reviews, removes meals
       ↓
User proceeds to Ingredient Aggregation
```

This capability depends on:

- CB_01: Authentication & Subscription
- CB_02: Dietary Preferences
- CB_05: Never Pile Management

This capability feeds into:

- CB_04: Favorites Management
- CB_06: Ingredient Aggregation

---

## Responsibilities

**This capability is responsible for:**

- Fetching meal data from the Spoonacular API in batches
- Applying dietary restriction filters to API queries
- Excluding Never Pile meals from the swipe deck
- Presenting meal cards with name, photo, and prep time
- Handling tap-to-expand for ingredients and difficulty
- Managing swipe gestures and tap interactions for Yes, No, and Never
- Adding Yes meals to the persistent basket
- Managing the Never confirmation flow and reason capture
- Displaying and managing the basket (review, remove meals)
- Reshuffling the pool when the deck is depleted
- Displaying the active filter indicator when dietary restrictions are active
- Allowing favorites to be toggled directly from the meal card

**This capability is NOT responsible for:**

- Storing or managing the Never Pile (see CB_05: Never Pile Management)
- Storing or managing Favorites (see CB_04: Favorites Management)
- Combining ingredients (see CB_06: Ingredient Aggregation)
- Managing the Shopping List (see CB_07: Shopping List)
- Dietary preference configuration (see CB_02: Dietary Preferences)

---

## Functional Rules

### API Batching

- The Spoonacular API must be called in batches of 20–25 meals per request
- A new API call must only be made when the current pool is fully depleted
- Active dietary restrictions must be passed as Spoonacular `diet` and `intolerances` parameters on every API call
- Never Pile meal IDs must be excluded from the rendered deck after the API response is received
- No meals results are guaranteed — the deck may be smaller than the batch size after exclusions are applied

### Meal Cards

- Each card must display: meal name, photo, and prep time
- Tapping a card must expand it to reveal: ingredients list and difficulty level
- Tapping again (or a close action) must collapse the card back to its default state
- A star icon must be present on every card for toggling favorites
- The star icon must reflect the current favorite state (active/inactive) at all times
- Favoriting a meal is independent of swiping — a user may favorite a meal and still swipe Yes, No, or Never on it

### Swipe Outcomes

**Yes:**
- The meal is added to the basket
- The meal is removed from the swipe deck
- No confirmation is required

**No:**
- The meal is removed from the current swipe pool
- The meal may reappear in future sessions
- No confirmation is required

**Never:**
- A confirmation step must be presented before the meal is permanently dismissed
- The confirmation must offer 5 optional reason chips:
  - "I don't like these ingredients"
  - "Too complex to make"
  - "Too expensive to make"
  - "Not our style of food"
  - "Dietary concern not listed"
- Reason selection is optional — the user may confirm without selecting a reason
- Upon confirmation, the meal is passed to the Never Pile capability for permanent storage
- The meal is immediately removed from the swipe deck
- The dismissal reason (if provided) is stored alongside the Never Pile record for future AI use

### Basket

- The basket is a persistent collection of Yes meals for the current household
- The basket persists across app opens until meals are explicitly removed or converted to a shopping list
- Users can open the basket at any time during the swipe session to review selected meals
- Each meal in the basket is displayed as a card (name, photo, prep time)
- Users can remove a meal from the basket — removed meals return to the swipe deck as unmarked cards
- There is no maximum basket size in v1
- The basket must display a count of currently selected meals

### Swipe Deck Management

- The swipe deck presents one card at a time
- The deck is drawn from the current batch pool, minus No swipes and Never Pile meals
- When the deck is depleted, the remaining pool (No-swiped meals) is reshuffled and presented again
- If the reshuffled pool is also empty, a fresh API call is made for a new batch
- No meals are repeated within a single batch unless the pool has been fully reshuffled

### Empty State

- When all meals in the current pool have been swiped and the reshuffled pool is also empty, an empty state screen must be displayed
- The empty state must:
  - Communicate that the user has reached the end of available meals
  - Encourage the user to review or loosen their dietary filters
  - Provide a direct link to Dietary Preferences in Account Settings
  - Provide a button to reload the deck (triggers a fresh API call)

### Active Filter Indicator

- When dietary restrictions are active, a subtle indicator must be visible on the Meal Discovery screen
- The indicator must provide a direct path to Dietary Preferences in Account Settings
- The indicator must not interrupt the swipe experience

### Session Behavior

- The swipe deck resets with a fresh batch at the start of each session
- No meals are excluded from the fresh batch except Never Pile meals
- The basket persists across sessions until explicitly cleared or converted

---

## Constraints

- Meal data must be sourced exclusively from the Spoonacular API in v1
- API calls must be batched to minimize usage and cost
- Never Pile exclusions are applied client-side after the API response is received
- Swipe gestures must be implemented using react-spring and @use-gesture for smooth, physics-based animations
- The swipe deck must be performant on mobile PWA (touch-first interactions)

---

## Not In Scope

- User-generated or custom recipes
- AI-suggested meals based on history (future Premium feature)
- Cuisine-style filtering
- Calorie or macro display on cards
- Meal ratings or reviews
- Social sharing of meals
- Meal scheduling to specific days of the week

---

## Edge Cases

- Never Pile exclusions reduce the batch to zero visible cards — empty state is shown immediately
- User removes a meal from the basket — it re-enters the deck as an unmarked card
- User swipes Never on a meal they previously favorited — the meal is added to the Never Pile but the favorite is not automatically removed (handled by CB_04)
- User closes the app mid-swipe — basket persists, deck resets on next open
- Spoonacular API returns an error or times out — a graceful error state must be shown with a retry option
- Dietary filters are changed mid-session — changes take effect on the next session's API call, not the current deck
- User has a very large Never Pile that significantly reduces available meals — empty state is shown sooner
- User swipes through entire batch and reshuffled pool with meals still in the Never Pile — only non-Never meals are shown in reshuffle

---

## Success Metrics

- Meal cards load without perceptible delay during normal swiping
- API batch calls are not made more than once per depleted pool
- Yes meals appear in the basket immediately and correctly
- Never confirmation flow completes without errors and meals do not reappear in the deck
- Basket persists correctly across app opens
- Empty state is shown when the pool is exhausted and the reload button triggers a fresh API call
- Active filter indicator is visible when restrictions are applied

---

## Example Workflow

1. User opens the app — session is established, dietary preferences and Never Pile are resolved
2. Spoonacular API is called with active filters — a batch of 20–25 meals is returned
3. Never Pile meal IDs are excluded from the rendered deck
4. User is presented with the first meal card (name, photo, prep time)
5. User taps the card to see ingredients and difficulty, then taps again to collapse
6. User swipes Yes — meal is added to the basket, next card is shown
7. User taps the star on a card — meal is favorited, swipe is still required separately
8. User swipes Never — confirmation step appears with 5 reason chips
9. User selects "Not our style of food" and confirms — meal is added to the Never Pile and removed from the deck
10. User taps the basket icon — reviews selected meals, removes one, it returns to the deck
11. User depletes the deck — reshuffle occurs automatically
12. User depletes the reshuffled pool — empty state is shown with filter suggestions and a reload button
13. User taps reload — a fresh API batch is fetched and the deck resumes
14. User decides they have enough meals and navigates to the basket to proceed to Ingredient Aggregation

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- Swipe gestures: react-spring + @use-gesture
- Meal data source: Spoonacular API (batch queries with diet and intolerance filters)
- Basket persistence: Supabase (linked to subscription/user record)
- Never Pile exclusion: applied client-side post-API response using stored Never Pile meal IDs

### Dependencies

- CB_01: Authentication & Subscription (session, subscription tier)
- CB_02: Dietary Preferences (active filter parameters for API calls)
- CB_04: Favorites Management (star toggle state on cards)
- CB_05: Never Pile Management (excluded meal IDs, Never confirmation storage)
- CB_06: Ingredient Aggregation (basket contents passed for combining)
- Spoonacular API key and account with sufficient request quota

### Data Model

**Basket record (persisted per subscription):**
- `subscription_id`
- `meals` (array of meal objects)
- `updated_at`

**Meal object (within basket):**
- `meal_id` (Spoonacular ID)
- `name`
- `photo_url`
- `prep_time`
- `ingredients` (array — fetched on card expand or pre-fetched in batch)
- `difficulty`
- `added_at`

**Never Pile dismissal record:**
- `subscription_id`
- `meal_id`
- `meal_name`
- `dismissed_at`
- `reason` (optional — one of 5 predefined values | null)

**Session swipe state (client-side only, not persisted):**
- `current_pool` (array of meal IDs in the current batch)
- `no_swiped` (array of meal IDs swiped No in the current session)

### Key Rules

- Basket is persisted to Supabase on every Yes swipe and every removal
- Session swipe state (No pile) is client-side only and resets each session
- Never Pile records are written to Supabase immediately on confirmation
- Spoonacular API is called with `diet` and `intolerances` parameters derived from CB_02
- Never Pile meal IDs are filtered from the rendered deck after each API response
- Ingredient data may be fetched lazily (on card tap) or eagerly (pre-fetched in batch) — implementation decision for Claude Code based on Spoonacular API rate limits
- The basket meal count badge must reactively update on every add and remove action
