---
id: ADR-0020
title: "French-only product, MAD, Africa/Casablanca business time, UTC ISO storage"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0003, PAX-11, PRD-23]
---

# ADR-0020 · French-only product, MAD, Africa/Casablanca business time, UTC ISO storage

## Context

The handoff states that all customer-facing copy is French, the currency is MAD, business scheduling uses Africa/Casablanca and timestamps are stored in UTC (handoff prompt:5). Phone input starts on +212 (prompt:176). Morocco moves its clock around Ramadan, so a fixed offset is wrong for part of the year.

## Decision

Ship one language, French, in every customer and admin surface, addressing people with "vous" and using feminine forms (passagère, chauffeuse). Keep shared labels and error messages in `@naya/domain` (`labels.ts`, `errors.ts`) so the server and every app say the same thing; screen copy is written in French where it is used. Format money with `formatMoney` (MAD, French separators). Store every timestamp as a UTC ISO string; compute business dates and wall-clock times only through `packages/domain/src/time.ts`, which formats with `Intl` in `Africa/Casablanca` and derives the offset per instant, never a hard-coded +1. Do not add an i18n framework or right-to-left layout for now.

## Consequences

- No translation layer to maintain; copy reads naturally for the Rabat launch.
- Adding Arabic later means extracting every inline string and auditing every layout for RTL. Writing new layouts with start/end instead of left/right lowers that cost.
- End-to-end tests run in the `fr-MA` locale and the Casablanca timezone, so formatting and date bugs show up there.
- Copy errors are product bugs: the emergency number "15 (SAMU)" is the French convention, not the Moroccan one (backlog [PAX-11, PRD-23](../status/backlog.md)); family recurrence picks the next weekday in UTC (audit section 6.3, "Business timezone").

## Alternatives considered

Not recorded at the time. French and Arabic, or Darija, at launch are listed as options in the audit (decision D12); the recommended default keeps French only for v1.

## Evidence

Line numbers at commit `c38429d`.

- Commit: `96af8c6` (2026-09-30) added `time.ts`, `labels.ts`, `errors.ts` and `money.ts`.
- `README.md:5`.
- `packages/domain/src/time.ts:1-4` (business timezone, UTC ISO type), `:8-25` (`fr-MA` formatters in Casablanca time), `:27-41` (offset computed per instant), `:43-50` (wall clock to UTC).
- `packages/domain/src/labels.ts:3-70` (status labels and reasons); `packages/domain/src/errors.ts:2-35` (`ERROR_MESSAGES`); `packages/domain/src/money.ts:58-72` (French money format).
- `packages/domain/src/phone.ts` (`+212` first); `packages/domain/src/entities.ts:195` (`timezone: 'Africa/Casablanca'` on every city).
- Enforced by: `e2e/playwright.config.ts:25` (`locale: 'fr-MA'`, `timezoneId: 'Africa/Casablanca'`); `packages/domain/test/money.test.ts:15` "formats French amounts".

## Revisit when

- Naya decides to add Arabic or Darija (audit decision D12), or
- a city outside Morocco is configured: `CityConfig.timezone` is typed as Casablanca only.
