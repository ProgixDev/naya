---
id: ADR-0019
title: "Verification is a manual human review with no face or gender inference"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0006, ADR-0007, ADR-0012, ADR-0018, ADR-0034, DOC-06, PRD-34, DOM-06, DOM-07]
---

# ADR-0019 · Verification is a manual human review with no face or gender inference

## Context

The handoff says passenger identity review is manual; driver identity and vehicle approval are separate prerequisites for receiving offers; submission is not approval; correction requests and rejections need reasons and recovery actions (handoff prompt:164). It adds: "Do not infer identity or gender from appearance" (prompt:166). Naya is a women-only service (`README.md:3`), so this review is where eligibility is decided.

## Decision

Every verification case is decided by a person in the admin, with the `verification.decide` permission. No automated face matching, liveness scoring or gender inference is used, now or as a hidden step. Passengers have one identity case; drivers have two independent cases, person (identity and licence) and vehicle, and both must be approved before the driver can go online or receive offers. Submitting is never approving: a case moves `draft → submitted → in_review → approved | more_info_requested | rejected`, a correction request names the items to redo, and a refusal needs a reason; some refusals can be restarted.

## Consequences

- Decisions are explainable and audited ([ADR-0006](0006-admin-changes-are-governed.md)); the reviewer workload grows with sign-ups.
- The standalone demo approves a newly submitted dossier automatically after a few seconds, labelled as a simulation ([ADR-0012](0012-native-demo-builds-run-the-demo-api.md)). That is a demo shortcut, not a review.
- The women-only rule itself is not written anywhere: the reviewer checklist has no eligibility item and identity data has no field for it (backlog [DOC-06, PRD-34](../status/backlog.md)). [ADR-0034](0034-women-only-eligibility-and-verification-policy.md) decides the policy; this ADR only fixes that the decision is human and never inferred from appearance.
- Required items ignore the document type, and an approval never expires (backlog DOM-06, DOM-07).

## Alternatives considered

Automated KYC with face matching or gender inference: excluded by the handoff (prompt:166) and recorded as excluded "by design" in `docs/INTEGRATIONS.md:10`.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30).
- `packages/domain/src/machines/verification.ts:7-14` (transitions), `:16-20` (required items per subject), `:53-55` (driver needs both approvals).
- `services/demo-api/src/services/verification.ts:158-159`, `:174-175` (only `verification.decide` may review); `services/demo-api/src/services/rides.ts:215-231` (offers need both approvals).
- `apps/admin/src/pages/CaseReview.tsx:153` (reviewer checklist: legibility, consistency, reasons).
- `services/demo-api/src/embedded.ts:39-48` (standalone simulated approval).
- `docs/INTEGRATIONS.md:10` (removed after `c38429d`; its successor is [docs/status/integrations.md](../status/integrations.md)).
- Enforced by: `services/demo-api/test/scenarios.test.ts:34` (S01, submission is not approval), `:78`, `:95` (S02), `:108` "support agents cannot decide identity cases", `:322`, `:337` (S10); `packages/domain/test/machines.test.ts:56-70`; `e2e/tests/admin-verifications.spec.ts:6`, `:18`, `:44`; `e2e/tests/driver-flows.spec.ts:114`.

## Revisit when

- [ADR-0034](0034-women-only-eligibility-and-verification-policy.md) is decided: add its checklist item and any data field here, or
- the driver sign-up adds documents (criminal-record extract, technical inspection; [docs/tasks/2026-10-13.md](../tasks/2026-10-13.md), task 2), or
- a KYC vendor is considered: it may read document fields, but must not infer gender or match faces without a new ADR and legal review.
