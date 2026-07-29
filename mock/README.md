# L0 Spider synthetic Mock environment

## Purpose

This directory provides a personal-PC-only HTTP Mock environment for `mock-agent` and QA branches derived from it. It runs the unchanged frontend from `src` while Vite's explicit `mock` mode proxies API traffic to a loopback-only synthetic server. It must never be merged into `main`.

Mock mode also aliases the frontend's pre-existing local data modules to `mock/fixtures/local`. Existing non-loopback links and legacy defaults are sanitized at Vite transform time so offline review cannot navigate to a company or external host. Ordinary and production modes retain the original modules and values.

## Install

Use the repository's existing npm workflow:

```bash
npm ci
```

Node.js is not pinned by the repository. The environment was implemented and verified with Node.js 22 and npm 9. No new runtime dependency was added.

## Run and stop

Start both processes:

```bash
npm run mock
```

Start either process separately when debugging:

```bash
npm run mock:server
npm run dev:mock
```

Stop the combined command with `Ctrl+C`. The runner forwards termination to both child process groups. If either child fails, the other child is stopped.

Ports:

- Mock frontend: `http://127.0.0.1:4175`
- Mock API: `http://127.0.0.1:5175`

Override ports in the shell or `.env.mock.local` only if they conflict. Keep all hosts on `localhost` or `127.0.0.1`.

## Scenarios

- `normal`: multiple synthetic lines, products, equipment, sensors, grades, list rows, summaries, details, and chart points
- `empty`: empty arrays, zero totals, and no chart points
- `single`: one list row and one chart point
- `partial`: only optional fields are null or omitted
- `large`: fixed-seed large lists and chart point sets
- `slow`: route delays of 1, 3, or 10 seconds depending on endpoint type
- `error-400`, `error-401`, `error-403`, `error-404`, `error-500`, `error-502`: stable JSON error responses
- `timeout`: connection stays pending until the client aborts
- `race-condition`: `LINE_A` takes 3 seconds and `LINE_B` takes 300 milliseconds
- `inconsistent`: deliberate summary/detail total mismatch
- `edge-values`: null, empty string, zero, negative/large/decimal values, long text, duplicate rows, numeric strings, invalid date strings, shuffled time series, and string encodings of non-finite values

Change and inspect the active scenario:

```bash
npm run mock:scenario -- normal
npm run mock:scenario -- empty
npm run mock:scenario -- slow
npm run mock:scenario -- error-500
npm run mock:scenario -- large
curl http://127.0.0.1:5175/__mock/scenario
```

## Route override and reset

Use only synthetic paths and fixtures:

```bash
curl -X POST http://127.0.0.1:5175/__mock/override \
  -H 'Content-Type: application/json' \
  -d '{"route":"/api/dashboard-data","method":"GET","status":500,"delay_ms":2500}'
```

Supported override keys are `status`, `delay_ms`, `timeout`, and `fixture` (also accepted as `response_fixture`). Reset all overrides and restore `normal`:

```bash
npm run mock:reset
```

The control API exists only in `mock/server`:

- `GET /__mock/scenario`
- `POST /__mock/scenario`
- `POST /__mock/reset`
- `POST /__mock/override`
- `GET /__mock/health`

## Add fixtures and generators

Add scenario metadata under `mock/fixtures/<scenario>/index.mjs`, register it in `mock/fixtures/index.mjs`, and add the response transformation to `mock/generators/synthetic-data.mjs`. Use an explicit fixed seed. Reuse only the approved identifiers in `SYNTHETIC`; do not paste data from logs, screenshots, API responses, databases, or service files.

Runtime responses are assembled by `mock/server/routes/api.mjs`. Add the path and method to `mock/contracts/api-contracts.mjs`, update `docs/mock-api-inventory.md`, then add a contract test before exposing the route.

## Contract change procedure

1. Inspect frontend request creation and property access only.
2. Update the inventory with method, path, request shape, response fields, empty/error behavior, and query key.
3. Update the runtime schema validator and synthetic response.
4. Run `npm run test:contract`, `npm run test:unit`, `npm run lint`, and `npm run build`.
5. Run `npm run test:e2e` when Playwright browser OS dependencies are present.
6. Never infer or reproduce backend-only fields that the frontend does not use.

## Forbidden data

Never add real internal hosts, IPs, ports, line/product/equipment/sensor/process identifiers, users, credentials, tokens, cookies, sessions, database details, server paths, production data, anomaly results, or organization information. Logs must not contain full request or response bodies. Mock API logs intentionally show only method, path, status, and duration.

## Tests

```bash
npm run test:contract
npm run test:e2e
npm run test:mock
```

Contract tests start an ephemeral loopback server. Playwright starts both fixed-port Mock processes. Browser artifacts go to ignored `test-results/` and `playwright-report/`.

## Known limitations

- Contracts cover frontend-observed fields, not backend implementation details.
- State is process-local and resets when the API process stops.
- Mutation endpoints acknowledge synthetic writes but do not persist them.
- Image endpoints return generated SVG placeholders.
- `large` is deterministic but is not a production capacity model.
- Playwright requires compatible Chromium OS libraries on the host.
- The current repository has no TypeScript/typecheck command and no declared Node engine.

## QA agent use

- Browser QA: run `npm run mock`, select a scenario, and initially write findings only.
- Code Audit: inspect `mock/contracts`, the API inventory, and request isolation; initially write findings only.
- Performance: use `large`, `slow`, and `race-condition`; record metrics without changing business logic.

QA branches must be created manually by the user from `mock-agent`. Do not automatically switch, create, merge, rebase, commit, or push branches.
