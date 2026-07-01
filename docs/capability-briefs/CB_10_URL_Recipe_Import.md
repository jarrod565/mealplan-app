# Capability Brief (CB): URL Recipe Import

## Summary

| Field | Value |
|---|---|
| **Capability Name** | URL Recipe Import |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

Users have recipes saved across the web — on food blogs, recipe sites, and shared links — that they want to add to their weekly meal plan without having to swipe through a discovery deck. The current platform only supports meals sourced from Spoonacular or Pinterest boards, leaving no path for a user to bring in a specific recipe they already know they want.

A direct URL import path gives users a practical, no-friction way to add any web recipe directly to their basket.

---

## Outcome

The platform provides a URL import field on the Basket screen that allows users to paste any recipe URL, extract the recipe title and image, and add it directly to their basket — with ingredients extracted later at aggregation time.

Once implemented:

- A URL input field and "Add Meal" button appear on the Basket screen between the meal cards and the "View Ingredients List" button
- The "Add Meal" button is disabled until a value is entered in the input field
- The app validates the input as a URL before attempting extraction
- If the URL is not valid, a clear inline error is shown
- If the URL is valid, a loading indicator communicates that the app is working
- On success, a meal card is added to the basket showing the recipe title and image (via Open Graph metadata) with the source domain as a secondary label
- If the URL is already in the basket, the user is warned and given the choice to proceed or cancel
- On extraction failure, a clear error message distinguishes between "this doesn't appear to be a recipe" and "we couldn't extract the ingredients"
- Ingredients are not extracted at import time — they are extracted at Ingredient Aggregation time (CB_06) using the same Schema.org JSON-LD pipeline defined in CB_09
- The Spoonacular extract fallback and "View Recipe" link are available at aggregation time if JSON-LD extraction fails

---

## Users

**Primary users:**
- Household members who want to add a specific recipe from the web directly to their basket

---

## System Context

URL Recipe Import is a supplementary input method on the Basket screen. It sits between the meal card list and the "View Ingredients List" button and feeds into the same Ingredient Aggregation and Shopping List flow as all other basket items.

**Flow:**

```
User is on Basket screen
       ↓
User pastes a URL into the input field
       ↓
"Add Meal" button becomes active
       ↓
User taps "Add Meal"
       ↓
Input validated as a URL
       ↓
  Invalid URL → inline error: "Please enter a valid URL"
       ↓
  Valid URL → loading indicator shown
       ↓
  Duplicate URL → warning shown with option to proceed or cancel
       ↓
App fetches Open Graph metadata (title, image) from the URL
       ↓
  Success → meal card added to basket, input cleared
  Not a recipe → error: "This doesn't look like a recipe page"
  Fetch failed → error: "We couldn't reach this page. Check the link and try again."
       ↓
User taps "View Ingredients List"
       ↓
CB_06 Ingredient Aggregation attempts Schema.org JSON-LD extraction
       ↓
  Success → ingredients added to aggregation list
  Failure → friendly error with Spoonacular fallback + View Recipe link (per CB_09)
```

This capability depends on:

- CB_03: Meal Discovery (Basket screen, basket data model)
- CB_06: Ingredient Aggregation (JSON-LD extraction pipeline)
- CB_09: Connected Sources (shared extraction pipeline, fallback behavior)

---

## Responsibilities

**This capability is responsible for:**

- Rendering the URL input field and Add Meal button on the Basket screen
- Validating input as a well-formed URL before any fetch is attempted
- Fetching Open Graph metadata (title, image) from the provided URL
- Detecting whether the URL appears to be a recipe page vs. a non-recipe page
- Detecting duplicate URLs already in the basket
- Adding the imported meal card to the basket on success
- Displaying appropriate error messages for each failure mode
- Passing the URL to CB_06 for ingredient extraction at aggregation time

**This capability is NOT responsible for:**

- Extracting ingredients at import time (see CB_06)
- Managing the basket beyond adding the new card (see CB_03)
- Spoonacular fallback execution (see CB_09 extraction pipeline)

---

## Functional Rules

### Input Field and Button

- The URL input field must appear on the Basket screen between the meal card list and the "View Ingredients List" button
- Placeholder text: "Paste a recipe URL"
- The "Add Meal" button must be disabled when the input field is empty
- The "Add Meal" button must become active as soon as any value is entered in the input field
- Tapping "Add Meal" triggers URL validation before any network request is made

### URL Validation

- The input must be validated as a well-formed URL (must include a valid protocol and domain)
- If the input is not a valid URL, show an inline error immediately: "Please enter a valid URL"
- Validation must run client-side before any fetch is attempted
- Do not attempt to fetch malformed or incomplete URLs

### Duplicate Detection

- Before fetching, check if the URL already exists in the basket
- If a duplicate is detected, show a warning: "This recipe is already in your basket. Add it again?"
- Present two options: "Add Anyway" and "Cancel"
- If the user selects "Add Anyway," proceed with the fetch and add a second card
- If the user selects "Cancel," clear the input field and take no further action

### Loading State

- While the fetch is in progress, show a loading indicator in place of or alongside the "Add Meal" button
- The input field must be disabled during the fetch to prevent duplicate submissions
- If the fetch takes longer than 8 seconds, show a timeout error: "This is taking too long. Check the link and try again."

### Open Graph Metadata Fetch

- On a valid URL, the app must fetch the page and attempt to extract:
  - Recipe title (from `og:title` or `<title>` tag as fallback)
  - Recipe image (from `og:image`)
  - Source domain (parsed from the URL)
- If `og:image` is not available, the card must display a generic placeholder image
- If no title can be extracted, show an error: "We couldn't read this page. Check the link and try again."

### Recipe Detection

