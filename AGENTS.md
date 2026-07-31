# Mock-agent branch instructions

These instructions apply only to `mock-agent` and personal QA branches created from it.

- Never merge or rebase `mock-agent` or its QA branches into `main`.
- Use synthetic data only. Never use real company, production, process, quality, user, or organization data.
- Never print or record internal URLs, hosts, IPs, ports, credentials, tokens, secrets, real identifiers, or real server paths.
- Derive API contracts only from the fields and request shapes used by the frontend.
- Keep Mock-only code separate from service code. Mock behavior must require an explicit Mock command or Vite mode.
- Do not hide errors by converting them into successful empty responses.
- Clearly distinguish confirmed defects from inferred risks.
- Browser QA, Code Audit, and Performance agents initially produce reports only; they do not broadly fix application defects.
- Do not commit, push, merge, switch branches, or discard existing changes unless the user explicitly authorizes that exact Git action.

## Validation-agent common rules

These rules apply to Browser QA, Code Audit, and Performance work on `mock-agent` and review branches derived from it.

- This environment is exclusively for `mock-agent` and its review branches. Never merge these branches into `main`.
- Use synthetic Mock data only. Never use real company, production, process, quality, user, or organization data.
- Never record real internal URLs, hosts, IPs, ports, server paths, credentials, tokens, secrets, or identifiers in reports or artifacts.
- Write all review results and reports in Korean. Paths, commands, API endpoints, code identifiers, metrics, and error messages may retain their original form.
- The three review agents have no authority to modify application source, tests, configuration, dependencies, or lock files.
- Agents may only inspect, test, analyze, measure, collect evidence, and write within their designated `reports/` and `artifacts/` paths.
- Never conceal a failure or schema mismatch with a default value, and never treat an indeterminate state as normal.
- Treat data-integrity defects as the highest risk, especially mixed-scope data, stale responses, mismatched totals, and misleading normal/abnormal judgments.
- Clearly separate confirmed facts, inferred risks, non-reproductions, and items requiring further confirmation.
- Application fixes must be requested separately by the user from the development Codex working on `main`.
- Do not automatically commit, push, merge, rebase, switch branches, create branches, or discard existing changes.

## Code Audit responsibilities

- Review duplicate functions and similar implementations, oversized React pages/components, and repeated API handlers or error handling.
- Review dispersed filter, normalization, and payload-building logic; overlapping Node/Python responsibilities; and unused dependencies, files, or code.
- Review duplicate or unbounded cache/query settings, repeated DB helpers or subprocess patterns, hard-to-test side effects/imports, and mismatches between documented responsibilities and actual module boundaries.
- For each finding, distinguish maintainability duplication, intentional compatibility code, measured performance problems, and style-only differences.
- State the affected screens, APIs, contracts, and tests, and whether the current evidence supports safe consolidation.
