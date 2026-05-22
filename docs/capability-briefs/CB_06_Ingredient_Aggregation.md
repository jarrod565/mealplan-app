# Capability Brief (CB): Ingredient Aggregation

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Ingredient Aggregation |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

Once a user has selected their meals for the week, they need a single consolidated ingredient list — not one list per recipe. Manually combining ingredients across multiple recipes is tedious and error-prone, especially when the same ingredient appears in different quantities or units across recipes.

The platform must:

- Combine ingredients across all basket meals into a single unified list
- Normalize units to practical grocery-shopping quantities
- Scale ingredient quantities based on a household default serving size, with per-meal override support
- Allow users to modify, remove, or add ingredients before generating the shopping list
- Present the list in a user-friendly grouped format by default, with a flat view option

---

## Outcome

The platform provides a smart ingredient aggregation screen that combines, normalizes, and scales all ingredients from the user's basket into a single editable list ready to become a shopping list.

Once implemented:

- Tapping "View Ingredients List" from the basket triggers aggregation
- Ingredients from all basket meals are combined into a single list
- Duplicate ingredients are merged with quantities summed and units normalized to practical grocery units
- Quantities are scaled based on the household's default serving size setting
- Individual meal serving sizes can be adjusted per meal before or during aggregation
- The list is grouped by category by default (produce, meat, dairy, pantry, etc.) with a toggle to switch to a flat view
- Users can modify quantities, remove ingredients they already have, or add custom ingredients
- The modified list is used to generate the Shopping List

---

## Users

**Primary users:**
- Household members reviewing and editing the combined ingredient list before shopping

---

## System Context

Ingredient Aggregation sits between the Basket and the Shopping List. It is triggered manually by the user and produces an editable ingredient list that feeds directly into the Shopping List capability.

**Flow:**

```
User reviews Basket
       ↓
User taps "View Ingredients List"
       ↓
Serving size confirmed or adjusted per meal
       ↓
Ingredients fetched for all basket meals (Spoonacular)
       ↓
Ingredients combined, units normalized, quantities scaled
       ↓
Aggregated list displayed (grouped by category by default)
       ↓
User modifies list (edit quantities, remove, add custom items)
       ↓
User taps "Generate Shopping List"
       ↓
Shopping List created (CB_07)
```

This capability depends on:

- CB_03: Meal Discovery (basket contents)
- CB_01: Authentication & Subscription (household size preference)

This capability feeds into:

- CB_07: Shopping List

---

## Responsibilities

**This capability is responsible for:**

- Fetching ingredient data for all basket meals from Spoonacular
- Scaling ingredient quantities based on household default serving size and per-meal adjustments
- Combining duplicate ingredients across meals
- Normalizing units to practical grocery-shopping units
- Grouping ingredients by category (default) with a flat view toggle
- Providing an editable ingredient list (modify, remove, add)
- Passing the finalized ingredient list to the Shopping List capability

**This capability is NOT responsible for:**

- Managing the basket (see CB_03: Meal Discovery)
- Storing or displaying the Shopping List (see CB_07: Shopping List)
- Household size preference storage (see CB_01: Authentication & Subscription)
- AI-driven substitution suggestions (future Premium feature)

---

## Functional Rules

### Triggering Aggregation

- Aggregation is triggered by tapping "View Ingredients List" from the Basket screen
- The button must only be active when the basket contains at least one meal
- Tapping the button does not clear the basket — the basket remains intact

### Serving Size Scaling

- Each meal in Spoonacular has a default serving size (number of servings the recipe yields)
- The household default serving size is set in Account Settings and applied to all meals at aggregation time
- Scaling multiplier = household default serving size ÷ recipe's default serving size
- Each meal must display its scaled serving size on the aggregation screen
- Users must be able to adjust the serving size per meal directly on the aggregation screen
- Adjusting a per-meal serving size must immediately recalculate that meal's ingredient quantities
- Per-meal serving size adjustments are session-only and do not persist

### Ingredient Combining

- Ingredients with the same name must be merged into a single line item
- Quantities must be summed after unit normalization
- If the same ingredient appears in incompatible units that cannot be normalized (e.g. "2 cloves garlic" + "1 tsp garlic powder"), they must remain as separate line items
- Ingredient names must be normalized for matching (case-insensitive, singular/plural handled)

### Unit Normalization

- Units must be converted to the most practical grocery-shopping unit before combining
- Normalization rules:
  - Volume: convert to fluid ounces, cups, or the nearest standard container size where applicable
  - Weight: convert to ounces or pounds
  - Small quantities (tsp, tbsp) may remain as-is if the combined total is still a small quantity
  - Whole/countable items (eggs, garlic cloves, lemons) remain as counts
- The goal is a quantity the user can act on at the grocery store — not a precise culinary measurement

### List Display

- The aggregated list must be grouped by category by default
- Supported categories (v1): Produce, Meat & Seafood, Dairy & Eggs, Pantry & Dry Goods, Frozen, Bakery, Beverages, Other
- A toggle must allow the user to switch to a flat alphabetical list view
- The view preference is session-only and does not persist