- After fetching, the app must attempt to determine whether the page is a recipe
- Detection method: check for the presence of Schema.org JSON-LD with `@type: "Recipe"` or `@type: "HowTo"` in the page source
- If no recipe schema is detected, show a warning: "This doesn't look like a recipe page. Do you still want to add it?"
- Present two options: "Add Anyway" and "Cancel"
- If the user selects "Add Anyway," add the card using whatever title and image were found
- This detection is a best-effort check — it must not block imports from recipe sites that don't use Schema.org markup

### Basket Card

- Successfully imported URL recipes appear as cards in the basket alongside Spoonacular and Pinterest cards
- Each card must display: recipe title, image (or placeholder), and source domain (e.g. "simplyrecipes.com")
- A link icon or subtle badge must indicate the card was imported by URL (not from Spoonacular or Pinterest)
- The card must include a remove action (same as other basket cards)
- Tapping the card opens the ingredient drawer (same behavior as Basket cards per CB_03) — ingredient data is not available until aggregation

### Data Stored in Basket

- `source_type` (url_import)
- `destination_url` (the pasted URL)
- `title` (extracted from Open Graph or page title)
- `image_url` (extracted from Open Graph, or null if unavailable)
- `source_domain` (parsed from the URL)
- `added_at`

### Error Messages

| Scenario | Message |
|---|---|
| Input is not a valid URL | "Please enter a valid URL" |
| URL already in basket | "This recipe is already in your basket. Add it again?" |
| Page could not be reached | "We couldn't reach this page. Check the link and try again." |
| Page loaded but no title found | "We couldn't read this page. Check the link and try again." |
| Page doesn't appear to be a recipe | "This doesn't look like a recipe page. Do you still want to add it?" |
| Fetch timed out | "This is taking too long. Check the link and try again." |

---

## Constraints

- Open Graph metadata fetch must be performed client-side where possible; a server-side proxy may be required if CORS blocks direct client fetches from recipe sites
- No Pinterest API is used by this capability
- Ingredient extraction is deferred to CB_06 — this capability only handles the import and basket card creation
- The Schema.org recipe detection check is best-effort only — it must not prevent imports from valid recipe pages that lack structured markup

---

## Not In Scope

- Extracting ingredients at import time
- Bulk URL import (multiple URLs at once)
- Browser extension or share-sheet triggered import
- Saving imported URLs as favorites at import time
- Auto-detecting recipe URLs from clipboard on app open

---

## Edge Cases

- User pastes a URL to a paywalled recipe site — Open Graph metadata may still be fetchable even if the full page is not; card is added with whatever data is available
- User pastes a Pinterest pin URL — the app must detect this and suggest connecting Pinterest via Settings → Integrations instead
- User pastes a shortened URL (e.g. bit.ly) — the app must follow redirects to the final URL before extracting metadata
- User pastes a URL to a YouTube cooking video — recipe schema unlikely; "doesn't look like a recipe" warning shown
- User pastes a URL to an image file — fetch will fail gracefully with "couldn't read this page" error
- Open Graph image is a very large file — image must be displayed with standard CSS constraints, not fetched in full

---

## Success Metrics

- Valid recipe URLs result in a basket card being added within a reasonable time
- Invalid URLs are caught client-side before any network request is made
- Duplicate URLs are detected and the user is given a clear choice
- Non-recipe pages show a warning that allows the user to proceed or cancel
- Unreachable pages show a clear, actionable error message
- Imported cards are visually distinguishable from Spoonacular and Pinterest cards in the basket
- Ingredient extraction at aggregation time works correctly for URL-imported recipes using the CB_09 pipeline

---

## Example Workflow

1. User is on the Basket screen with two Spoonacular meals already added
2. User pastes `https://www.simplyrecipes.com/recipes/chicken_tikka_masala/` into the URL input field
3. "Add Meal" button becomes active
4. User taps "Add Meal" — loading indicator appears
5. App fetches Open Graph metadata — title and image found, Schema.org recipe markup detected
6. Meal card appears in the basket: "Chicken Tikka Masala" with photo and "simplyrecipes.com" label
7. Input field is cleared and ready for another URL
8. User pastes the same URL again — duplicate warning appears: "This recipe is already in your basket. Add it again?"
9. User taps Cancel — input is cleared, no duplicate added
10. User taps "View Ingredients List" — CB_06 aggregation begins
11. For the URL-imported card, JSON-LD extraction succeeds — ingredients appear in the aggregation list alongside the Spoonacular meal ingredients

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- Open Graph fetch: client-side fetch with CORS proxy fallback if needed
- Recipe detection: Schema.org JSON-LD check in fetched page source
- Ingredient extraction: CB_09 JSON-LD pipeline (deferred to aggregation time)
- Basket storage: Supabase (same basket record as CB_03)

### Dependencies

- CB_03: Meal Discovery (Basket screen, basket data model, card component)
- CB_06: Ingredient Aggregation (ingredient extraction at aggregation time)
- CB_09: Connected Sources (shared JSON-LD extraction and Spoonacular fallback pipeline)

### Data Model

**URL import basket entry:**
- `source_type` (url_import)
- `destination_url`
- `title`
- `image_url` (nullable)
- `source_domain`
- `added_at`

### Key Rules

- URL validation runs client-side before any fetch — never send a malformed URL to any external service
- Duplicate check runs against `destination_url` values already in the basket before fetching
- Open Graph fetch must handle redirects (follow to final URL)
- Schema.org recipe detection is a soft check — it warns but never hard-blocks an import
- Ingredient extraction is always deferred to CB_06 — this capability never calls the Spoonacular extract endpoint directly
- Pinterest pin URLs must be detected by domain (`pinterest.com`) and redirected to an integration prompt
- All error states must be dismissible and must return focus to the input field
