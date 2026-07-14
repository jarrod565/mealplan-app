# Capability Brief (CB): Item Catalog

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Item Catalog |
| **CB Number** | CB_13 |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |
| **Depends On** | CB_01 (Authentication & Subscription) |
| **Required By** | CB_14 (Weekly List Builder), CB_15 (Meijer Live List), CB_16 (Ingredient Classification) |

---

## Problem

Every routing and automation decision in the weekly grocery flow — which store gets which item, which staples get added automatically, how Sam's Club substitutes into the weekly order — depends on a single source of truth about the household's items. That source of truth currently lives entirely in the user's head, rebuilt from memory every week.

Without a codified Item Catalog, none of the downstream grocery automation is possible. Everything else in the grocery system is built on top of this.

---

## Outcome

The platform provides a household-level Item Catalog: a persistent, manageable list of every ingredient and staple the household buys, each tagged with the information needed to route it to the right store automatically every week.

Once implemented:

- Every item the household buys regularly lives in the catalog with a name, home store, Sam's substitute flag, rough quantity, and staple/recipe-only designation
- The catalog is browsable in Settings grouped by store (Aldi, Meijer, Sam's Club)
- Items can be added, edited, and deleted at any time
- Recipe ingredients that appear in the basket and are not yet in the catalog are flagged as unclassified — they default to Meijer until classified
- The catalog is shared across both users on the subscription
- The catalog is the sole input for store routing in CB_14 — no routing decisions are made at list generation time

---

## Users

**Primary users:**
- Household members setting up and maintaining their grocery routing rules

---

## System Context

The Item Catalog sits in Settings and feeds directly into the Weekly List Builder (CB_14). It has no dependency on the meal planning flow — it is a standalone household configuration capability.

**Flow — Initial Setup:**
```
User opens Settings → Item Catalog
       ↓
Catalog is empty — user adds staples manually
       ↓
Each item: name + home store + quantity + Sam's substitute? + staple or recipe-only
       ↓
Catalog saved to Supabase at subscription level
```

**Flow — Ongoing Maintenance:**
```
New recipe ingredient appears in basket (not in catalog)
       ↓
Item flagged as unclassified (CB_16 handles classification prompt)
       ↓
User classifies item → saved to catalog
       ↓
All future appearances of that ingredient route automatically
```

---

## Responsibilities

**This capability is responsible for:**
- Storing and managing the household Item Catalog in Supabase
- Providing a Settings UI for browsing, adding, editing, and deleting catalog items
- Exposing the catalog to CB_14 for store routing
- Flagging recipe ingredients not present in the catalog as unclassified
- Persisting the catalog across sessions at the subscription level

**This capability is NOT responsible for:**
- Generating shopping lists (CB_14)
- Classifying unclassified ingredients with AI assistance (CB_16)
- Managing the weekly skip state for staples (CB_14)
- Any interaction with store apps or APIs

---

## Functional Rules

### Item Data Model

Each catalog item has exactly these fields:
- **Name** — plain text, e.g. "Chicken thighs", "Paper towels"
- **Home store** — one of: Aldi, Meijer, Sam's Club
- **Sam's substitute** — boolean. When true, this item routes to Sam's Club instead of its home store in weeks when a Sam's trip is planned. Only relevant for items whose home store is Aldi or Meijer.
- **Quantity** — a rough quantity string, e.g. "2 lbs", "1 pack", "3 cans". Free text, not parsed or normalized.
- **Type** — one of: Staple (added to every weekly list automatically) or Recipe-only (only appears when a recipe calls for it)

### Browsing and Management

- The catalog UI lives at Settings → Item Catalog
- Items are grouped by home store: Aldi, Meijer, Sam's Club — in that order
- Within each store group, items are sorted alphabetically
- Each item row shows: name, quantity, type badge (Staple / Recipe), Sam's substitute indicator if applicable
- Tapping an item opens an edit sheet with all fields editable
- A delete option is available in the edit sheet with a confirmation step
- An "Add Item" button is always visible, opening a new item sheet with all fields blank except type defaulting to Staple

### Unclassified Items

- When the Weekly List Builder (CB_14) encounters a recipe ingredient whose name does not match any catalog item, it flags that item as unclassified
- Unclassified items default to Meijer on the current week's list — they are not blocked from the list
- Unclassified items are surfaced to the user for classification (CB_16) but this does not block list generation

### Catalog Integrity

- Item names are case-insensitive for matching purposes — "Chicken thighs" and "chicken thighs" are the same item
- Duplicate item names within the same store are not permitted — the UI should prevent saving a duplicate
- The catalog has no maximum size limit
- Deleting an item does not affect historical shopping lists — only future list generation

---

## Edge Cases

- **Empty catalog on first use** — Weekly List Builder generates a list with all items unclassified, all defaulting to Meijer. User is prompted to set up the catalog from Settings.
- **Recipe ingredient name doesn't exactly match catalog** — e.g. recipe says "mozzarella cheese" but catalog has "shredded mozzarella." CB_16's AI classification step handles fuzzy matching on first appearance. Once classified, the mapping is saved.
- **Item deleted from catalog mid-week** — does not affect the current week's generated list, only future lists.
- **Both users edit catalog simultaneously** — last write wins. No real-time conflict resolution in v1.

---

## Not In Scope (v1)

- Barcode scanning to add items
- Price tracking or budget management
- Store-specific aisle location
- Automatic catalog population from order history
- Multiple quantity units or unit normalization (quantity is free text)
- Category grouping within a store (alphabetical only in v1)

---

## AI Implementation Context

### Architecture

- Item Catalog is a Supabase table scoped to `subscription_id`
- All catalog reads/writes go through a new `useCatalog` hook
- The catalog is loaded once per session on Settings open — not globally preloaded
- CB_14 reads the catalog at list generation time via a direct Supabase query, not through React context, to ensure it has the latest state

### Data Model

**`catalog_items` table:**
```sql
create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  name text not null,
  home_store text not null check (home_store in ('aldi', 'meijer', 'sams')),
  sams_substitute boolean not null default false,
  quantity text,
  item_type text not null default 'staple' check (item_type in ('staple', 'recipe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, lower(name))
);
```

### Key Implementation Rules

- Name matching for recipe ingredients uses `lower(name)` — case-insensitive exact match in v1, fuzzy matching deferred to CB_16
- The `sams_substitute` flag is only meaningful when `home_store` is `aldi` or `meijer` — a Sam's-home item with `sams_substitute: true` is a no-op (already going to Sam's)
- The Settings UI for this capability should follow the same card/sheet pattern used by the rest of Settings in Dinder today
- Migration number: 013
