---
id: ADR-0028
title: "Test strategy"
status: Accepted
date: 2026-09-30
deciders: Achraf (via implementation)
supersedes: []
related: [ADR-0011, ADR-0057, QA-02, QA-03, QA-05, QA-14, UI-19, ADM-23, DRV-18, WEB-09]
---

# ADR-0028 · Test strategy

## Context

The handoff asks to run and inspect the apps rather than judge source alone, to test iOS and Android native builds where the environment permits and report unavailable platforms explicitly, to automate business-logic tests for every financial invariant, transition guard, expiry, duplicate event, cancellation and scheduling rule, and to add interaction tests and end-to-end coverage for scenarios S01–S16 (handoff prompt:214-236). The build machine has Xcode and the iOS Simulator but no Android SDK (`README.md:55`).

## Decision

| Layer | Tool | Scope |
|---|---|---|
| Domain rules | vitest (`packages/domain`) | Money, pricing, every wallet invariant, state machines. |
| API scenarios | vitest (`services/demo-api`) | S01–S16 and platform guarantees against the real Hono app in-process, with a manual clock; standalone mode with network blocked; Oct 6 workflows. |
| Shared components | jest-expo + Testing Library, run from the passenger app | Buttons, OTP, money components, deadline hook, single flight, account isolation in `packages/ui`. |
| End to end | Playwright | Expo **web** builds of both apps (phone viewport) and the Vite admin, against one shared demo API, serially. |
| Website | `node:test` (`apps/web`) | The localStorage store. |
| Native | Manual, iOS Simulator | Release builds driven by `e2e/scripts/native-tour.mjs`, screenshots reviewed. |

Do not use Detox or Maestro for now: native E2E is replaced by Playwright on the web builds plus manual simulator review. Android is reported as not verified. Record test results only in [docs/quality/verification-log.md](../quality/verification-log.md).

## Consequences

- Business rules are tested where they live, fast and deterministic; the same scenarios run against the server code that ships in the embedded demo.
- Native-only behaviour (SecureStore, background location, camera, Liquid Glass, Apple Maps, notifications) has no automated test; Android has never been built or run (`README.md:175`).
- `pnpm test` also runs Playwright, which needs four running servers (backlog [QA-03, QA-14](../status/backlog.md)). There is no CI (QA-02; [ADR-0057](0057-branch-review-and-ci-policy.md)).
- Gaps: the Oct 6 features have little e2e coverage (QA-05); the admin and driver apps have no unit tests (ADM-23, DRV-18); kit tests run only through the passenger app (UI-19); the website's Playwright spec is not wired to any script (WEB-09).

## Alternatives considered

Detox or Maestro for native E2E: not adopted; the reason was not recorded. Playwright reuses the web builds that react-native-web already provides, at the cost of not exercising native modules.

## Evidence

Line numbers at commit `c38429d`.

- Commits: `96af8c6` (2026-09-30) domain and API tests; `8ff041f` (2026-09-30) e2e workspace; `f0f8d46` (2026-09-30) Playwright config; `0fa0487` (2026-09-30) native tour script; `5e907b4` (2026-10-01) component tests.
- `packages/domain/package.json:11`, `services/demo-api/package.json:12` (vitest); `apps/passenger/package.json:14` and `apps/passenger/jest.config.js:1-13` (kit tests from the passenger app); `e2e/package.json:6`; `apps/web/package.json:10`.
- `e2e/playwright.config.ts:3-31` (web builds, ports, one worker, `fr-MA`).
- `services/demo-api/test/harness.ts:6-24` (real app, manual clock).
- `package.json:17` (`pnpm test` runs every package's `test`, Playwright included).
- `README.md:150-156`, `:175`, `:179`.
- Enforced by: this ADR describes the tests themselves.

## Revisit when

- CI is set up ([ADR-0057](0057-branch-review-and-ci-policy.md)): split unit tests from e2e in the scripts, or
- Android enters the launch scope (audit decision D10), or
- a native-only defect reaches testers that a web build cannot reproduce: add Maestro or Detox for that flow.
