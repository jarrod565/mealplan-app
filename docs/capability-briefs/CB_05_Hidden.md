# Capability Brief (CB): Hidden

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Hidden |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

When a user swipes Never on a meal, they are making a permanent household-level decision that the meal should not be shown again. Without a reliable, recoverable store for these dismissals, the platform cannot honor that decision across sessions — and users have no way to undo a mistake.

The Hidden capability must:

- Permanently exclude dismissed meals from the swipe deck
- Store the optional dismissal reason for future AI use
- Provide a dedicated screen where users can browse and recover dismissed meals
- Be accessible from the main navigation without being buried

---

## Outcome

The platform provides a subscription-level Hidden list that permanently excludes dismissed meals from the swipe deck, while giving users a recoverable escape hatch if they change their mind.

Once implemented:

- Meals confirmed as Never in the swipe deck are permanently stored in the Hidden list
- Hidden meals are excluded from all future swipe sessions
- An optional dismissal reason is captured and stored for future AI learning
- A dedicated Hidden screen is accessible from the bottom navigation (mobile) and sidebar (desktop)
- Users can browse the Hidden list as a simple scrollable list
- Users can restore any Hidden meal — it returns to the swipe deck for future sessions
- Restored meals are immediately removed from the Hidden list

---

## Users

**Primary users:**
- Household members managing permanently dismissed meals

---

## System Context

The Hidden capability is a subscription-level store that is resolved at session start and used by Meal Discovery to exclude dismissed meals from the swipe deck.

**Flow:**

```
User swipes Never on a meal (CB_03)
       ↓
Confirmation step presented
       ↓
Optional reason chip selected
       ↓
User confirms dismissal
       ↓
Meal written to Hidden list in Supabase
       ↓
Meal excluded from all future swipe deck sessions
```

```
User navigates to Hidden screen
       ↓
Scrollable list of dismissed meals displayed
       ↓
User taps Restore on a meal
       ↓
Meal removed from Hidden list
       ↓
Meal becomes available in future swipe sessions
```

This capability is written to by:

- CB_03: Meal Discovery (Never swipe confirmation flow)

This capability is read by:

- CB_03: Meal Discovery (excluded meal IDs at session start)

---

## Responsibilities

**This capability is responsible for:**

- Storing dismissed meals and their optional reasons at the subscription level
- Providing Hidden meal IDs to Meal Discovery for swipe deck exclusion
- Providing the dedicated Hidden screen with a scrollable list of dismissed meals
- Allowing users to restore dismissed meals back to the swipe deck

**This capability is NOT responsible for:**

- The Never swipe confirmation UI (see CB_03: Meal Discovery)
- Acting on dismissal reasons in v1 (data is collected for future AI use only)
- Removing restored meals from the Favorites list

---

## Functional Rules

### Hidden List Storage

- Dismissed meals must be written to the Hidden list immediately upon confirmation in CB_03
- Each Hidden record must store: meal ID, meal name, photo, dismissal timestamp, and optional reason
- Hidden records are stored at the subscription level and apply to both users
- There is no limit to the size of the Hidden list

### Swipe Deck Exclusion

- The full list of Hidden meal IDs must be resolved at session start
- Hidden meal IDs must be passed to CB_03 before the swipe deck is populated
- Any meal present in the Hidden list must never appear in the swipe deck

### Hidden Screen

- The Hidden screen must be accessible from the bottom navigation bar (mobile) and sidebar (desktop) under the label "Hidden"
- Dismissed meals must be displayed as a simple scrollable list of cards
- Each card must display: meal name and photo
- Each card must display the dismissal date
- Each card must include a Restore action
- No sorting or filtering is required in v1 — meals appear in order of most recently dismissed first

### Restore Behavior

- Tapping Restore on a Hidden meal must immediately remove it from the Hidden list
- The restored meal becomes available for future swipe sessions — it is not added to the current deck or basket
- No confirmation is required for restoring a meal
- If the restored meal is also in the Favorites list, it remains in Favorites — no automatic reconciliation

### Dismissal Reasons

- Dismissal reasons are optional and captured during the Never confirmation flow in CB_03
- Valid reason values (v1):
  - "I don't like these ingredients"
  - "Too complex to make"
  - "Too expensive to make"
  - "Not our style of food"
  - "Dietary concern not listed"
- Reasons are stored on the Hidden record and are not displayed to the user on the Hidden screen in v1
- Reason data is reserved for future Premium AI feature use

---

## Constraints

- Hidden records must be stored in Supabase on the subscription record
- Hidden meal IDs must be resolved at session start, before the Spoonacular API call is made
- Dismissal reason values must match the predefined list — no free-text input

---

## Not In Scope

- Displaying dismissal reasons to the user on the Hidden screen (future enhancement)
- Acting on dismissal reasons in v1 (reserved for AI features)
- Bulk restore or bulk dismiss actions
- Automatic removal of Hidden meals from Favorites
- Hiding meals based on criteria other than explicit user dismissal

---

## Edge Cases

- User restores a meal they previously also favorited — meal is restored to the swipe deck, Favorites entry is unchanged
- User hides a very large number of meals — the Hidden screen must scroll gracefully and the swipe deck empty state may trigger sooner
- Two users simultaneously restore and re-dismiss the same meal — last write wins
- A Spoonacular meal ID is no longer available via the API — the Hidden card should still display with cached name and photo data
- User dismisses a meal that is currently in their basket — meal is added to Hidden but must also be removed from the basket

---

## Success Metrics

- Hidden meals never reappear in the swipe deck after dismissal
- Hidden meal IDs are resolved correctly at every session start
- Restored meals reappear in the swipe deck in future sessions
- The Hidden screen displays all dismissed meals accurately
- Dismissal reasons are stored correctly and available for future AI use

---

## Example Workflow

1. User swipes Never on a meal in the swipe deck
2. Confirmation step appears with 5 optional reason chips
3. User selects "Not our style of food" and confirms
4. Meal is written to the Hidden list with the reason and timestamp
5. Meal is immediately removed from the swipe deck
6. On the next session, the meal ID is excluded before the deck is populated
7. User navigates to Hidden via the bottom nav
8. User sees the dismissed meal in the list with its dismissal date
9. User taps Restore — the meal is removed from the Hidden list
10. On the next swipe session, the meal appears in the deck again as a normal card

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- Hidden list storage: Supabase (linked to subscription record)
- Navigation: bottom nav bar (mobile) / sidebar (desktop) — label: "Hidden"

### Dependencies

- CB_01: Authentication & Subscription (subscription record)
- CB_03: Meal Discovery (Never confirmation flow writes to Hidden; Hidden IDs read at session start)

### Data Model

**Hidden record (persisted per subscription):**
- `subscription_id`
- `meal_id` (Spoonacular ID)
- `meal_name`
- `photo_url`
- `dismissed_at`
- `reason` (optional — one of 5 predefined values | null)

### Key Rules

- Hidden records are written to Supabase immediately on Never confirmation in CB_03
- The full array of Hidden meal IDs is fetched from Supabase at session start and passed to CB_03
- Restore deletes the Hidden record from Supabase — no soft delete or archive
- Dismissal reason values are stored as-is for future AI consumption — no processing in v1
- If a meal is in both the basket and Hidden (dismissed mid-session), the basket record must also be removed
