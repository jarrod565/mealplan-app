# Capability Brief (CB): Weekly List Builder

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Weekly List Builder |
| **CB Number** | CB_14 |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |
| **Depends On** | CB_01, CB_06 (Ingredient Aggregation), CB_13 (Item Catalog) |
| **Required By** | CB_15 (Meijer Live List) |

---

## Problem

Once meals are planned and ingredients aggregated, the user still has to manually figure out what goes on which store's list, add their weekly staples from memory, and decide whether Sam's Club factors in this week. This mental overhead happens every single week and is entirely rule-based — it should be handled by code, not the user's working memory.

---

## Outcome

The platform provides a one-tap Weekly List Builder that combines recipe ingredients and household staples into store-routed lists — one per active store — ready to shop from immediately.

Once implemented:

- A single "Build this week's lists" prompt appears after ingredient aggregation (CB_06)
- The user answers one question: "Going to Sam's this week?"
- Dinder generates two or three lists simultaneously: Aldi, Meijer, and Sam's Club (if applicable)
- Every item is routed to its correct store based on the Item Catalog (CB_13)
- Weekly staples are added automatically — no manual entry required
- Staples can be skipped for the current week without affecting the catalog
- Unclassified ingredients are flagged and default to Meijer
- Lists persist until the user explicitly clears them or builds a new week's lists

---

## Users

**Primary users:**
- Household members building their weekly grocery lists after meal planning

---

## System Context

The Weekly List Builder is triggered from the existing Shopping List flow (CB_07), replacing the current single-list generation with a multi-store routed output. It reads from CB_13 (Item Catalog) and produces the inputs for CB_15 (Meijer Live List).

**Flow:**
```
User finalizes ingredient list in CB_06
       ↓
"Build this week's lists" prompt appears
       ↓
"Going to Sam's this week?" — Yes / No
       ↓
System reads Item Catalog
       ↓
Recipe ingredients matched against catalog → routed by home store
       (Sam's substitute items re-routed to Sam's if Sam's trip active)
       ↓
Unmatched recipe ingredients → flagged as unclassified → default to Meijer
       ↓
Staples (item_type = 'staple') added automatically to their home stores
       ↓
Three lists generated simultaneously (or two if no Sam's trip)
       ↓
User reviews all three lists
       ↓
Staples can be individually skipped this week via toggle
       ↓
Lists saved to Supabase — active until cleared or rebuilt
```

---

## Responsibilities

**This capability is responsible for:**
- Presenting the Sam's Club question before list generation
- Reading the Item Catalog and routing all items by store
- Auto-adding staples to the correct store lists
- Applying Sam's substitute routing when a Sam's trip is active
- Flagging unclassified ingredients and defaulting them to Meijer
- Providing a skip-this-week toggle for staples
- Persisting the generated lists to Supabase
- Displaying all active lists in a tabbed or segmented view by store

**This capability is NOT responsible for:**
- Managing the Item Catalog (CB_13)
- AI-assisted ingredient classification (CB_16)
- Real-time Aldi fallout handling (CB_15)
- Submitting orders to any store app or API

---

## Functional Rules

### List Generation

- List generation is triggered manually by the user after CB_06 — it is never automatic
- Before generating, the user must answer: "Going to Sam's this week?" — this cannot be skipped
- Generation reads the catalog at the moment the button is tapped — catalog changes after generation do not affect the current week's lists
- If a previous week's lists exist and have not been cleared, the user is warned before overwriting: "This will replace your current lists. Continue?"

### Store Routing Logic

Priority order for each item:
1. If Sam's trip is active and item has `sams_substitute: true` → Sam's Club list
2. Otherwise → item's `home_store` list
3. Recipe ingredient not found in catalog → Meijer list, flagged as unclassified

### Staples

- All `item_type: 'staple'` items are added automatically to their routed store list
- Each staple has a "Skip this week" toggle on the generated list
- Skip state is session-only — it resets when new lists are built next week
- Skipped staples are visually distinguished (muted/struck through) but remain visible on the list so the user can un-skip if needed
- Skipped staples are excluded from the Aldi order reference and Meijer in-store list

### Unclassified Items

- Unclassified items appear at the top of the Meijer list in a distinct "Needs classification" section
- Each unclassified item has a "Classify" button that triggers CB_16
- Classifying an item mid-week updates the catalog but does not move the item to a different store list for the current week — routing changes take effect next week
- The unclassified section is collapsible

### List Display

- Lists are displayed in a tabbed view: Aldi | Meijer | Sam's (tab only shown if Sam's trip active)
- Each tab shows the store's items grouped as: Recipe Ingredients, then Staples, then Unclassified (Meijer only)
- Each item shows: name and quantity
- Items can be checked off as the user shops — check state persists across app opens
- The Aldi tab has a persistent note at the top: "Place this order in the Aldi app"
- When all items on a list are checked, the user is prompted: "All done at [store]! Mark as complete?"
- Marking a store complete does not clear the other store lists

### Clearing Lists

- A "Start fresh" option clears all current lists and resets all skip and check states
- Clearing requires confirmation: "This will clear all your current lists. Ready to start a new week?"

---

## Edge Cases

- **Empty catalog** — all recipe ingredients go to Meijer as unclassified. Staples section is empty. User is shown a prompt to set up their catalog in Settings.
- **No recipe ingredients this week** — staples-only list is still generated. This is valid — some weeks the household may not plan meals but still needs staples.
- **Sam's trip active but no Sam's substitute items** — Sam's tab is shown but empty. User is informed: "No items are set to route to Sam's this week."
- **All staples skipped** — valid. The list still generates with recipe ingredients only.
- **Duplicate ingredient names across recipes** — handled by CB_06 aggregation before reaching this capability. Weekly List Builder receives a deduplicated ingredient list.

---

## Not In Scope (v1)

- Pushing lists to any store app or API
- Reordering items within a list
- Adding ad-hoc items directly to a generated list (future enhancement — use catalog for now)
- Budget estimation
- Per-store estimated totals

---

## AI Implementation Context

### Architecture

- List generation is a pure client-side operation reading from Supabase — no server function required
- Generated lists are stored in a new `weekly_lists` table, one row per store per week per subscription
- Skip state is stored as a `skipped_item_ids` array on the weekly list row — reset on new list generation
- Check state is stored as a `checked_item_ids` array on the weekly list row

### Data Model

**`weekly_lists` table:**
```sql
create table public.weekly_lists (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  store text not null check (store in ('aldi', 'meijer', 'sams')),
  week_start date not null,
  items jsonb not null default '[]'::jsonb,
  skipped_item_ids text[] not null default '{}',
  checked_item_ids text[] not null default '{}',
  sams_trip_active boolean not null default false,
  status text not null default 'active' check (status in ('active', 'complete', 'cleared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, store, week_start)
);
```

**Items JSONB shape (per item in the array):**
```json
{
  "id": "uuid",
  "name": "Chicken thighs",
  "quantity": "2 lbs",
  "source": "recipe | staple | unclassified",
  "catalog_item_id": "uuid | null"
}
```

### Key Implementation Rules

- `week_start` is always the Monday of the current week (ISO week start) — this provides natural weekly reset behavior
- The Sam's substitute routing check happens at generation time only — changing `sams_substitute` in the catalog mid-week does not affect the current lists
- The tabbed list UI should reuse the existing shadcn/ui Tabs component already in the project
- Migration number: 014
