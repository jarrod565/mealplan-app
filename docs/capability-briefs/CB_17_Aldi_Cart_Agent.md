# Capability Brief (CB): Aldi Cart Agent

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Aldi Cart Agent |
| **CB Number** | CB_17 |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |
| **Depends On** | CB_13 (Grocery Lists), CB_06 (Ingredient Aggregation) |
| **Required By** | None |

---

## Problem

Even with a complete ingredient list in Dinder, the user still has to manually open Aldi's website, search for each item, find the right product, and click Add — one by one, for every item on the list. For a typical weekly shop this is 20-40 individual actions that take 10-15 minutes and require the user's full attention. It is the most time-consuming remaining step in the weekly grocery workflow.

---

## Outcome

From the List page, the user taps "Send to Aldi Cart" and a browser agent works through their list automatically — navigating to `aldi.us/store/aldi/buy_it_again`, matching each item against previously purchased products, and clicking Add for every match. Items it can't resolve go to a "Needs review" list the user checks before placing the order. The user reviews the cart and checks out themselves — the agent never submits an order or touches payment.

Once implemented:

- A "Send to Aldi Cart" button appears on the List page when the list has items
- Tapping it triggers the Claude in Chrome agent in the user's desktop browser
- The agent navigates to Aldi's "Buy It Again" page using the user's existing logged-in session
- For each item on the Dinder list, the agent searches "Buy It Again" first, then falls back to Aldi's general search
- Successfully matched items are added to the Aldi cart automatically
- Unresolvable items are collected into a "Needs review" list shown to the user when the agent finishes
- The user reviews the cart on aldi.us and places the order themselves

---

## Users

**Primary users:**
- Household member on a desktop/laptop browser with Claude in Chrome installed and an active Aldi account session

---

## System Context

This capability runs entirely in the user's desktop browser via Claude in Chrome. It is not a server-side operation. It requires:
- Claude in Chrome browser extension installed
- User logged into aldi.us in that browser (existing session — no credentials handled by Dinder)
- The Dinder List page open with a complete ingredient list

The agent operates on `www.aldi.us` — a public website the user already shops on. No Aldi API access is required or used.

**Flow:**
```
User has complete list on Dinder List page (recipe ingredients + pulled staples)
       ↓
User is on desktop with Claude in Chrome installed and logged into aldi.us
       ↓
User taps "Send to Aldi Cart" on the List page
       ↓
Dinder formats the list into a structured prompt for Claude in Chrome
       ↓
Claude in Chrome opens aldi.us/store/aldi/buy_it_again in a new tab
       ↓
Agent loads "All items" tab — scans all previously purchased products
       ↓
For each Dinder list item:
  → Search Buy It Again for a name match
  → Match found: click "Add" — item confirmed
  → No match: search Aldi's general catalog
  → General match found: click "Add" — item flagged as "first time / verify"
  → No match anywhere: item added to Needs Review list
       ↓
Agent finishes — Dinder shows summary:
  [N] items added to cart
  [N] items to review
       ↓
User opens aldi.us cart tab, reviews, places order
       ↓
User reviews Needs Review list in Dinder — handles manually or routes to Meijer
```

---

## Responsibilities

**This capability is responsible for:**
- A "Send to Aldi Cart" button on the List page
- Formatting the Dinder ingredient list into a structured agent prompt for Claude in Chrome
- Defining the agent's navigation and matching strategy (Buy It Again first, general search fallback)
- Displaying the post-run summary (items added, items to review)
- Storing the Needs Review list so the user can act on it after shopping

**This capability is NOT responsible for:**
- Installing Claude in Chrome (user prerequisite)
- Managing the user's Aldi account or login session
- Submitting the order or handling payment
- Meijer fallback routing (the Needs Review list is the handoff point — future CB_15 handles Meijer)
- Running on mobile (desktop browser only in v1)

---

## Functional Rules

### Trigger and Prerequisites

- "Send to Aldi Cart" button appears on the List page when the list has at least one item
- Before triggering the agent, Dinder checks whether Claude in Chrome is available — if not, a helpful message explains the prerequisite and links to the Chrome extension
- The button is not shown or is disabled on mobile — a tooltip explains "This feature requires a desktop browser with Claude in Chrome"

### Agent Prompt Structure

Dinder generates a structured prompt passed to Claude in Chrome containing:
- The complete ingredient list with names and quantities
- Step-by-step instructions for the agent's navigation and matching strategy
- Clear rules for what counts as a match, what to skip, and what to flag
- Instruction to never submit the order or enter payment information

