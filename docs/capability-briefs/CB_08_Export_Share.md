# Capability Brief (CB): Export / Share

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Export / Share |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

Users shop in different ways — some use the app directly in the store, some dictate items to Alexa, and some prefer to paste their list into a dedicated shopping app like Aldi's. Without an easy way to get the list out of the app, users who prefer external tools are forced to manually re-enter every item — which defeats the purpose of the platform.

The platform must provide a frictionless way to export the Shopping List in a format that works across all three use cases without requiring the user to choose a mode.

---

## Outcome

The platform provides a one-tap copy action on the Shopping List screen that places the full list on the device clipboard in a clean, human-readable format — ready to paste into any app, dictate from, or share via any channel the device supports.

Once implemented:

- A "Copy List" action is available on the Shopping List screen at all times
- Tapping "Copy List" places the full list on the device clipboard
- The copied format is clean, readable, and pasteable into any app (Aldi, AnyList, Notes, Messages, etc.)
- The list can optionally be shared via the device's native share sheet
- Unchecked items only are copied by default — already-checked items are excluded
- A confirmation indicator (toast or similar) confirms the copy was successful

---

## Users

**Primary users:**
- Household members exporting their list to another app or voice assistant

---

## System Context

Export / Share is a lightweight capability that sits alongside the Shopping List. It reads directly from the Shopping List record and requires no separate data storage.

**Flow:**

```
User is on the Shopping List screen (CB_07)
       ↓
User taps "Copy List"
       ↓
Unchecked items formatted into plain text
       ↓
Text placed on device clipboard
       ↓
Confirmation toast displayed
       ↓
User pastes into Aldi app / Alexa / AnyList / Notes / etc.
```

```
User taps "Share"
       ↓
Device native share sheet opens
       ↓
User selects destination app or contact
```

This capability depends on:

- CB_07: Shopping List (list content and check-off state)

---

## Responsibilities

**This capability is responsible for:**

- Formatting the Shopping List as clean plain text for clipboard copy
- Triggering the device clipboard write on user action
- Providing a native share sheet option
- Confirming successful copy with a non-blocking toast notification
- Excluding already-checked items from the copied output by default

**This capability is NOT responsible for:**

- Managing the Shopping List or check-off state (see CB_07)
- Direct API integration with Aldi, AnyList, or any third-party app (future enhancement)
- Webhook-based list pushing (future enhancement via Account Settings)

---

## Functional Rules

### Copy Action

- A "Copy List" button must be visible on the Shopping List screen at all times
- Tapping "Copy List" must write the formatted list to the device clipboard immediately
- Only unchecked items are included in the copied output by default
- If all items are checked, the full list is copied (nothing to exclude)
- A non-blocking toast notification must confirm the copy: e.g. "List copied to clipboard"
- The toast must dismiss automatically after a short delay

### Share Action

- A "Share" action must be available alongside the "Copy List" action
- Tapping "Share" must invoke the device's native share sheet with the formatted list as the payload
- The share sheet allows the user to send the list to any app or contact their device supports
- The same formatting rules apply as the copy action (unchecked items only by default)

### Copy Format

The copied plain text format must be:

- Grouped by category with a category label on its own line
- Each item on its own line with quantity, unit, and name
- Clean enough to read aloud to Alexa or paste directly into a shopping app
- Free of markdown, symbols, or formatting characters that would appear as noise in another app

**Example output:**

```
🛒 My Shopping List

PRODUCE
2 lbs Chicken Breast
1 bunch Cilantro
3 Limes

DAIRY & EGGS
1 dozen Eggs
8 oz Shredded Cheese

PANTRY & DRY GOODS
48 fl oz Chicken Broth
2 cans Black Beans
1 cup Rice
```

- The emoji header is optional and should be configurable or omittable in a future enhancement
- Category labels must be in plain uppercase with no special characters
- Items must follow the format: `[quantity] [unit] [name]`
- A blank line must separate each category block for readability

### What Gets Copied

- Default: unchecked items only
- If all items are checked: full list is copied
- The copy action does not change check-off state — it is read-only

---

## Constraints

- Copy to clipboard must use the Web Clipboard API (`navigator.clipboard.writeText`)
- Share sheet must use the Web Share API (`navigator.share`) where supported
- Both APIs are available in modern mobile browsers and PWA contexts
- Fallback behavior must be provided if Web Share API is not supported (copy only, no share button shown)

---

## Not In Scope

- Direct API integration with Aldi, AnyList, Instacart, or any other shopping app (future enhancement)
- Alexa skill or voice assistant integration (future enhancement)
- Webhook-based list pushing to external systems (future enhancement via Account Settings)
- Email or SMS delivery of the list
- PDF or file export
- Selective item copy (copy only certain categories or items)
- Configurable copy format options (future enhancement)

---

## Edge Cases

- User taps "Copy List" with an empty Shopping List — button is disabled or copy produces an empty result with a friendly message
- Web Share API is not supported on the user's device or browser — Share button is hidden, Copy only is shown
- User has all items checked and taps "Copy List" — full list is copied with a note indicating all items are already checked
- Clipboard write fails (e.g. permissions denied) — a toast error is shown: "Could not copy to clipboard — please try again"
- List contains items in the "Other" category — included in copy under an "OTHER" label

---

## Success Metrics

- "Copy List" places correctly formatted plain text on the clipboard on first tap
- Copied format pastes cleanly into Aldi's app, Apple Notes, and similar destinations
- Toast confirmation appears reliably after every successful copy
- Share sheet opens correctly on supported devices
- Unchecked-only filtering works correctly when some items are checked

---

## Example Workflow

1. User has generated their Shopping List and checked off a few items already in their cart
2. User realizes they want to send the remaining items to their spouse via iMessage
3. User taps "Share" — the device share sheet opens with the unchecked items pre-loaded as plain text
4. User selects Messages and sends to their spouse
5. Spouse receives a clean, readable list they can shop from independently
6. Back in the app, user taps "Copy List" to paste remaining items into the Aldi app
7. User opens Aldi app, pastes — items appear as a clean text block ready to search one by one
8. Toast confirms "List copied to clipboard" and dismisses after 2 seconds

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- Clipboard: Web Clipboard API (`navigator.clipboard.writeText`)
- Share sheet: Web Share API (`navigator.share`) with graceful fallback
- No additional backend storage required — reads directly from CB_07 Shopping List record

### Dependencies

- CB_07: Shopping List (list items, quantities, units, categories, check-off state)

### Data Model

No additional data model required. Export / Share reads from the Shopping List record defined in CB_07.

**Formatted output is generated client-side at copy/share time from:**
- `items` array filtered to `is_checked: false` (or full array if all checked)
- Items grouped by `category`
- Each item formatted as `[quantity] [unit] [name]`

### Key Rules

- Copy and share format is generated client-side at the moment of the action — not pre-computed or stored
- Unchecked items only are included by default — filter applied before formatting
- Web Share API availability is checked at runtime; Share button is conditionally rendered
- Toast notification is triggered immediately on successful clipboard write
- No data is written to Supabase by this capability
