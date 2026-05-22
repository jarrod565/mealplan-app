# Capability Brief (CB): Dietary Preferences

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Dietary Preferences |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

Users have dietary restrictions that make certain meals unsuitable for their household. Without a way to communicate these restrictions to the platform, the Meal Discovery experience would surface irrelevant or unsafe meal options — creating friction and eroding trust in the app.

Dietary preferences must be:

- Easy to set once and forget
- Applied silently and consistently across the Meal Discovery experience
- Accessible enough that users understand why certain meals are or are not being shown
- Non-blocking — users should not be forced to configure preferences before using the app

---

## Outcome

The platform provides a subscription-level dietary preference setting that filters the Meal Discovery experience without requiring ongoing user intervention.

Once implemented:

- Users can configure one or more dietary restrictions from a predefined list
- Dietary restrictions are stored at the subscription level and shared across both users
- Meals that violate active dietary restrictions are hard-excluded from the swipe deck
- A persistent but unobtrusive indicator communicates to the user that filters are active
- Preferences can be updated at any time from Account Settings
- No restrictions are applied by default — the full meal catalog is shown until the user opts in
- The data model supports future expansion into AI-driven medical condition management (Premium)

---

## Users

**Primary users:**
- Household members configuring shared dietary restrictions

**Secondary users:**
- Developers integrating dietary filters into the Meal Discovery capability

---

## System Context

Dietary Preferences is a subscription-level setting that sits between Authentication & Subscription and Meal Discovery. It does not participate in the real-time swipe interaction — it informs the API query that populates the swipe deck.

**Flow:**

```
Authentication & Subscription
       ↓
Session established (user identity + subscription tier)
       ↓
Dietary Preferences resolved for the subscription
       ↓
Meal Discovery (Spoonacular API query includes active dietary filters)
       ↓
Swipe deck populated with filtered meal results
```

This capability is consumed by:

- Meal Discovery (Swipe Experience)

This capability is managed via:

- Account Settings (see CB: Authentication & Subscription)

---

## Responsibilities

**This capability is responsible for:**

- Storing dietary restriction preferences at the subscription level
- Providing a UI for users to view and update their dietary restrictions
- Surfacing an unobtrusive indicator when dietary filters are active
- Passing active dietary restrictions to the Meal Discovery capability at session start

**This capability is NOT responsible for:**

- Filtering meals in real time during the swipe session (that is Meal Discovery's responsibility)
- Managing cuisine-style preferences (out of scope for v1)
- Medical condition management (future Premium AI feature)
- Per-user preferences within a shared account (v1 is subscription-level only)

---

## Functional Rules

### Preference Storage

- Dietary preferences are stored at the subscription level
- Both users on a shared account share the same dietary preferences
- Preferences persist across sessions until explicitly changed by the user
- No dietary restrictions are applied by default

### Supported Restrictions (v1)

The following dietary restriction filters must be supported, sourced from Spoonacular's supported diet and intolerance parameters:

- Vegetarian
- Vegan
- Gluten-Free
- Dairy-Free
- Nut-Free (Tree Nuts)
- Peanut-Free
- Shellfish-Free
- Egg-Free
- Soy-Free
- Ketogenic
- Paleo

### Filter Application

- Active dietary restrictions must be passed as filter parameters to the Spoonacular API when loading the swipe deck
- Meals that violate active restrictions must be hard-excluded — they must not appear in the swipe deck
- Client-side filtering is not required in v1; Spoonacular API filters are the sole mechanism
- If no restrictions are active, the full Spoonacular meal catalog is available for discovery

### Active Filter Indicator

- When one or more dietary restrictions are active, a persistent but unobtrusive indicator must be visible during the Meal Discovery experience
- The indicator must communicate that filters are applied and provide a direct path to Account Settings to review or modify them
- The indicator must not interrupt or dominate the swipe experience
- When no restrictions are active, no indicator is shown

### Onboarding Behavior

- Users are not forced to configure dietary preferences before their first swipe session
- Dietary preference setup may be optionally surfaced during onboarding as a skippable step
- If skipped, the full meal catalog is shown and no indicator is displayed

### Editing Preferences

- Users must be able to access dietary preferences from Account Settings at any time
- Changes to dietary preferences take effect at the start of the next swipe session
- Changes do not retroactively affect the current session's swipe deck

---

## Constraints

- Dietary restriction filtering must use Spoonacular's native diet and intolerance query parameters
- Preferences must be stored in Supabase on the subscription/user record
- The restriction list in v1 is limited to options supported by the Spoonacular API

---

## Not In Scope

- Cuisine-style preferences (e.g. "we love Mexican food")
- Per-user dietary preferences within a shared account
- Medical condition management (e.g. Gout, Diabetes) — future Premium AI feature
- Custom ingredient exclusions
- Calorie or macro-based filtering
- Allergen severity levels or cross-contamination warnings

---

## Edge Cases

- User activates a dietary restriction mid-week after already swiping on meals that violate it — previously swiped meals are not affected
- All available Spoonacular meals are excluded by the active filter combination — the swipe deck returns empty
- User sets conflicting restrictions (e.g. Vegan + Paleo) — the app applies both without warning; the resulting deck may be very limited
- User skips onboarding dietary setup and never visits Account Settings — no filters are ever applied
- Spoonacular returns a meal that technically violates an active filter due to API inconsistency — no client-side fallback in v1

---

## Success Metrics

- Active dietary restrictions are consistently reflected in the meals shown during Meal Discovery
- Users with active filters can identify that filtering is occurring without navigating away from the swipe experience
- Dietary preferences are preserved correctly across sessions
- Users can update preferences in Account Settings and see the change reflected on their next swipe session

---

## Example Workflow

1. User navigates to Account Settings and selects Dietary Preferences
2. User enables Gluten-Free and Dairy-Free restrictions
3. Preferences are saved to the subscription record in Supabase
4. On the next session, Meal Discovery queries Spoonacular with gluten-free and dairy-free filter parameters
5. The swipe deck is populated with only compliant meals
6. A subtle filter indicator is visible on the Meal Discovery screen
7. User taps the indicator and is taken directly to Dietary Preferences in Account Settings
8. User disables Dairy-Free — change is saved
9. On the next session, only Gluten-Free filtering is applied

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- Preference storage: Supabase (stored on user/subscription record)
- Dietary filter application: Spoonacular API query parameters (`diet`, `intolerances`)

### Dependencies

- CB_01: Authentication & Subscription (session and subscription record)
- CB_03: Meal Discovery — consumes active dietary filters when building Spoonacular API queries
- Spoonacular API account with diet and intolerance filter support confirmed

### Data Model

**Dietary Preferences record (stored on subscription):**
- `subscription_id`
- `restrictions` (array of active restriction keys, e.g. `["gluten_free", "dairy_free"]`)
- `updated_at`

**Supported restriction keys (v1):**
- `vegetarian`
- `vegan`
- `gluten_free`
- `dairy_free`
- `nut_free`
- `peanut_free`
- `shellfish_free`
- `egg_free`
- `soy_free`
- `ketogenic`
- `paleo`

### Key Rules

- Dietary preferences are read from Supabase at session start and passed to Meal Discovery
- Spoonacular `diet` and `intolerances` parameters are the sole filtering mechanism in v1
- No client-side meal filtering is performed
- Preference changes are saved immediately to Supabase but take effect on the next swipe session
- The active filter indicator reads directly from the session's resolved preference state
- The data model uses an array of restriction keys to support easy expansion — including future AI-driven medical condition flags at the Premium tier
