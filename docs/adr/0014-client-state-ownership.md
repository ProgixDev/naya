---
id: ADR-0014
title: "Client state ownership"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0009, ADR-0013, ADR-0015, ADR-0017, ADR-0054, PAX-05, UI-18]
---

# ADR-0014 · Client state ownership

## Context

The handoff gives every piece of state one owner: TanStack Query for server resources with scoped keys; Zustand for ephemeral, non-sensitive client state such as the selected city and route drafts, never duplicating server entities; React Hook Form with Zod for forms; SecureStore for session credentials, never tokens or documents in an ordinary store; and account-specific state cleared on logout or account change (handoff prompt:98-103, :109).

## Decision

In the mobile apps:

| State | Owner | Rule |
|---|---|---|
| Server resources (profile, rides, quotes, wallet, cases…) | TanStack Query | Keys only from `qk`, always `['naya', accountId, …]`; public data under `['naya', 'public', …]`. |
| Session token and account id | SecureStore (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`), mirrored in a non-persisted Zustand store | Never in AsyncStorage. Web dev builds use `sessionStorage`. |
| Device preferences (onboarding done, city) | Zustand `persist` on AsyncStorage, versioned | Non-sensitive only. |
| Theme mode (light, dark, system) | Module-level store in `@naya/ui`, saved as the plain AsyncStorage key `naya.theme` | Non-sensitive; not Zustand and not versioned. |
| Route draft, toasts | In-memory Zustand | Not persisted, not a server entity. |
| Multi-field forms (identity, vehicle, admin login) | React Hook Form + `zodResolver`, extending the domain schemas | Simple one-field inputs use component state. |

`AccountBoundary` removes the previous account's queries when the account changes or signs out.

## Consequences

- Cache keys never collide across accounts, and the previous account's cache is removed when another account signs in.
- The session token is not restored from a backup onto another device (`…_THIS_DEVICE_ONLY`).
- The passenger's city exists twice, in device prefs and on the server user, and can diverge (backlog [PAX-05](../status/backlog.md)); [ADR-0054](0054-source-of-truth-for-the-passenger-s.md) decides the owner.
- The Oct 6 prototype screens use ad-hoc query keys (backlog UI-18).
- The admin follows the same split with its own per-tab session ([ADR-0017](0017-the-admin-is-a-separate-vite-spa.md)).

## Alternatives considered

Not recorded at the time; the split comes directly from the handoff (prompt:98-103).

## Evidence

Line numbers at commit `c38429d`.

- Commits: `177cbd6` (2026-09-30) added the session store, query keys, query client, prefs and the first account-change cache clear; `f0f8d46` (2026-09-30) added the route draft; `0e0b066` (2026-10-01) moved the boundary to `AccountBoundary` and made it remove only the previous account (a race found in native review, `docs/DESIGN.md:55`).
- `packages/api/src/keys.ts:1-30` (account-scoped keys).
- `packages/ui/src/core/session.ts:5-23` (SecureStore, this device only; web fallback), `:35-61` (non-persisted Zustand mirror).
- `packages/ui/src/core/AccountBoundary.tsx:6-20`.
- `apps/passenger/src/lib/prefs.ts:5-23` (versioned AsyncStorage prefs); `apps/passenger/src/lib/draft.ts:4-25` (in-memory route draft); `packages/ui/src/Toast.tsx:21`; `packages/ui/src/core/theme.tsx:6`, `:33`, `:39` (theme mode: module variable and plain AsyncStorage key, added in `89aae18`).
- `apps/passenger/src/app/(verify)/identity.tsx:4-18` (React Hook Form with a domain Zod schema).
- Enforced by: `packages/ui/src/__tests__/components.test.tsx:172` "removes the previous account without detaching the new account queries".

## Revisit when

- [ADR-0054](0054-source-of-truth-for-the-passenger-s.md) is decided, or
- offline support is added: decide which server resources may be persisted, and how they are cleared on sign-out.
