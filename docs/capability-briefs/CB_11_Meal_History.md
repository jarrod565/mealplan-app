# Capability Brief (CB): Meal History

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Meal History |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

Dinder has no memory of what the household has cooked before. Every session starts fresh — the app has no idea that the Taco Rice Casserole from three weeks ago was a hit, or that a meal from a saved Pinterest pin turned out to be a new household favorite. Users who want to repeat a meal have no path back to it unless they happened to favorite it at the time.

Meal History closes this loop by automatically recording every meal that made it to a generated shopping list, giving users a searchable, chronological record of what they've actually cooked — and a direct path to cook it again.

---

## Outcome

The platform provides a persistent Meal History screen that records every meal included in a generated shopping list, displayed as a simple chronological table with a direct "Make This Again" action.

Once implemented:

- Every time the user generates a shopping list, all meals in that list are recorded in Meal History with the generation date
- History is displayed as a flat, paginated table — most recent meals at the top
- Each row shows: meal name, date last made, and a "Make This Again" button
- Meals are deduplicated — if a meal appears in multiple lists, only one record exists, always showing the most recent date
- Tapping "Make This Again" adds the meal directly to the basket
- If the meal being re-added is not already a Favorite, a subtle inline prompt offers to favorite it
- If the meal is already in the basket, the button shows "Already in Basket" and is disabled
- URL-imported meals are included in History and can be re-added via their stored destination URL
- History grows indefinitely and is paginated with most recent entries always first
- Hidden is removed from the main navigation and moved to the bottom of the Settings screen
- History is added to the main navigation between List and Favorites

---

## Users

**Primary users:**
- Household members looking to repeat a previously cooked meal

---

## System Context

Meal History is written to at Shopping List generation time (CB_07) and read from the dedicated History screen. It is a subscription-level record shared across both users.

**Flow — Writing to History:**

```
User taps "Generate Shopping List" in CB_06
       ↓
Shopping List is created (CB_07)
       ↓
All meals in the basket at generation time are written to Meal History
       ↓
Each meal record: meal ID, source type, title, image URL, destination URL (if URL import), date generated
       ↓
If meal already exists in History → update date to most recent, do not create duplicate
```

**Flow — Reading History:**

```
User navigates to History screen
       ↓
Meal History records fetched from Supabase (paginated, most recent first)
       ↓
Table displayed: meal name, date last made, Make This Again button
       ↓
User taps "Make This Again"
       ↓
Meal added to basket
       ↓
If meal is not already a Favorite → inline prompt: "Add to Favorites too?"
       ↓
User taps Yes → meal added to Favorites
User taps No → prompt dismissed, no action
```

This capability is written to by:
- CB_07: Shopping List (triggers history write on list generation)

This capability reads from:
- CB_03: Meal Discovery (basket — for "Already in Basket" state)
- CB_04: Favorites Management (for favorite state check and favorite action)

---

## Responsibilities

**This capability is responsible for:**

- Recording all basket meals to History when a shopping list is generated
- Deduplicating History records — one record per meal, updated to most recent date
- Providing the History screen with a paginated, chronological meal table
- "Make This Again" action — adding meals back to the basket
- Inline favorite prompt when re-adding a non-favorited meal
- "Already in Basket" state on the Make This Again button
- Handling URL-imported meal re-addition via stored destination URL
- Navigation restructure — Hidden moved to Settings, History added to nav

**This capability is NOT responsible for:**

- Managing the basket (see CB_03)
- Managing Favorites (see CB_04)
- Generating the Shopping List (see CB_07)
- Influencing the Explore or For You swipe decks based on history

---

## Functional Rules

### Writing to History

- History records are written immediately when the user generates a shopping list in CB_06
- Every meal in the basket at generation time is written — Spoonacular meals, URL imports, and Pinterest pins (when CB_09 is implemented)
- Each record stores: `meal_id`, `source_type`, `title`, `image_url`, `destination_url` (for URL imports), `subscription_id`, `last_made_at`
- If a meal already exists in History (matched by `meal_id`), update `last_made_at` to the current date — do not create a duplicate record
- History write must not block or delay Shopping List generation — write asynchronously

### History Screen

- History is accessible from the bottom navigation bar (mobile) and sidebar (desktop) under the label "History"
- History is positioned between List and Favorites in the navigation
- Meals are displayed as a flat paginated table — most recent `last_made_at` first
- Each row displays: meal image (small thumbnail), meal name, date last made (formatted as "Month Day, Year"), and a "Make This Again" button
- Pagination loads additional records on scroll or via a "Load more" button — page size 20 records
- If History is empty, show a friendly empty state: "Nothing here yet. Meals you've planned will appear here after you generate your first shopping list."

### Make This Again

- Tapping "Make This Again" adds the meal directly to the basket
- For Spoonacular meals: adds using the stored `meal_id` and metadata
- For URL-imported meals: re-adds using the stored `destination_url` — ingredients are fetched via the CB_10 extraction pipeline when the basket drawer is opened or the Ingredients page is loaded
- If the meal is already in the basket: button shows "Already in Basket" and is disabled — same pattern as Favorites
- No confirmation is required to add to basket

### Inline Favorite Prompt

