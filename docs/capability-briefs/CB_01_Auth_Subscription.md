# Capability Brief (CB): Authentication & Subscription

## Summary

| Field | Value |
|---|---|
| **Capability Name** | Authentication & Subscription |
| **Status** | Draft |
| **Owner** | @Jarrod Murray |

---

## Problem

Before users can access any feature of the app, the platform must verify their identity, establish a persistent session, and determine their subscription tier. Without a centralized authentication and subscription capability, every other module would need to independently manage access control, creating inconsistency and security risk.

The platform must support:

- SSO-based authentication via Google and Facebook
- Persistent login sessions across app visits
- A shared subscription model supporting two users under a single account
- Two subscription tiers: Free and Premium
- Subscription-gated access to AI-powered features
- A foundation for future third-party integrations and webhook configuration

---

## Outcome

The platform provides a centralized capability responsible for authenticating users, managing persistent sessions, and enforcing subscription-tier access rules.

Once implemented:

- Users can sign in via Google or Facebook SSO
- Sessions persist across app visits without requiring re-authentication
- Two users share a single subscription and account
- Free tier users have full access to core swipe, list, and export features
- Premium tier users have access to AI-powered features in addition to all free tier features
- Subscription tier is checked at the capability level before AI features are invoked
- The account settings area provides a foundation for future integrations and webhook management

---

## Users

**Primary users:**
- Household members (typically two) sharing a single subscription

**Secondary users:**
- Developers building subscription-gated features

---

## System Context

Authentication & Subscription is the entry point capability for the platform. All other capabilities depend on a resolved, authenticated session with a known subscription tier.

**Flow:**

```
User opens the PWA
       ↓
Valid session exists?
       ↓
  No → Sign-In Screen (Google / Facebook SSO)
       ↓
  SSO OAuth flow completes
       ↓
  Account created or resolved in Supabase
       ↓
  Subscription tier resolved via Stripe
       ↓
  Session established (user identity + subscription tier)
       ↓
Meal Discovery (Swipe Experience)
```

This capability sits upstream of:

- Dietary Preferences
- Meal Discovery (Swipe Experience)
- Favorites Management
- Never Pile Management
- Ingredient Aggregation
- Shopping List
- Export / Share

---

## Responsibilities

**This capability is responsible for:**

- Authenticating users via Google and Facebook SSO
- Creating and maintaining persistent login sessions
- Resolving and storing the subscription tier on the session
- Enforcing subscription-tier access rules for Premium features
- Providing an account settings screen for managing account-level preferences
- Providing a foundation for future third-party integrations and webhook configuration

**This capability is NOT responsible for:**

- Dietary preference management (see CB: Dietary Preferences)
- Never pile or favorites data
- Meal discovery or swipe logic
- Shopping list or export logic
- Executing third-party integrations (future capability)
- Webhook configuration UI (future capability)

---

## Functional Rules

### Authentication

- Users must authenticate via Google or Facebook SSO
- No email/password authentication is supported in v1
- Successful SSO authentication must create or resolve an existing account
- Two users may share the same credentials and account

### Session Behavior

- Sessions must persist across app visits without forced re-login
- Session must store user identity and resolved subscription tier
- If a valid session exists, the user bypasses the sign-in screen on return visits
- Users may manually sign out, which invalidates the current session

### Subscription Tiers

- Two tiers exist: Free and Premium
- Free tier grants full access to: Meal Discovery, Favorites, Never Pile, Ingredient Aggregation, Shopping List, and Export
- Premium tier grants all Free features plus AI-powered capabilities
- Subscription tier is resolved at authentication and stored on the session
- All Premium feature checks read subscription tier from the session
- If a Free user attempts to access a Premium feature, they must be presented with an upgrade prompt

### Shared Account Model

- Two users may share a single account using the same credentials
- There is no concept of separate user profiles within a shared account in v1
- All subscription-level data (dietary preferences, never pile, favorites) is shared across both users

### Account Settings

- Users must be able to access an account settings screen
- Account settings must display the current subscription tier
- Account settings must provide a path to upgrade from Free to Premium
- Account settings must allow the user to sign out
- Account settings must allow the user to set a household default serving size (integer — number of people)
- The household default serving size must default to 2 if not explicitly set
- Account settings must include a placeholder section for future integrations
- Account settings must include a placeholder section for future webhook configuration

---

## Constraints

- Authentication must use Supabase Auth with Google and Facebook OAuth providers configured
- Subscription management must use Stripe
- Session persistence must use Supabase native session handling (localStorage + refresh tokens)
- The platform must not store SSO tokens beyond what Supabase manages natively
- Subscription tier must be resolvable from the Supabase user record on each session

---

## Not In Scope

- Email/password authentication
- Apple Sign-In (future consideration)
- Separate user profiles within a shared account
- Multi-seat or family plan tier management UI
- Third-party integration execution
- Webhook configuration UI
- Password recovery flows
- MFA

---

## Edge Cases

- User opens the app with an expired session
- User revokes app access from their Google or Facebook account settings
- Two users are simultaneously active on the same account
- User attempts to access a Premium feature on a Free subscription
- Stripe subscription lapses or payment fails — user was on Premium but subscription becomes inactive
- User signs in on a new device while another session is active
- SSO provider is temporarily unavailable

---

## Success Metrics

- Users are not prompted to re-authenticate on return visits
- SSO authentication completes without error for both Google and Facebook
- Subscription tier is correctly resolved and enforced across all gated features
- Free users see upgrade prompts when attempting Premium features
- Premium users can access AI features without friction
- Sign-out invalidates the session and returns the user to the sign-in screen

---

## Example Workflow

1. User opens the PWA for the first time
2. Sign-in screen is presented with Google and Facebook SSO options
3. User taps "Continue with Google" and completes the OAuth flow
4. Platform creates or resolves the account in Supabase
5. Subscription tier is resolved via Stripe and stored on the session
6. User is routed to the Meal Discovery (Swipe) experience
7. On subsequent visits, the valid session bypasses sign-in automatically
8. If the user navigates to Account Settings, they see their tier, an upgrade CTA, their household default serving size, and placeholder sections for integrations and webhooks
9. If the user taps Sign Out, the session is invalidated and the sign-in screen is presented

---

## AI Implementation Context

### Architecture

- PWA frontend: React + Vite
- Component library: shadcn/ui + Tailwind CSS
- Auth provider: Supabase Auth (Google OAuth, Facebook OAuth)
- Subscription / payments: Stripe
- Session persistence: Supabase native session handling (localStorage + refresh tokens)

### Dependencies

- Supabase project with Auth enabled and OAuth providers configured
- Stripe account with Free and Premium subscription products defined
- Google OAuth credentials configured in Supabase
- Facebook OAuth credentials configured in Supabase

### Data Model

**Primary entities:**
- User (managed by Supabase Auth)
- Subscription (managed by Stripe, referenced on User record)
- Session (managed by Supabase Auth)

**User record attributes:**
- `user_id`
- `email`
- `sso_provider` (google | facebook)
- `subscription_tier` (free | premium)
- `stripe_customer_id`
- `default_serving_size` (integer — household default, used by Ingredient Aggregation; defaults to 2)
- `created_at`
- `last_sign_in_at`

### Key Rules

- Supabase Auth handles all SSO token exchange and session refresh
- Subscription tier is resolved from Stripe on login and stored in Supabase user metadata
- All Premium feature checks read `subscription_tier` from the session, not from Stripe directly
- Account settings screen reads from and writes to Supabase user metadata
- No custom auth logic — rely on Supabase Auth primitives
