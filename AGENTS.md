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
