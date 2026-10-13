---
id: ADR-0034
title: "Women-only eligibility and verification policy"
status: Proposed
date: 2026-10-13
deciders: Achraf — pending
supersedes: []
related: [ADR-0018, ADR-0019, ADR-0036, ADR-0045, ADR-0055, P6, P1, P16, DOC-06, PRD-34, DOM-06, DOM-07, docs/tasks/2026-10-13.md, docs/specs/eligibility-and-verification.md]
---

# ADR-0034 · Women-only eligibility and verification policy

## Context

Decision **D1** in the [audit](../audits/2026-10-13-full-audit.md#9-decisions-needed-from-achraf) (tracked in [open questions](../status/open-questions.md#d1-women-only-eligibility)). It unblocks P6 and shapes P1 and P16 ([backlog](../status/backlog.md)). This rule defines the brand and is legally sensitive.

- The product is described as a "Women-only mobility service". The help copy tells passengers that Naya is reserved for women and that every file is reviewed by a person « sans décision automatique fondée sur l’apparence ».
- Until this documentation set, the rule against inferring gender from appearance was written only in the git-ignored handoff (handoff prompt:166) and implied by that help copy. [ADR-0019](0019-verification-is-a-manual-human-review-with.md) now records it, with the manual review.
- Nothing records eligibility. `IdentityDetails` holds name, birth date, document type and number only. The reviewer checklist has three items, and none is eligibility. The only related outcome is the rejection code `not_eligible` (« Conditions d’inscription non remplies »). That code is not recoverable, and there is no appeal path.
- Naya Famille accepts children aged 1–17 of either sex. The demo seeds an adult male handover recipient (« Père »). The public FAQ mentions children only as « accompagnés de leur mère ».
- Founder brief 13 Oct ([task 2](../tasks/2026-10-13.md)) lists the driver documents: CIN, licence (category, issue and expiry dates), criminal-record extract, carte grise, insurance, visite technique, vehicle photos. It also asks for one status per document. Task 4 asks for stricter vetting of Famille drivers. Open question 3 ([F3](../status/open-questions.md#f3-criminal-record-extract-scope)) asks whether the criminal-record extract applies to every driver or only to Famille drivers.

## Decision

**Recommended, pending Achraf’s choice and counsel: D1 option (a), a reviewer check on the identity document.**

1. Establish eligibility from the sex field of the identity document (CIN, passport or residence permit), read by a human reviewer. Never infer it from the selfie, the name, the voice, or any automated or appearance-based signal.
2. Make « Éligibilité confirmée sur la pièce d’identité » a mandatory checklist item for every approval of a passenger or driver identity case. Record on the decision who confirmed it, when, and from which document. Do not store a separate gender attribute on the profile.
3. A `not_eligible` rejection gives the applicant a written reason and an appeal: a support request that a second reviewer decides within a published delay.
4. Riders are women. Children ride only under Naya Famille ([ADR-0036](0036-naya-famille-operating-model.md)). An adult named by the parent may be a handover recipient whatever their sex, but is never a rider.
5. Drivers: require the founder-brief document list. Require the criminal-record extract from **every** driver, not only Famille drivers. Famille adds references, experience with children, training, an interview and periodic re-checks.
6. Get a written legal opinion for Morocco on the women-only basis and on processing these documents (CNDP, law 09-08) before launch.

## Consequences

- CaseReview gains a blocking item. An API test proves that an approval without it is refused.
- Approvals carry an eligibility record. Appeals need a support category and a second reviewer, so the same person never decides twice.
- The landing FAQ must match the Famille policy (backlog PRD-30, WEB-14).
- Required items per document type are fixed separately: a passport has no back side (backlog DOM-06). Expiry and revocation are covered in [ADR-0055](0055-account-lifecycle.md).
- Requiring the criminal-record extract from every driver adds sign-up friction and delay. It needs a document type and an expiry date.

## Alternatives considered

| Option | For | Against |
|---|---|---|
| (b) Self-declaration at sign-up plus the same reviewer check | Gives the user's own attestation | Collects a sensitive attribute and proves nothing on its own |
| (c) A KYC vendor reads the document field | Scales; consistent | Contract, cross-border transfer under CNDP, and a misread becomes an automated decision. Revisit with [ADR-0045](0045-production-backend-and-live-integrations.md), keeping a human in the loop |
| Selfie or appearance check | None that holds | Forbidden by the handoff (prompt:166); inaccurate and discriminatory |
| Criminal-record extract for Famille drivers only | Less friction for regular drivers | Implies regular rides need less vetting, while passengers are women often travelling alone |

## Evidence

Line numbers at commit `c38429d`.

- `README.md:3`; `apps/passenger/src/features/help/topics.ts:38`.
- Handoff prompt:166 (`_handoff/Naya-Expo-React-Native-Implementation-Prompt.md`, git-ignored, local only).
- `packages/domain/src/entities.ts:100-106` (`IdentityDetails`, no eligibility field).
- `apps/admin/src/pages/CaseReview.tsx:153` (three checklist items, none on eligibility).
- `services/demo-api/src/services/verification.ts:21` (recoverable rejections exclude `not_eligible`), `:27`.
- `packages/domain/src/machines/verification.ts:16-20` (required items per subject).
- `services/demo-api/src/services/prototype.ts:76` (child age 1–17), `:592-597` (seeded « Père » recipient).
- `apps/web/components/landing.tsx:40` (« Les enfants accompagnés de leur mère sont également les bienvenus »).
- Enforced by: no test covers eligibility today.

## Revisit when

- Counsel's opinion arrives, or
- a KYC vendor is chosen, or
- review volume outgrows the reviewers, or
- appeals show a pattern of disputed decisions.
