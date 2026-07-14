# Capability Brief (CB): Grocery Lists (Item Catalog)

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Grocery Lists |
| **CB Number** | CB_13 |
| **Status** | Draft v2 |
| **Owner** | @Jarrod Murray |
| **Depends On** | CB_01 (Authentication & Subscription), CB_06 (Ingredient Aggregation) |
| **Required By** | CB_17 (Aldi Cart Agent) |

---

## Problem

After meal planning, the user has a list of recipe ingredients but no way to combine them with their regular weekly staples into a ready-to-shop list. Staples live in the user's head and get manually reconstructed every week from memory. There is no single place where "everything I need this week" lives before shopping.

---

## Outcome

The List page gains a "Grocery Lists" layer where the household can save named store lists (Aldi, Meijer, Sam's Club) of their regular weekly items. On any given week, the user can pull one or more of these saved lists into their current ingredient list with a single tap, toggle off anything they already have, and end up with a complete ready-to-shop list in seconds.

This is entirely optional — the List page works exactly as it does today without it.

Once implemented:

- The household can create and manage named grocery lists (e.g. "Aldi", "Meijer", "Sam's Club") from the List page
- Each list contains items with a name and optional quantity
- On the List page, a "Add from saved list" option lets the user pull any saved list into their current week's ingredients
- Items from the saved list appear with toggles — the user turns off anything they already have at home before adding
- Confirmed items merge into the main ingredient list
- The combined list (recipe ingredients + pulled staples) is what the Aldi Cart Agent (CB_17) works from
- Saved lists persist indefinitely and are shared across both users on the subscription

---

## Users

**Primary users:**
- Household members managing their weekly staples and building complete shopping lists

---

## System Context

Grocery Lists lives entirely within the List page (CB_06/CB_07). It does not affect meal planning, swiping, the basket, or any other part of the app.

**Flow — Setup (one time):**
```
User opens List page
       ↓
Taps "Manage Grocery Lists"
       ↓
Creates a new list — names it (e.g. "Aldi")
       ↓
Adds items: name + optional quantity
       ↓
Saves — list persists to Supabase at subscription level
       ↓
Repeats for Meijer, Sam's Club as desired
```

**Flow — Weekly use:**
```
User has recipe ingredients on List page (from CB_06)
       ↓
Taps "Add from saved list"
       ↓
Selects which saved list to pull from (e.g. "Aldi")
       ↓
List expands showing all items with toggles — all on by default
       ↓
User toggles off anything they already have at home
       ↓
Taps "Add to list" — checked items merge into ingredient list
       ↓
Repeat for other saved lists if desired (e.g. Meijer)
       ↓
Complete list ready — recipe ingredients + staples combined
```

---

## Responsibilities

**This capability is responsible for:**
- Storing named grocery lists in Supabase at the subscription level
- A management UI for creating, editing, and deleting saved lists and their items
- A pull UI on the List page for selecting items from a saved list to add to the current week
- Merging pulled items into the existing ingredient list without duplicates
- Persisting saved lists across sessions

**This capability is NOT responsible for:**
- Routing items to specific stores (that's the user's decision when they choose which list to pull)
- Pushing lists to any store app or API (CB_17)
- Ingredient extraction or aggregation (CB_06)
- Any AI decision-making

---

## Functional Rules

### Saved List Management

- Accessible from the List page via a "Manage Grocery Lists" option
- User can create multiple named lists — names are free text (e.g. "Aldi", "Meijer weekly", "Sam's")
- Each list item has: name (required) and quantity (optional free text, e.g. "1 gallon", "2 lbs")
- Items within a list are sorted alphabetically
- Lists can be renamed, reordered, and deleted
- Deleting a list requires confirmation — "Delete [list name]? This cannot be undone."
- There is no maximum number of lists or items per list

### Pulling a Saved List

- "Add from saved list" button appears on the List page whenever at least one saved list exists
- Tapping it opens a sheet showing all saved lists as selectable options
- Selecting a list expands it showing all items with toggles, all on by default
- The user toggles off anything they don't need this week
- "Add [N] items" button confirms — checked items are added to the current ingredient list
- If an item name already exists in the current list (case-insensitive match), it is not duplicated — the existing entry is kept and the pulled item is skipped silently
- The user can pull from multiple saved lists in the same session — each pull is a separate action
- Pulled items are visually distinguished in the ingredient list with a small tag indicating which saved list they came from (e.g. "Aldi") so the user knows their origin

### Optional Layer

- If the user never sets up any saved lists, the List page looks and behaves exactly as it does today
- No prompts, nudges, or empty states push the user toward setting up grocery lists
- The "Add from saved list" button only appears once at least one saved list exists

---

## Edge Cases

- **User pulls same list twice in one session** — duplicate prevention (case-insensitive name match) handles this — second pull adds nothing since all items already exist in the list
- **Saved list is empty** — still selectable but "Add [N] items" shows "Add 0 items" and is disabled
- **Both users edit a saved list simultaneously** — last write wins in v1, no conflict UI
- **User pulls a list then edits the saved list** — changes to the saved list do not retroactively affect the current week's pulled items

---

## Not In Scope (v1)

- Per-item store assignment or routing logic
- Automatic weekly list generation
- Skip-this-week state persistence
- Budget tracking or price estimation
- Barcode scanning

---

## AI Implementation Context

### Architecture

- Two new Supabase tables: `grocery_lists` and `grocery_list_items`
- Both scoped to `subscription_id`
- A new `useGroceryLists` hook handles all reads and writes
- The pull UI is a shadcn Sheet component — consistent with the rest of the app's sheet pattern
- Pulled items are added to the existing ingredient list state in CB_06/CB_07 — no separate list state needed

### Data Model

```sql
create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, lower(name))
);

create table public.grocery_list_items (
  id uuid primary key default gen_random_uuid(),
  grocery_list_id uuid not null references public.grocery_lists(id) on delete cascade,
  name text not null,
  quantity text,
  created_at timestamptz not null default now()
);
```

### Key Implementation Rules

- Migration number: 013
- The pull UI should feel fast and lightweight — load the saved list items when the sheet opens, not before
- Duplicate detection on pull uses `lower(name)` comparison against existing ingredient list items
- The "from [list name]" tag on pulled items uses the existing badge component in the project
- No server functions required — all reads and writes are direct Supabase client calls
