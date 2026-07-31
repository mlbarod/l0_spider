#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

pass() {
  printf '[PASS] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

skip() {
  printf '[SKIP] %s\n' "$1"
}

validate_json() {
  local relative_path="$1"
  if node -e '
    const fs = require("node:fs");
    JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  ' "${REPO_ROOT}/${relative_path}"; then
    pass "JSON 문법 확인: ${relative_path}"
  else
    fail "JSON 문법 오류: ${relative_path}"
  fi
}

cd -- "${REPO_ROOT}"

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js runtime 누락"
fi
if ! command -v npm >/dev/null 2>&1; then
  fail "npm package manager 누락"
fi

contract_json_files=(
  "harness/contracts/dashboard-api.schema.json"
  "harness/contracts/mailing-summary.schema.json"
  "harness/fixtures/dashboard/dashboard-success.json"
  "harness/fixtures/dashboard/dashboard-empty.json"
  "harness/fixtures/mailing/mailing-summary-success.json"
  "harness/fixtures/mailing/mailing-summary-empty.json"
)

for json_file in "${contract_json_files[@]}"; do
  if [[ ! -f "${REPO_ROOT}/${json_file}" ]]; then
    fail "계약 JSON 누락: ${json_file}"
  fi
  validate_json "${json_file}"
done

if [[ ! -f "${REPO_ROOT}/tests/contract/dashboard-api.contract.test.mjs" ]]; then
  fail "Dashboard contract test 누락"
fi
if [[ ! -f "${REPO_ROOT}/tests/contract/mailing-summary.contract.test.mjs" ]]; then
  fail "Mailing summary contract test 누락"
fi

if npm run test:contract; then
  pass "Schema compile, Dashboard·Mailing fixture validation과 contract test 통과"
else
  fail "contract test 실패"
fi

skip "Mailing full template context·renderer·sender 계약은 문서상 Blocked이며 검증 대상으로 가장하지 않음"
skip "실제 API·DB·/appdata·SMTP 호출은 contract 검증 범위에서 제외"
pass "Core 계약 검증 완료"
