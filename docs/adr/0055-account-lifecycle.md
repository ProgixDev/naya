---
id: ADR-0055
title: "Account lifecycle"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0004, ADR-0006, ADR-0007, ADR-0019, ADR-0034, ADR-0037, ADR-0042, PAX-12, PRD-35, API-14, ADM-18, DOM-07, DRV-10, docs/tasks/2026-10-13.md]
---

# ADR-0055 · Account lifecycle

## Context

This collects three "Smaller calls that can wait" in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#smaller-calls-with-defaults)): account deletion, verification revocation and expiry, and suspension. It closes backlog PAX-12, PRD-35, API-14, ADM-18 and DOM-07 ([backlog](../status/backlog.md)).

- **Deletion.** App Store guideline 5.1.1(v) requires apps with account creation to let people start deleting their account inside the app. Data-subject rights under law 09-08 point the same way.
  - The passenger app offers only « Supprimer mon compte · écrire à l’assistance », which opens a generic support form.
  - The driver app has nothing.
- **Suspension.** `User.status` can be `'suspended'`, but nothing sets it. Admins cannot suspend an account or act on a live ride.
- **Revocation and expiry.** Approval is final: the verification machine has no transition out of `approved`. No document records an expiry date.
- **Founder brief 13 Oct** ([task 2](../tasks/2026-10-13.md)):
  - licence issue and expiry dates;
  - a criminal-record extract;
  - one status per document: "missing → submitted → in review → approved / rejected with reason".
- **Sign-out mid-ride.** A driver can sign out during an active ride (backlog DRV-10).

## Decision

**Recommended, pending Achraf’s choice.**

1. **Deletion.** Both apps offer « Supprimer mon compte » in the app.
   - It creates a deletion request that the server completes within a stated period (proposed: 30 days).
   - Identity documents, photos, places and profile data are deleted.
   - Ledger, payment and audit records that the law requires are kept, pseudonymised ([ADR-0004](0004-driver-wallet-is-a-projection-of-an.md), [ADR-0006](0006-admin-changes-are-governed.md)).
   - A request is refused while a ride is active or money is held or owed. A driver's balance is paid out first.
   - Admins see the queue of requests.
2. **Suspension.** An admin with a new `accounts.suspend` permission ([ADR-0037](0037-admin-permission-model-for-the-new-features.md)) can set `suspended`, with a reason and an audit entry.
   - A suspended person can sign in, read the reason and write to support. She cannot book or receive offers.
   - A live ride is handled by the admin system cancel ([ADR-0042](0042-ride-exception-paths.md)).
3. **Document lifecycle.**
   - Give every driver document its own status, as the founder brief asks.
   - The licence, insurance, visite technique and criminal-record extract carry expiry dates.
   - Add two transitions from `approved` ([ADR-0007](0007-lifecycle-rules-are-declarative-state-machines-in.md)): `EXPIRE`, run automatically on the expiry date, and `REVOKE`, by an admin with a reason. Both lead to a state that blocks offers until a new submission is approved.
   - Warn the driver 30 days before expiry.
4. **Sign-out.** Block driver sign-out while a ride is active.

## Consequences

- New server jobs: deletion processing and expiry checks. The job queue in the production backend runs them.
- The verification machine, the driver dossier, CaseReview and the identity forms change together. Founder brief task 2 already asks for the form changes.
- A retention schedule is needed from counsel, in the planned `specs/privacy-and-data.md`.
- App Store review is less likely to reject either app over deletion.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| Deletion through a support ticket (today) | No work | Unlikely to meet 5.1.1(v); the driver app has nothing |
| Immediate hard delete | Simple for the user | Destroys financial records the law requires and breaks ledger integrity |
| Suspension by editing data by hand | No UI | No reason, no audit, easy to get wrong |

## Evidence

Line numbers at commit `c38429d`.

- `apps/passenger/src/app/(app)/preferences.tsx:60` (deletion is a support request).
- `packages/domain/src/entities.ts:39` (`'active' | 'suspended'`); `git grep "'suspended'"` finds no other use.
- `packages/domain/src/machines/verification.ts:13` (`approved: {}`, terminal); `packages/domain/src/entities.ts:100-114` (no expiry fields).
- Enforced by: nothing.

## Implementation status (15 Oct 2026)

Status stays Proposed. Branch `feat/passenger-polish` adds in-app deletion for passengers only (PAX-12): Compte →
« Préférences » → « Supprimer mon compte », a two-step sheet that calls `POST /me/deletion` (Idempotency-Key). The
server refuses while she has an active ride, a Famille trip under way, an open SOS alert, a booked car wash, a pending
payment, a refused ride payment or a wallet balance (`details.blockers`, each with a French message saying what to do);
otherwise it anonymises the profile, cancels scheduled rides and Famille trips, and revokes the sessions (`services/demo-api/src/services/auth.ts`; tests `services/demo-api/test/accountDeletion.test.ts`).

Later the same day (e07ef01) the chauffeuse got the same route from Compte → « Préférences » → « Supprimer mon compte »
(`delete-account`, a sheet that lists what is erased and what is kept). The server refuses while she has a ride or a
Famille trip under way, is online, has an open SOS alert, a booked car wash, a ride payment or a recharge or withdrawal
pending, a wallet balance (to withdraw) or a debt (to recharge or settle with the assistance), or active Famille
subscriptions or scheduled trips assigned to her; every blocker comes back at once. Otherwise her payout accounts,
presence and the vehicle's plate go too, and the rides she drove, her ledger, recharges and withdrawals are kept under
« Compte supprimé » (rides keep the car for the passenger's receipt; Famille journals replace her first name). The
balance must be exactly zero, so nothing is paid out by the deletion itself (`driverDeletionBlockers` in
`services/demo-api/src/services/auth.ts`; tests `services/demo-api/test/driverAccountDeletion.test.ts`). Item 4 is done
for the app (DRV-10, e07ef01): every driver sign-out goes offline first and stays signed in when the server refuses.

Open: a passenger with a wallet balance cannot delete, and nothing can refund a passenger wallet (needs a decision);
the 30-day request queue of item 1 (deletion is immediate today); suspension, revocation and expiry.

## Revisit when

- App Store review raises deletion, or
- counsel delivers the retention schedule, or
- a KYC vendor can read expiry dates from documents.
