# Mock environment analysis and plan

## Safety and scope

- Working branch at implementation start: `mock-agent`
- Initial worktree state: clean
- Baseline commit: `4d5ef32`
- Scope: Mock-only execution and verification support; no frontend copy and no business-logic change
- Network boundary: Mock API and frontend bind to `127.0.0.1`; Mock mode proxies both `/api` and `/__mock` to the loopback API
- Service boundary: existing `server.mjs`, ordinary `vite` development, and production build behavior remain service-oriented and do not start the Mock server

## Repository analysis

1. Package manager: npm, identified by `package-lock.json` and npm scripts.
2. Node.js requirement: no `engines`, `.nvmrc`, or `.node-version` declaration exists. The checked environment used Node.js 22.22.1 and npm 9.2.0.
3. Frontend stack: JavaScript/JSX ESM, React 19, React Router 7, TanStack React Query 5, Vite 6, Tailwind CSS 4, Radix UI, Recharts and Plotly-related visualization packages.
4. Existing development command: `npm run dev` invokes Vite and retains its existing meaning.
5. Existing `server.mjs`: a Node HTTP server serves API handlers plus Vite middleware in live-reload mode, or builds/serves `dist` when live reload is disabled. It remains unchanged and never starts Mock code.
6. Vite: React plugin, source aliases, existing service API middleware, host/HMR rules, development port, and preview host rules. In explicit Mock mode the service API middleware is omitted and loopback proxy rules are enabled.
7. API requests: frontend API modules use relative `/api/...` requests. Nineteen distinct endpoint paths are inventoried in `docs/mock-api-inventory.md`.
8. HTTP clients: native `fetch` only; no axios use. React Query `queryFn` declarations are in the dashboard component and feature pages. Mutations use the API modules directly.
9. API base/proxy: requests were relative and ordinary mode had no API proxy. Mock mode now uses `VITE_API_BASE_URL`, defaulting only to `http://127.0.0.1:5175`.
10. Environment loading: service code reads a small set of `process.env` variables directly. Vite now uses `loadEnv(mode, ...)` only to activate explicit Mock mode. `.env.mock` and `.env.mock.example` contain no secrets.
11. Response use: dashboard summary/options/trend arrays; filter option arrays; anomaly rows; chart points/groups; mapping dictionaries; current-user identifier; registration lists; mutation affected-row status. Exact fields are in the API inventory and runtime contracts.
12. Tests: ESLint, Node test files, and Playwright dependency existed. Scripts were added for existing unit tests, Mock contracts, and E2E. No typecheck command exists because the project is JavaScript-based.
13. Service dependencies: service handler modules read filesystem-based datasets and configuration and invoke Python/database integration scripts. These handlers are excluded from Mock mode.
14. Sensitive-data exposure risk: existing service paths, host configuration, scripts, manual material, and historical frontend utility data need care. No value from those locations was copied into Mock fixtures.

## Implementation design

```text
unchanged src
  ├─ ordinary Vite/server mode -> existing service handlers
  └─ Vite mock mode -> /api and /__mock proxy
                            |
                            v
                 127.0.0.1:5175
                 synthetic Node Mock API
```

- Runtime: dependency-free Node HTTP server with graceful shutdown and bounded JSON body parsing.
- State: in-memory scenario plus method/path override map.
- Data: fixed-seed generator using only approved synthetic identifiers.
- Local frontend data: Mock-mode module resolution replaces existing in-memory data sources, and a tested source sanitizer converts non-loopback links/defaults without editing or copying `src`.
- Contract: endpoint catalog and runtime response shape checks.
- Logs: method, masked path (pathname only), status, duration.
- CORS: absent Origin or loopback Origin only.
- Tests: ephemeral-port contract suite plus fixed-port Playwright smoke suite.
- Process control: combined runner terminates both process groups when one exits or a termination signal is received.

## Sensitive-information review

민감정보 의심 위치: `vite.config.mjs`  
유형: 내부 URL  
실제 값: 출력하지 않음

민감정보 의심 위치: `src/config/spiderDataPaths.mjs`  
유형: 실제 서버 파일 경로  
실제 값: 출력하지 않음

민감정보 의심 위치: `server/*.mjs`  
유형: 실제 서버 파일 경로 / 실제 식별자 / 기타  
실제 값: 출력하지 않음

민감정보 의심 위치: `scripts/*.py`  
유형: 인증정보 / DB 접속정보 / 실제 사용자 식별 처리  
실제 값: 출력하지 않음

민감정보 의심 위치: `scripts/generate-user-manual-screenshots.mjs`  
유형: 실제 서버 파일 경로 / 실제 식별자  
실제 값: 출력하지 않음

민감정보 의심 위치: `src/features/fdc-trend/utils/fdcTrendMockData.js`  
유형: 실제 식별자 / 실제 서버 파일 경로  
실제 값: 출력하지 않음

민감정보 의심 위치: `docs/user-manual/` 및 `public/mailing-report.html`  
유형: 실제 식별자 / 기타  
실제 값: 출력하지 않음

## Planned verification

- Dependency state, syntax, lint, existing unit tests, contract tests, production build
- Mock-mode build and bundle leakage scan
- Mock API and frontend start, health, proxy isolation
- normal, empty, slow, error-500, large, and reset behavior
- process shutdown and port return
- Playwright smoke when the host browser runtime is available

No commit, push, merge, rebase, branch creation, or branch switch is part of this plan.
