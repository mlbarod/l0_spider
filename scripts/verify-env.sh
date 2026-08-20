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

require_command() {
  local command_name="$1"
  if command -v "${command_name}" >/dev/null 2>&1; then
    pass "필수 command 확인: ${command_name}"
  else
    fail "필수 command 누락: ${command_name}"
  fi
}

require_file() {
  local relative_path="$1"
  if [[ -f "${REPO_ROOT}/${relative_path}" ]]; then
    pass "필수 파일 확인: ${relative_path}"
  else
    fail "필수 파일 누락: ${relative_path}"
  fi
}

require_code_reference() {
  local relative_path="$1"
  local literal="$2"
  local variable_name="$3"
  if grep -Fq -- "${literal}" "${REPO_ROOT}/${relative_path}"; then
    pass "환경변수 이름 확인: ${variable_name} (${relative_path})"
  else
    fail "문서화된 환경변수 이름을 코드에서 찾지 못함: ${variable_name} (${relative_path})"
  fi
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

require_command bash
require_command node
require_command npm
require_command git
require_command grep
require_command mktemp

pass "Bash runtime 사용 가능: ${BASH_VERSION}"
pass "Node.js runtime 사용 가능: $(node --version)"
pass "npm package manager 사용 가능: $(npm --version)"

required_files=(
  "AGENTS.md"
  "package.json"
  "package-lock.json"
  "docs/system/environment-definition.md"
  "docs/system/security.md"
  "docs/system/deployment.md"
  "docs/operations/runbook.md"
  "docs/operations/release-checklist.md"
  "docs/features/mailing.md"
  "harness/contracts/dashboard-api.schema.json"
  "harness/contracts/mailing-summary.schema.json"
  "harness/fixtures/dashboard/dashboard-success.json"
  "harness/fixtures/dashboard/dashboard-empty.json"
  "harness/fixtures/mailing/mailing-summary-success.json"
  "harness/fixtures/mailing/mailing-summary-empty.json"
  "tests/contract/dashboard-api.contract.test.mjs"
  "tests/contract/mailing-summary.contract.test.mjs"
  "tests/unit/step-hmac.test.mjs"
  "tests/integration/step-deeplink.test.mjs"
)

for required_file in "${required_files[@]}"; do
  require_file "${required_file}"
done

if node -e '
  const packageLock = require(process.argv[1]);
  if (packageLock.lockfileVersion !== 3) process.exit(1);
' "${REPO_ROOT}/package-lock.json"; then
  pass "npm lockfile 형식 확인: package-lock.json lockfileVersion 3"
else
  fail "현재 Core Harness가 확인한 npm lockfileVersion 3과 일치하지 않음"
fi

if node -e '
  const packageJson = require(process.argv[1]);
  const requiredScripts = ["lint", "build", "test:unit", "test:integration", "test:contract"];
  const missing = requiredScripts.filter((name) => !packageJson.scripts?.[name]);
  if (missing.length) {
    console.error(`missing scripts: ${missing.join(", ")}`);
    process.exit(1);
  }
' "${REPO_ROOT}/package.json"; then
  pass "필수 package script 확인: lint, build, test:unit, test:integration, test:contract"
else
  fail "필수 package script 누락"
fi

if node -e '
  for (const moduleName of ["ajv/dist/2020.js", "ajv-formats", "eslint", "vite"]) {
    require.resolve(moduleName);
  }
'; then
  pass "설치 없이 사용할 validator·lint·build module 확인"
else
  fail "필수 Node module 누락; 이 script는 package 설치를 수행하지 않음"
fi

json_files=(
  "package.json"
  "package-lock.json"
  "harness/contracts/dashboard-api.schema.json"
  "harness/contracts/mailing-summary.schema.json"
  "harness/fixtures/dashboard/dashboard-success.json"
  "harness/fixtures/dashboard/dashboard-empty.json"
  "harness/fixtures/mailing/mailing-summary-success.json"
  "harness/fixtures/mailing/mailing-summary-empty.json"
)

for json_file in "${json_files[@]}"; do
  validate_json "${json_file}"
done

require_code_reference "server.mjs" "process.env.PORT" "PORT"
require_code_reference "server.mjs" "process.env.HOST" "HOST"
require_code_reference "server.mjs" "process.env.LIVE_RELOAD" "LIVE_RELOAD"
require_code_reference "server.mjs" "process.env.BUILD_ON_START" "BUILD_ON_START"
require_code_reference "vite.config.mjs" "process.env.VITE_SITE_URL" "VITE_SITE_URL"
require_code_reference "server/mappingConfig.mjs" "process.env.MAPPING_CONFIG_PATH" "MAPPING_CONFIG_PATH"
require_code_reference "server/latestCommonalityPath.mjs" "process.env.COMMONALITY_ROOT_PATH" "COMMONALITY_ROOT_PATH"
require_code_reference "server/latestCommonCommonalityPath.mjs" "process.env.COMMON_COMMONALITY_ROOT_PATH" "COMMON_COMMONALITY_ROOT_PATH"
require_code_reference "server/dashboardData.mjs" "process.env.SPIDER_DASHBOARD_PATH_ROOT" "SPIDER_DASHBOARD_PATH_ROOT"
require_code_reference "scripts/current_user.py" 'os.environ.get("DB_INFO_PATH")' "DB_INFO_PATH"
require_code_reference "server/currentUser.mjs" "REMOTE_ADDR" "REMOTE_ADDR"
require_code_reference "scripts/generate-user-manual-screenshots.mjs" "process.env.MANUAL_BASE_URL" "MANUAL_BASE_URL"
require_code_reference "scripts/generate-user-manual-screenshots.mjs" "process.env.PLAYWRIGHT_LD_LIBRARY_PATH" "PLAYWRIGHT_LD_LIBRARY_PATH"
require_code_reference "scripts/generate-user-manual-screenshots.mjs" "process.env.LD_LIBRARY_PATH" "LD_LIBRARY_PATH"

if [[ -f "${REPO_ROOT}/.env.example" ]]; then
  example_variables=(
    PORT
    HOST
    LIVE_RELOAD
    BUILD_ON_START
    VITE_SITE_URL
    MAPPING_CONFIG_PATH
    COMMONALITY_ROOT_PATH
    COMMON_COMMONALITY_ROOT_PATH
    SPIDER_DASHBOARD_PATH_ROOT
    DB_INFO_PATH
  )
  for variable_name in "${example_variables[@]}"; do
    if grep -Eq "^[[:space:]]*${variable_name}=" "${REPO_ROOT}/.env.example"; then
      pass "환경 예제 이름 확인: ${variable_name}"
    else
      fail ".env.example에 문서화된 설정 이름 누락: ${variable_name}"
    fi
  done
else
  skip "tracked .env.example이 없어 코드·예제 전체 parity 검증 불가 (문서화된 Mismatch)"
fi

skip "Node.js·Python·npm의 프로젝트 지원 버전은 선언되지 않아 installed version 적합성 판정 불가"
skip "HMAC secret과 SMTP 환경변수 이름은 구현 근거가 없어 가상 설정을 검증하지 않음"
skip "Python DB helper, Playwright와 browser runtime은 안전한 Core 검증에 필요하지 않아 실행하지 않음"

if [[ -f "${REPO_ROOT}/tests/unit/mailing-render.test.mjs" ]]; then
  skip "mailing render test가 존재하지만 side-effect-free 승인 근거 없이는 자동 실행하지 않음"
else
  skip "mailing renderer·full context는 문서상 Blocked이므로 render test를 필수 자산으로 요구하지 않음"
fi

pass "환경·필수 자산 정적 검증 완료; 실제 .env와 운영 자원은 읽지 않음"
