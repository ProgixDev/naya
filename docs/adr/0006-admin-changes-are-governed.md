---
id: ADR-0006
title: "Admin changes are governed"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0005, ADR-0017, ADR-0037, ADM-09, ADM-19, API-09, API-22]
---

# ADR-0006 · Admin changes are governed

## Context

The handoff asks for an immutable audit log in the admin (handoff prompt:158), audit trails rather than stretched phone cards (prompt:68), and exceptional finance corrections that need a permission, an explicit reason and an audit event (prompt:202). Several administrators can edit the same city rules or review the same case at once.

## Decision

Every admin change that alters rules, configuration, money or a person's status must:

1. carry a reason of at least 10 characters (`reasonSchema`);
2. send the version it was based on (`expectedVersion`); the server answers `409 CONFLICT` if the record changed, and the admin shows a reload banner instead of overwriting;
3. append an event to the audit log with actor, action, entity, reason and before/after values.

The audit log is append-only and hash-chained (SHA-256 over each event plus the previous hash). There is no update or delete path. The chain is verified on every read of the log and its integrity is shown in the admin.

## Consequences

- Concurrent edits cannot silently overwrite each other on city rules and verification cases.
- Tampering with a stored event breaks the chain and is visible.
- The pattern must be applied by hand to each new endpoint. The Oct 6 Services catalog, SOS and family actions skip reason, version and before/after (backlog [ADM-09, API-09](../status/backlog.md)); document reads and failed logins write no audit entry although the admin claims they do (backlog ADM-19, API-22).
- The demo hash chain proves integrity within one store; it is not an external notarisation.

## Alternatives considered

Not recorded at the time.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30) added the audit chain, `expectedVersion` and `reasonSchema`; `f0f8d46` (2026-09-30) added the admin screens.
- `services/demo-api/src/audit.ts:8-12` (hash), `:14-39` (append-only), `:41-49` (`verifyAuditChain`); `services/demo-api/src/app.ts:891` (integrity returned with the log); `apps/admin/src/pages/Audit.tsx:57-70` (integrity badge).
- `packages/domain/src/schemas.ts:169` (reason ≥ 10 characters), `:171` (rules update needs `expectedVersion`).
- `services/demo-api/src/services/cities.ts:78-105` (version check, new version, audit with before/after); `services/demo-api/src/services/verification.ts:174-178` (case version check); `services/demo-api/src/services/finance.ts:284-300` (correction: permission, reason, audit).
- `apps/admin/src/pages/Rules.tsx:130-147` and `:165` (conflict banner); `apps/admin/src/pages/Cities.tsx:92-96` (reason length); `apps/admin/src/pages/CaseReview.tsx:43-55` (version and conflict).
- Enforced by: `services/demo-api/test/scenarios.test.ts:249` "rule updates need the current version and a reason", `:78` (stale decisions conflict), `:613` (corrections audited with before/after), `:624` "the audit chain detects tampering"; `e2e/tests/admin-operations.spec.ts:79` (A09 correction).

## Revisit when

- Naya moves to a real database: store the chain there, and consider an external anchor for the head hash, or
- [ADR-0037](0037-admin-permission-model-for-the-new-features.md) adds new admin permissions: each new action must follow this pattern.
