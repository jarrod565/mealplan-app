# Capability Brief (CB): Shopping List

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Shopping List |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

Once ingredients are aggregated and finalized, users need a shopping list experience that accommodates how they actually shop — whether that's using the app directly in the store, reading items aloud to a voice assistant, or copying the list into a separate shopping app. A rigid, one-size-fits-all list will fail at least two of those three use cases.

The platform must provide:

- A clean, readable shopping list generated from the finalized ingredient list
- The ability to check off items as the user shops
- A copyable format for users who prefer to paste into another app or dictate to Alexa
- A simple, manual clear flow when shopping is complete
- A single persistent list that survives app closes until the user clears it

---

## Outcome

The platform provides a persistent, flexible shopping list that serves as the final step in the weekly meal planning flow — usable directly in the store, compatible with voice assistants, and exportable to other apps.

Once implemented:

- The Shopping List is generated from the finalized ingredient list produced by CB_06
- Items are displayed in a clean, readable list grouped by category (matching the aggregation view)
- Each item can be checked off individually — checked items are visually distinguished but remain on the list
- The full list (or remaining unchecked items) can be copied to the clipboard in a clean, pasteable format
- When all items are checked off, the app prompts the user to clear the list
- The user can manually clear the list at any time
- The Shopping List persists across app opens until explicitly cleared
- Only one Shopping List exists at a time per subscription

---

## Users

**Primary users:**
- Household members shopping in-store or coordinating grocery pickup/delivery

---

## System Context

The Shopping List is the final step in the core planning flow. It is generated from CB_06 and feeds into CB_08 for export.

**Flow:**

```
User taps "Generate Shopping List" in CB_06
       ↓
Shopping List created from finalized ingredient list
       ↓
User navigates to Shopping List (via Basket nav or auto-navigation)
       ↓
User shops — checking off items, copying list, or both
       ↓
All items checked → prompt to clear
       ↓
User clears list manually or via prompt
       ↓
Empty state displayed
```

This capability depends on:

- CB_06: Ingredient Aggregation (finalized ingredient list)

This capability feeds into:

- CB_08: Export / Share (copy/paste and export actions)

---

## Responsibilities

**This capability is responsible for:**

- Receiving and storing the finalized ingredient list from CB_06
- Displaying the Shopping List grouped by category
- Managing check-off state for each item
- Prompting the user to clear the list when all items are checked
- Allowing the user to manually clear the list at any time
- Persisting the list and check-off state across app opens
- Providing the list content to CB_08 for copy/export

**This capability is NOT responsible for:**

- Generating or editing the ingredient list (see CB_06: Ingredient Aggregation)
- Copy/export formatting and execution (see CB_08: Export / Share)
- Adding new items to the list (future enhancement)
- Managing multiple simultaneous lists (future enhancement)

---

## Functional Rules

### List Generation

- The Shopping List is created when the user taps "Generate Shopping List" in CB_06
- The list is a direct snapshot of the finalized ingredient list at that moment
- If a Shopping List already exists, the user must be warned before generating a new one — generating a new list replaces the existing one
- The list is stored in Supabase and persists until manually cleared

### List Display

- Items must be grouped by category by default, matching the category grouping from CB_06
- Supported categories (v1): Produce, Meat & Seafood, Dairy & Eggs, Pantry & Dry Goods, Frozen, Bakery, Beverages, Other
- Each item must display: ingredient name, quantity, and unit
- Checked items must be visually distinguished (e.g. struck through, muted) but must remain visible on the list
- The list must be scannable and readable in a bright grocery store environment — clean typography, sufficient contrast

### Checking Off Items

- Each item must have a checkbox or tap target to toggle its checked state
- Checked state must persist across app opens
- Checking and unchecking must be immediate with no confirmation required
- When all items are checked, the app must display a prompt: "That's everything! Clear the list?"
- The user may dismiss the prompt and keep the list as-is

### Clearing the List

- The user must be able to manually clear the entire list at any time via a clear/reset action
- Clearing the list is a destructive action — a confirmation prompt must be shown before clearing
- Once cleared, the list is deleted from Supabase and an empty state is shown
- The empty state must encourage the user to return to Plan and start building their basket

### Persistence

- The Shopping List and all check-off states must persist in Supabase across app opens
- Only one Shopping List may exist per subscription at a time
- The list remains until explicitly cleared by the user — it does not auto-expire

---

## Constraints

- The Shopping List must be stored in Supabase on the subscription record
- Check-off state must be persisted server-side — not client-side only
- The list must render cleanly on a mobile screen in portrait orientation
- Category grouping must match the categories used in CB_06

---

## Not In Scope

- Adding items to the Shopping List directly (future enhancement — currently handled in CB_06)
- Multiple simultaneous shopping lists (future enhancement)
- Sharing the list with another user outside the subscription
- Auto-expiration of the list after a set time period
- Reordering items within categories
- Store-specific aisle mapping

---

## Edge Cases

- User generates a new Shopping List while one already exists — confirmation prompt shown; existing list is replaced on confirmation
- User checks off all items and dismisses the "clear" prompt — list remains intact with all items checked
- User partially shops, closes the app, and returns — checked state is preserved exactly as left
- Shopping List is empty (all items were removed in CB_06 before generating) — this state is prevented by CB_06 disabling "Generate Shopping List" when the list is empty
- Two users are simultaneously checking off items on the same list — last write wins per item
- User clears the list mid-shop by accident — list is gone; user must return to basket and regenerate

---

## Success Metrics

- Shopping List is generated correctly from the CB_06 finalized ingredient list
- All items display with correct name, quantity, and unit
- Check-off state persists correctly across app opens
- "That's everything!" prompt appears reliably when all items are checked
- Manual clear flow works correctly with confirmation
- Empty state is shown after clearing with a path back to Plan

---

## Example Workflow

1. User taps "Generate Shopping List" from the aggregation screen in CB_06
2. Shopping List is created and user is navigated to the list screen
3. Items are displayed grouped by category (Produce, Meat & Seafood, Dairy & Eggs, etc.)
4. User is in the store — they tap each item as they place it in their cart
5. Checked items are struck through and muted but remain visible
6. User reads remaining unchecked items aloud to Alexa or copies the list to paste into Aldi's app (CB_08)
7. User checks off the final item — "That's everything! Clear the list?" prompt appears
8. User taps "Clear" — confirmation prompt shown, user confirms
9. List is cleared from Supabase, empty state is shown
10. Empty state prompts user to return to Plan to start the next week

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- List storage: Supabase (linked to subscription record)
- Check-off state: persisted to Supabase per item on every toggle
- Navigation: accessible from Basket screen post-generation and from bottom nav / sidebar

### Dependencies

- CB_06: Ingredient Aggregation (finalized ingredient list snapshot)
- CB_08: Export / Share (copy/export actions read from this list)

### Data Model

**Shopping List record (persisted per subscription):**
- `subscription_id`
- `generated_at`
- `items` (array of shopping list items)
- `cleared_at` (null until cleared)

**Shopping List item:**
- `item_id`
- `name`
- `quantity`
- `unit`
- `category`
- `is_checked` (boolean)
- `checked_at` (timestamp | null)

### Key Rules

- The Shopping List is a snapshot — changes to CB_06 after generation do not affect the list
- Check-off state is written to Supabase immediately on every toggle
- Only one Shopping List record may exist per subscription — generating a new list deletes the previous record
- Clearing the list hard-deletes the record from Supabase
- The "That's everything!" prompt is triggered client-side when all `is_checked` values are true
- CB_08 reads directly from the Shopping List record to build copy/export content