- After tapping "Make This Again," check if the meal is already in the user's Favorites list
- If already a Favorite: no prompt shown
- If not a Favorite: show a subtle inline prompt directly below the row: "Add to Favorites too?" with "Yes" and "No" options
- Tapping "Yes" adds the meal to Favorites and dismisses the prompt
- Tapping "No" dismisses the prompt with no action
- The prompt dismisses automatically if the user scrolls or interacts with another row
- Only one inline prompt may be visible at a time

### Navigation Restructure

- "Hidden" is removed from the bottom navigation bar (mobile) and sidebar (desktop)
- "Hidden" is added to the bottom of the Settings screen as a tappable section: "Hidden Meals" with a chevron, navigating to the existing Hidden screen
- "History" is added to the navigation between "List" and "Favorites"
- Bottom nav order (mobile): Explore, For You (conditional), List, History, Favorites
- Sidebar order (desktop): same order
- Settings screen must include a "Hidden Meals" row that navigates to the Hidden screen

### Deduplication

- Meal identity is determined by `meal_id` for Spoonacular and Pinterest meals, and by `destination_url` for URL-imported meals
- When a meal is generated to a list a second time, its existing History record is updated — `last_made_at` is set to the new date
- The meal moves to the top of the History table as a result of the updated date
- No duplicate rows ever appear in the History table

---

## Constraints

- History records must be stored in Supabase on the subscription record
- History writes must be non-blocking — Shopping List generation must not wait for History writes to complete
- Pagination must be implemented server-side — do not fetch all records at once
- The Hidden screen itself is unchanged — only its navigation entry point moves to Settings

---

## Not In Scope

- Searching or filtering History by meal name or date
- Sorting History by anything other than most recent first
- Displaying how many times a meal has been made
- Influencing the Explore or For You swipe deck based on History
- Bulk actions on History (e.g. clear all, re-add multiple meals at once)
- Notes or ratings on historical meals

---

## Edge Cases

- User generates a shopping list with meals already in History — records update to new date, meals move to top of table
- User taps "Make This Again" on a URL-imported meal whose destination URL is no longer accessible — meal is added to basket, extraction fails gracefully at ingredient aggregation time per CB_10 error handling
- User taps "Make This Again" on a meal already in the basket — button shows "Already in Basket," no duplicate added
- User taps "Yes" on the favorite prompt for a meal already in Favorites (race condition) — Favorites add is idempotent, no duplicate created
- History is empty on first use — empty state shown with encouraging copy
- User generates a list with zero meals in the basket — no History records written
- Pagination edge: exactly 20 records — "Load more" appears, tapping it returns zero additional records and the button is hidden

---

## Success Metrics

- All basket meals are correctly written to History on every Shopping List generation
- Duplicate meals are never shown — only the most recent entry per meal
- "Make This Again" correctly adds meals to the basket for both Spoonacular and URL-imported sources
- Inline favorite prompt appears only for non-favorited meals and dismisses correctly on both actions
- "Already in Basket" state is accurate and consistent with the basket contents
- Hidden is accessible via Settings and functions identically to its previous behavior
- History navigation item appears correctly between List and Favorites

---

## Example Workflow

1. User selects 4 meals for the week and taps "Generate Shopping List" in CB_06
2. Shopping List is created — 4 History records are written asynchronously
3. Two of the 4 meals were already in History from a previous week — their `last_made_at` is updated, they move to the top
4. User navigates to History — sees a table of past meals, most recent first
5. User spots "Taco Rice Casserole" from three weeks ago and taps "Make This Again"
6. Meal is added to the basket immediately
7. Inline prompt appears below the row: "Add to Favorites too?"
8. User taps "Yes" — meal is added to Favorites, prompt dismisses
9. User taps "Make This Again" on a second meal already in the basket — button shows "Already in Basket"
10. User navigates to Settings → scrolls to bottom → taps "Hidden Meals" → Hidden screen opens as before

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- History storage: Supabase (subscription-level table)
- Pagination: server-side via Supabase range queries
- Navigation: restructured bottom nav (mobile) and sidebar (desktop)

### Dependencies

- CB_03: Meal Discovery (basket state — "Already in Basket" check)
- CB_04: Favorites Management (favorite state check, add to Favorites action)
- CB_07: Shopping List (triggers History write on list generation)
- CB_09: Connected Sources (Pinterest meal re-addition — future)
- CB_10: URL Recipe Import (URL-imported meal re-addition via destination URL)

### Data Model

**Meal History record (persisted per subscription):**
- `history_id`
- `subscription_id`
- `meal_id` (Spoonacular ID, Pinterest pin ID, or null for URL imports)
- `source_type` (spoonacular | url_import | pinterest)
- `title`
- `image_url`
- `destination_url` (for url_import source type — null for Spoonacular)
- `last_made_at` (timestamp — updated on each re-generation)
- `created_at` (timestamp — set once on first generation, never updated)

### Key Rules

- History writes are fire-and-forget — use async write that does not block Shopping List generation or navigation
- Upsert on `meal_id` (Spoonacular/Pinterest) or `destination_url` (URL imports) — never insert duplicates
- Fetch History records with `order by last_made_at desc` and Supabase range pagination (`range(0, 19)` for first page)
- "Already in Basket" check reads from the active basket context — same source of truth used by Favorites screen
- Inline favorite prompt reads from Favorites context to determine if meal is already favorited
- Navigation restructure must update all nav components consistently — bottom nav, sidebar, and any breadcrumb or back-navigation references to Hidden
- Hidden screen component is unchanged — only its entry point in navigation moves to Settings
