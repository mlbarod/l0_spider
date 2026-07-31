#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
BUILD_OUTPUT_DIR=""

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

cleanup() {
  if [[ -n "${BUILD_OUTPUT_DIR}" && -d "${BUILD_OUTPUT_DIR}" ]]; then
    case "${BUILD_OUTPUT_DIR}" in
      /tmp/l0-spider-verify-build.*)
        rm -rf -- "${BUILD_OUTPUT_DIR}"
        ;;
      *)
        fail "예상하지 않은 임시 build 경로는 삭제하지 않음: ${BUILD_OUTPUT_DIR}"
        ;;
    esac
  fi
}

run_required() {
  local label="$1"
  shift
  if "$@"; then
    pass "${label}"
  else
    fail "${label}"
  fi
}

trap cleanup EXIT
cd -- "${REPO_ROOT}"

run_required "환경·필수 자산 검증 통과" "${SCRIPT_DIR}/verify-env.sh"
run_required "Dashboard·Mailing 계약 검증 통과" "${SCRIPT_DIR}/verify-contracts.sh"

run_required \
  "STEP/HMAC unit test 통과" \
  node --test "${REPO_ROOT}/tests/unit/step-hmac.test.mjs"

run_required \
  "STEP 딥링크 synthetic integration test 통과" \
  node --test "${REPO_ROOT}/tests/integration/step-deeplink.test.mjs"

skip "전체 integration suite는 향후 외부 자원 의존 test 혼입을 막기 위해 실행하지 않음"

run_required \
  "실제 발송 없는 Mailing summary 집계 test 통과" \
  node --test "${REPO_ROOT}/tests/contract/mailing-summary.contract.test.mjs"

if [[ -f "${REPO_ROOT}/tests/unit/mailing-render.test.mjs" ]]; then
  skip "mailing render test는 side-effect-free 승인 근거가 없어 자동 실행하지 않음"
else
  skip "mailing renderer가 문서상 Blocked이므로 render test 미실행"
fi

run_required "ESLint 정적 검증 통과" npm run lint

BUILD_OUTPUT_DIR="$(mktemp -d /tmp/l0-spider-verify-build.XXXXXX)"
run_required \
  "Vite build 통과 (임시 출력 사용)" \
  npm run build -- --outDir "${BUILD_OUTPUT_DIR}"

run_required "git diff --check 통과" git diff --check

skip "E2E·Playwright·browser·mock-agent 검증은 Core 안전 진입점 범위 밖"
skip "실제 server·DB·/appdata·SMTP·외부 API·systemd·Docker는 실행하거나 접근하지 않음"
pass "L0 Spider Core 안전 검증 전체 완료"
