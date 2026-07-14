# Capability Brief (CB): Ingredient Classification

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Ingredient Classification |
| **CB Number** | CB_16 |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |
| **Depends On** | CB_13 (Item Catalog), CB_14 (Weekly List Builder) |
| **Required By** | None |

---

## Problem

Every time a recipe introduces a new ingredient that isn't in the household's Item Catalog, someone has to decide which store it belongs to. In v1 this defaults to Meijer — which is safe but not optimal. Without a structured classification flow, the catalog never grows organically from real use, and the user either has to manually maintain it in Settings or accept that new ingredients always land on the Meijer list forever.

Classification should happen naturally, once, at the moment a new ingredient appears — with AI doing the legwork of suggesting the right store so the user just confirms.

---

## Outcome

When a recipe ingredient appears that isn't in the Item Catalog, the user is prompted to classify it once. AI suggests the home store and quantity based on the ingredient and what it knows about typical Aldi inventory. The user confirms or adjusts. The answer is saved permanently to the catalog — the same ingredient never needs classifying again.

Once implemented:

- Unclassified ingredients are surfaced on the generated Meijer list (CB_14) in a distinct section
- Tapping "Classify" on an unclassified item opens a classification sheet
- AI pre-fills a suggested store and quantity — the user reviews and confirms or adjusts
- Confirmed classifications are saved to the Item Catalog immediately
- Future appearances of the same ingredient route automatically — no re-classification
- Classification is entirely optional — unclassified items stay on the Meijer list indefinitely if the user never classifies them

---

## Users

**Primary users:**
- Household member reviewing unclassified ingredients after list generation

---

## System Context

Ingredient Classification is a lightweight AI-assisted layer on top of the Item Catalog (CB_13). It is triggered from the unclassified section of the Meijer list (CB_14) and writes directly to the catalog. It has no impact on the current week's list — only future weeks.

**Flow:**
```
Weekly list generated — unclassified items appear on Meijer list (CB_14)
       ↓
User taps "Classify" on an unclassified item
       ↓
Classification sheet opens
       ↓
AI called with ingredient name + household store context
       ↓
AI returns suggested store + quantity + brief rationale
       ↓
User reviews suggestion — confirms or adjusts store and quantity
       ↓
Confirmed item saved to Item Catalog (CB_13)
       ↓
Sheet closes — item remains on current Meijer list (routing change takes effect next week)
       ↓
"Classified" badge replaces "Classify" button on the current list
```

---

## Responsibilities

**This capability is responsible for:**
- Presenting the classification sheet with AI-suggested store and quantity
- Calling the Anthropic API with a focused, bounded prompt to generate the suggestion
- Saving confirmed classifications to the Item Catalog
- Updating the unclassified item's UI state after classification
- Handling AI call failures gracefully — the sheet stays open with blank fields the user can fill manually

**This capability is NOT responsible for:**
- Moving the classified item to a different store list in the current week (takes effect next week only)
- Classifying ingredients automatically without user confirmation — human always confirms
- Batch classification of multiple items at once (one at a time in v1)
- Fuzzy name matching across the catalog (exact match only in v1)

---

## Functional Rules

### Classification Trigger

- The "Classify" button appears on each unclassified item in the Meijer list's "Needs classification" section
- Classification is optional — the button can be ignored indefinitely
- Once an item is classified, the "Classify" button is replaced with a "Classified" badge for the remainder of the current week

### AI Suggestion

The AI is called with a minimal, focused prompt:

```
The user shops at three stores: Aldi (discount grocery), Meijer (full-service supermarket), and Sam's Club (bulk warehouse). 

Ingredient: "{ingredient name}"

Based on typical Aldi inventory, suggest:
1. Home store: Aldi, Meijer, or Sam's Club
2. Whether this item might be worth buying in bulk at Sam's Club (sams_substitute: true/false)
3. A rough quantity for a household of two (e.g. "1 lb", "1 can", "2 cups")
4. One sentence explaining your suggestion

Respond in JSON only:
{
  "home_store": "aldi | meijer | sams",
  "sams_substitute": true | false,
  "quantity": "string",
  "rationale": "string"
}
```

- The AI response is parsed and pre-fills the classification sheet fields
- If the AI call fails or returns unparseable JSON, the sheet opens with blank fields and a note: "Couldn't get a suggestion — fill in manually"
- The rationale is shown to the user as helper text below the store selector — it is not saved to the catalog

### Classification Sheet UI

The sheet contains:
- **Ingredient name** — read-only display at the top
- **Home store** — segmented control: Aldi / Meijer / Sam's Club (pre-filled by AI)
- **Sam's substitute** — toggle, only visible if home store is Aldi or Meijer (pre-filled by AI)
- **Quantity** — text field (pre-filled by AI)
- **AI rationale** — helper text, shown in muted style below the store selector
- **Item type** — toggle: Staple / Recipe-only (defaults to Recipe-only for new recipe ingredients)
- **Save** button — saves to catalog and closes sheet
- **Skip** button — closes sheet without saving, item remains unclassified

### Catalog Write

- On Save, a new catalog item is created via CB_13's data model
- The write is immediate — no confirmation step after the classification sheet
- If an item with the same name already exists in the catalog (edge case — shouldn't happen if CB_14's unclassified detection is working correctly), the existing item is updated rather than creating a duplicate

---

## Edge Cases

- **AI suggests Sam's Club as home store for a common grocery item** — user can override to Aldi or Meijer. AI suggestions are never locked in.
- **Ingredient name is ambiguous** — e.g. "sauce." AI will make a best guess and the rationale will reflect the uncertainty. User adjusts as needed.
- **User classifies the same ingredient differently each week** — the catalog stores one record per ingredient. The most recent classification wins. No history of classification changes is kept in v1.
- **AI call takes too long** — 5 second timeout. If exceeded, sheet opens with blank fields and manual entry fallback.
- **No internet connection** — classification sheet opens in manual-only mode with a note that AI suggestions are unavailable.

---

## Not In Scope (v1)

- Batch classification of all unclassified items at once
- Classification history or audit trail
- AI-suggested brand preferences
- Fuzzy ingredient name matching (e.g. "mozzarella cheese" matching "shredded mozzarella" in catalog)
- Auto-classification without user confirmation

---

## AI Implementation Context

### Architecture

- The Anthropic API call is made client-side using the existing pattern established for AI features in Dinder
- Model: `claude-haiku-4-5` — this is a small, bounded classification task; Haiku is fast and cheap
- Max tokens: 150 — the JSON response is tiny
- The call is made when the user taps "Classify" — not pre-fetched for all unclassified items at once
- No Edge Function required — the API key exposure model follows whatever pattern the rest of the app uses for Anthropic calls

### Key Implementation Rules

- The AI prompt must always include the three store names and their descriptions — without this context the suggestions will be generic and unhelpful
- Parse the AI response with a try/catch — never let a malformed AI response crash the classification sheet
- The classification sheet should use the existing shadcn/ui Sheet component already in the project
- The segmented store selector should use the existing shadcn/ui Tabs or ToggleGroup component
- Save writes to `catalog_items` via the same `useCatalog` hook established in CB_13
- Migration number: none — uses CB_13's tables
