# Mock environment findings

## Finding 1 — Mock proxy could be bypassed by existing Vite middleware

- Severity: critical for Mock isolation
- Related file: `vite.config.mjs`
- Classification: confirmed
- Reproduction: enable a Mock proxy while leaving the existing service API middleware registered; matching `/api` requests can be consumed before reaching the proxy.
- Mock impact: service handlers may attempt filesystem or integration access, violating offline and no-real-API requirements.
- Action taken: minimal Mock-only configuration fix; existing service middleware is omitted only when explicit Mock mode is active.
- Future owner: Code Audit agent should verify middleware ordering after Vite upgrades.

## Finding 2 — Existing service integration files contain sensitive-value risk

- Severity: high
- Related files: locations listed in `docs/mock-environment-plan.md`
- Classification: confirmed location risk; values not reproduced
- Reproduction: inspect service configuration, Python integration, manual generation, or historical data utility sources.
- Mock impact: accidental copying could contaminate fixtures, logs, screenshots, and documentation.
- Action taken: no existing data copied; generators use an allowlisted synthetic vocabulary.
- Future owner: Code Audit agent, report-only first.

## Finding 3 — Playwright browser host dependencies are incomplete

- Severity: medium
- Related file: host runtime; `playwright.config.mjs`
- Classification: confirmed
- Reproduction: run `npm run test:e2e`; Chromium terminates before opening a page because a required shared library is unavailable.
- Mock impact: six smoke tests are implemented but were not executed beyond browser launch.
- Action taken: no host package installation was performed. Contract and HTTP proxy integration tests cover the Mock backend and request isolation.
- Future owner: environment maintainer; install compatible Playwright Chromium OS dependencies, then rerun Browser QA.

## Finding 4 — Production bundle size warning

- Severity: low
- Related files: existing frontend dependency graph
- Classification: confirmed build warning
- Reproduction: `npm run build`.
- Mock impact: none; build succeeds.
- Action taken: none, because performance/code-splitting changes are outside Mock setup.
- Future owner: Performance agent, report-only first.

## Finding 5 — No declared Node engine or typecheck command

- Severity: low
- Related file: `package.json`
- Classification: confirmed
- Reproduction: inspect package metadata and scripts.
- Mock impact: developers must use a compatible current Node release; JavaScript receives syntax/lint/test validation but no static typecheck.
- Action taken: documented the verified Node/npm versions; did not introduce TypeScript.
- Future owner: Code Audit agent.

## Finding 6 — Existing UI/business defects were not audited

- Severity: informational
- Related files: `src/`
- Classification: scope boundary
- Reproduction: not applicable.
- Mock impact: the environment now makes future browser review possible once host browser dependencies are installed.
- Action taken: no UI, business logic, cache, race, error handling, design, or performance behavior was broadly modified.
- Future owner: Browser QA, Code Audit, and Performance agents on their dedicated branches.