Example prompt structure passed to the agent:
```
You are helping add grocery items to an Aldi cart. 

Here is the shopping list:
- Butter (1 lb)
- Chicken thighs (2 lbs)
- Shredded mozzarella (2 cups)
[... full list ...]

Instructions:
1. Navigate to aldi.us/store/aldi/buy_it_again if not already there
2. Click "All items" tab
3. For each item on the list:
   a. Look for a matching product in Buy It Again
   b. If found, click the Add button
   c. If not found, search Aldi's main search for the item
   d. If a reasonable match is found in search, add it and note it as unverified
   e. If no match anywhere, add the item to your needs-review list
4. When finished, report back:
   - How many items were added from Buy It Again
   - How many items were added from general search (list each)
   - Which items could not be found (list each)
5. Do not proceed to checkout. Do not enter any payment information.
```

### Matching Logic

**Buy It Again match (preferred):**
- Agent scans all items visible on the Buy It Again "All items" tab
- A match is any product whose name contains the key ingredient word(s) from the Dinder list item
- Quantity on the Dinder list is used as a guide — the agent picks the closest size available
- First match wins — the agent does not evaluate multiple options for Buy It Again items since these are already household-approved purchases

**General search fallback:**
- Used only when Buy It Again has no match
- Agent searches Aldi's main search using the ingredient name
- AI judgment used to select the best match from results
- These items are flagged as "unverified" in the summary since they haven't been bought before

**No match:**
- Item added to Needs Review list if not found in either Buy It Again or general search
- Common causes: ingredient too specific (a particular spice blend), Aldi doesn't carry it, or spelling mismatch

### Post-Run Summary

After the agent finishes, Dinder displays a summary screen showing:
- Total items on the list
- Items added from Buy It Again (green — confirmed)
- Items added from general search (yellow — worth a quick check in cart)
- Items not found / Needs Review (red — action required)

The Needs Review list persists in Dinder until the user clears it. Each item has two actions: "I'll get it at Meijer" (saves for future CB_15 integration) or "Skip this week."

### What the Agent Never Does

- Never proceeds to checkout
- Never enters payment information
- Never changes account settings
- Never removes items from the cart
- Never navigates outside of aldi.us

---

## Edge Cases

- **User is not logged into Aldi** — agent will hit a login wall. It reports back "Please log into aldi.us and try again." Dinder shows this message.
- **Buy It Again is empty** — new Aldi account or first order. Agent falls back to general search for all items. Summary reflects this.
- **Aldi's website layout changes** — the agent's natural language navigation is more resilient to layout changes than code-based scrapers, but may occasionally fail. User is shown "The agent had trouble with Aldi's website — please add remaining items manually" with the unprocessed items listed.
- **Item already in cart** — agent clicks Add anyway. Aldi's website handles quantity incrementing natively.
- **User runs the agent twice** — same result as above — items already in cart get incremented. A warning before triggering: "You already have items in your Aldi cart. Running this again will add more of the same items. Continue?"

---

## Not In Scope (v1)

- Mobile support (Claude in Chrome is desktop only)
- Meijer cart agent (future capability, dependent on CB_15)
- Sam's Club cart agent (future capability)
- Automatic weekly scheduling — user always initiates manually
- Price comparison across stores
- Quantity optimization (e.g. "buy the 2-pack because it's cheaper")

---

## AI Implementation Context

### Architecture

This capability is fundamentally different from all other CBs — it does not involve writing application code that runs on Dinder's servers or in the React app. The agent logic runs inside Claude in Chrome on the user's local machine.

Dinder's role is:
1. Format the ingredient list into the agent prompt (client-side JavaScript, trivial)
2. Trigger Claude in Chrome via its extension API or a deep link (research required — see note below)
3. Receive the agent's completion report and display the summary UI

**Claude in Chrome trigger mechanism:**
The exact API for triggering Claude in Chrome from a web app and passing it a prompt needs to be confirmed before building. Options to investigate:
- Claude in Chrome may support a URL scheme or postMessage API for launching with a pre-filled prompt
- Fallback: Dinder displays the formatted prompt in a copy-to-clipboard UI and the user pastes it into Claude in Chrome manually — less seamless but functional as v1

The copy-to-clipboard fallback should be built first as the v1 experience, with the direct trigger investigated as a v1.1 enhancement.

### Dinder Code Required

- "Send to Aldi Cart" button on `src/pages/ListPage.jsx` (or equivalent)
- `src/lib/aldiAgent.js` — formats the ingredient list into the agent prompt string
- Post-run summary UI component — displayed after agent reports back
- Needs Review list stored in Supabase: a simple `agent_review_items` table scoped to `subscription_id`

```sql
create table public.agent_review_items (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  item_name text not null,
  quantity text,
  status text not null default 'pending' check (status in ('pending', 'meijer', 'skipped')),
  created_at timestamptz not null default now()
);
```

### Key Implementation Rules

- Migration number: 017
- The agent prompt must be deterministic — same list produces same prompt every time
- "Buy It Again first" must be explicitly stated in the prompt — this is the core matching strategy
- The prompt must explicitly prohibit checkout and payment — stated clearly, not implied
- The copy-to-clipboard v1 fallback must format the prompt in a way that's immediately usable when pasted — no setup instructions needed, just the task