### List Editing

- Users must be able to edit the quantity of any ingredient
- Users must be able to remove any ingredient from the list (e.g. "we already have this")
- Users must be able to add custom ingredients not derived from any recipe
- Edits are applied to the aggregated list only — they do not affect the original recipe data or the basket
- There is no undo for edits in v1 — users may re-trigger aggregation from the basket to start fresh

### Generating the Shopping List

- Tapping "Generate Shopping List" passes the finalized ingredient list to CB_07
- Once the Shopping List is generated, the user is navigated to the Shopping List screen
- Generating a Shopping List does not clear the basket or the aggregated list in v1

---

## Constraints

- Ingredient data must be sourced from the Spoonacular API
- Unit normalization must be handled client-side using a defined conversion ruleset
- Category assignment for ingredients must use Spoonacular's aisle or category metadata where available, with a fallback to "Other"
- Serving size scaling must use the Spoonacular recipe's reported yield as the baseline

---

## Not In Scope

- AI-driven ingredient substitutions (future Premium feature)
- Pantry management ("what do I already have at home")
- Nutritional information display
- Cost estimation per ingredient
- Automatic removal of ingredients the user has previously said they own
- Persistent list editing preferences

---

## Edge Cases

- Two meals use the same ingredient in units that cannot be normalized — displayed as separate line items with a visual indicator
- A meal's ingredient data is unavailable from Spoonacular — the meal is listed with a warning and its ingredients are excluded from aggregation
- User sets a very large serving size multiplier — quantities may result in awkward numbers; displayed as-is for user to modify
- Basket contains only one meal — aggregation still runs normally, no combining required
- User removes all ingredients from the list — "Generate Shopping List" should be disabled or warn the user
- User adds a custom ingredient with no category — assigned to "Other"
- User navigates away from the aggregation screen mid-edit — edits are lost; user must re-trigger aggregation

---

## Success Metrics

- All basket meals contribute ingredients to the aggregated list without errors
- Duplicate ingredients are correctly merged with accurate combined quantities
- Unit normalization produces grocery-friendly quantities
- Serving size scaling produces correct quantities for the household default and per-meal overrides
- The category grouped view correctly organizes all ingredients
- User edits (modify, remove, add) are reflected immediately in the list
- "Generate Shopping List" correctly passes the finalized list to CB_07

---

## Example Workflow

1. User has 5 meals in their basket and taps "View Ingredients List"
2. Aggregation screen loads showing each meal with its scaled serving size based on household default (6 servings)
3. User adjusts one meal to 10 servings — its ingredient quantities update immediately
4. Ingredients from all 5 meals are combined, normalized, and grouped by category
5. User sees "Chicken Broth — 48 fl oz" (combined from two recipes that each called for different amounts)
6. User removes "Salt" — they already have it at home
7. User edits "Olive Oil — 12 fl oz" down to "8 fl oz"
8. User adds a custom item: "Paper Towels"
9. User toggles to flat view to scan the full list alphabetically
10. User taps "Generate Shopping List" — the finalized list is passed to CB_07 and the user is navigated to the Shopping List screen

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- Ingredient data source: Spoonacular API (per-meal ingredient fetch)
- Unit normalization: client-side conversion logic (custom ruleset)
- Category grouping: Spoonacular aisle/category metadata with fallback

### Dependencies

- CB_01: Authentication & Subscription (household default serving size from Account Settings)
- CB_03: Meal Discovery (basket meal IDs and Spoonacular meal data)
- CB_07: Shopping List (receives finalized ingredient list)
- Spoonacular API (ingredient data including quantities, units, and aisle metadata)

### Data Model

**Aggregated ingredient item:**
- `ingredient_id` (derived from Spoonacular)
- `name` (normalized)
- `quantity` (scaled and combined)
- `unit` (normalized to grocery unit)
- `category` (from Spoonacular aisle metadata | "Other")
- `is_custom` (boolean — true for user-added items)
- `source_meal_ids` (array of meal IDs that contributed this ingredient)

**Per-meal serving size override (session-only, not persisted):**
- `meal_id`
- `default_servings` (from Spoonacular)
- `adjusted_servings` (user override for this session)
- `scaling_multiplier` (adjusted_servings ÷ default_servings)

**Household size preference (stored in Account Settings — CB_01):**
- `subscription_id`
- `default_serving_size` (integer — number of people)

### Key Rules

- Ingredient combining is performed client-side after all meal ingredient data is fetched
- Unit normalization runs before combining — all quantities converted to a common unit before summing
- Spoonacular aisle metadata is used for category assignment; unmapped ingredients fall to "Other"
- Per-meal serving size adjustments are client-side only and reset if the user navigates away
- The finalized ingredient list passed to CB_07 is a snapshot — subsequent edits to the aggregation screen do not affect a generated Shopping List
- "Generate Shopping List" is disabled if the ingredient list is empty
