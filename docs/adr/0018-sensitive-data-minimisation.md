---
id: ADR-0018
title: "Sensitive-data minimisation"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0014, ADR-0017, ADR-0019, ADR-0045, ADM-19, API-22, UI-15, PRD-29]
---

# ADR-0018 · Sensitive-data minimisation

## Context

The handoff says to treat uploaded documents as private resources with protected uploads and access controls, and to use fictional fixtures (handoff prompt:166); never to persist tokens, identity documents or payment details in an ordinary client store (prompt:103); and to use tokenised provider payment components, never storing raw card data (prompt:202). Naya stores identity documents, selfies and, since 6 October, child profiles and arrival photos.

## Decision

- Serve uploads only through the authenticated `/uploads/:id` endpoint. Only the owner, admins with `verification.decide`, and admins with `support.resolve` or `config.edit` for support attachments may read a file; the admin shows documents through a blob URL fetched with its bearer token, never a public URL.
- Decide an upload's type from its magic bytes, not from its declared type; accept JPEG, PNG, WebP and PDF up to 10 MB; refuse SVG and any mismatch.
- On the device, resize picked images to at most 1600 px on the long edge and re-encode them as JPEG with `exif: false`, which drops location metadata.
- Never send a card number to the Naya API: the card form passes only the last four digits to the provider sandbox, and Naya stores the returned token plus `last4` (the typed expiry is not sent; the demo server fills a fixed one).
- Use only fictional people and "SPÉCIMEN · FICTIF" documents in fixtures.

## Consequences

- A leaked upload id is useless without an authorised session.
- Polyglot or script-bearing files (SVG) cannot be stored as identity documents.
- Document reads are not audited, although the admin claims they are (backlog [ADM-19, API-22](../status/backlog.md)); images are base64-encoded in JS with no client-side size limit (UI-15).
- The arrival-proof rule added on 6 October lets a parent read her trip's proof photo; child data has no consent or retention model yet (backlog PRD-29).
- Production needs encrypted object storage, a retention policy and a CNDP declaration (`docs/INTEGRATIONS.md:10` at `c38429d`; now [docs/status/integrations.md](../status/integrations.md)).

## Alternatives considered

Not recorded at the time.

## Evidence

Line numbers at commit `c38429d`.

- Commits: `96af8c6` (2026-09-30) upload service and sniffing; `177cbd6` (2026-09-30) client resizing; `f0f8d46` (2026-09-30) card form and admin document viewer.
- `services/demo-api/src/services/uploads.ts:7` (10 MB), `:9-17` (magic bytes), `:29-35` (SVG and mismatch refused), `:53-69` (read access rules).
- `packages/ui/src/features/uploads.ts:17-20` (≤ 1600 px, JPEG), `:32`, `:38` (`exif: false`), `:44-47` (resize).
- `apps/admin/src/lib/api.ts:57-63` (blob URL with bearer token).
- `apps/passenger/src/app/(app)/card/new.tsx:25-45` (only `last4` to the tokeniser); `packages/domain/src/entities.ts:294-305` (`providerToken`, never a PAN); `services/demo-api/src/app.ts:608-614` (sandbox tokeniser), `:365-379` (stores token and `last4`, returns the card without its token).
- `README.md:148` (fictional fixtures).
- Enforced by: `services/demo-api/test/scenarios.test.ts:60-61` (another user gets 403 on a passenger's document, the reviewer gets 200), `:69` "rejects uploads whose bytes are not the declared image type". No test covers the client resize or EXIF removal.

## Revisit when

- Real identity documents are collected ([ADR-0045](0045-production-backend-and-live-integrations.md)): storage, encryption, retention and access logging must be decided first, or
- a payment partner's SDK replaces the sandbox card form, or
- Naya Famille launches with real children's data ([ADR-0036](0036-naya-famille-operating-model.md)).
