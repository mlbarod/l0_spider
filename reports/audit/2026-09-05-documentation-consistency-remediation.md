# 문서 정합성 감사 반영 결과

- 반영일: 2026-09-05
- 입력: [검수 인수인계](2026-09-05-documentation-consistency-audit-handoff.md)
- 범위: 지적된 문서와 직접 근거 코드의 정적 대조. 애플리케이션·설정·API·Schema·운영 데이터 변경 없음.
- 이 기록은 이번 문서 수정 결과이며 원 감사의 날짜·판정·기록을 대체하지 않는다.

| ID | 결과 | 반영 내용·수정 파일 |
|---|---|---|
| DOC-01 | 반영 | [Sensor 가이드](../../docs/operations/sensor-exclusion-config.md)·[deployment](../../docs/system/deployment.md): Git 예제와 별도 runtime JSON, 최초 준비·검증·fallback 구분 |
| DOC-02 | 반영 | [runbook](../../docs/operations/runbook.md)·deployment·[security](../../docs/system/security.md)·[release-checklist](../../docs/operations/release-checklist.md): MY EQP 조회의 조건부 DDL을 명시하고 읽기 전용 점검에서 제외 |
| DOC-03 | 반영 | [environment-definition](../../docs/system/environment-definition.md)·deployment: 세 경로 환경변수의 모듈 로드 시점과 파일 내용 조회 시점 구분 |
| DOC-04 | 반영 | security·environment-definition: 공지 관리자 검사와 거부 응답, 복수·단수 설정 이름 및 출처별 우선순위 명시 |
| DOC-05 | 반영 | security·[dashboard](../../docs/features/dashboard.md)와 관련 요약 overview·architecture: 보호 대상 오류 Schema와 HEAD·405 예외 구분 |
| DOC-06 | 반영 | [self-equipment](../../docs/features/self-equipment.md): 공통 QueryClient 기본값·개별 override 구분, 해결된 Unknown 제거 |
| DOC-07 | 반영 | [architecture](../../docs/system/architecture.md): Recharts 실제 사용과 Plotly dependency 선언 구분 |
| DOC-08 | 반영 | [ADR-003](../../docs/decisions/ADR-003-step-hmac-token.md): 중복 테스트 ID 표를 STEP 계약 §21 참조로 교체, 고유 검증 요구 보존 |
| DOC-09 | 반영 | [abnormal-data](../../docs/features/abnormal-data.md): ABN-M01을 명칭 차이만의 Mismatch에서 제외, 확인된 alias와 미확인 업무 정의 구분 |
| DOC-10 | 반영 | [step-deeplink](../../docs/features/step-deeplink.md)·security·ADR-003: 낡은 README·AGENTS 행 인용을 현행 코드 식별자·기준 문서 링크로 교체 |
| DOC-11 | 반영 | environment-definition: 존재하는 문서의 작성 예정 표기를 현재 링크·책임 안내로 변경 |
| DOC-12 | 반영 | [매뉴얼 index](../../docs/user-manual/index.md): MAN-M05를 미해결 목록에서 제거하고 해결 이력으로 분리 |
| DOC-13 | 반영 | [과거 검수 workflow 보고서](../development-validation-subagent-workflow.md): Historical / Superseded 표시와 현행 지침 링크 추가, 당시 실행·판정 보존 |
| DOC-14 | 반영 | [web_structure](../../web_structure.md): 탐색 역할 명시, 환경값·이력·메일 중복을 기준 링크로 정리, 고유 구조도·세부 연결 유지, 일괄 갱신 권고 수정 |
| DOC-15 | 반영 | deployment·runbook·release-checklist: 설정 정의·Sensor 절차·검증 명령·rollback 확인의 중복 축소, 실행 증거와 기준 링크 중심으로 정리 |
| DOC-16 | 반영 | [overview](../../docs/system/overview.md)·architecture·[data-flow](../../docs/system/data-flow.md): branch 정책 요약·AGENTS 연결. STEP·security·ADR-003: 현행 동작·설계 후보·보안 요구의 소유권 구분, 중복 Unknown 표 축소 |

## 검증과 남은 확인

- 변경된 문서의 상대 링크 대상·Markdown 제목 앵커를 검사했다.
- 최종 diff와 `git diff --check`를 확인했다. Markdown 이외 파일 변경은 없다.
- 문서 수정이므로 전체 test·build·서버 실행은 수행하지 않았다. 웹 화면이 읽는 `USER_MANUAL.md` 본문과 이미지도 변경하지 않았다.
- 운영 DB·`/appdata`·메일·배포·서비스 설정에 접근하거나 변경하지 않았다.
- 문서 반영 보류 항목은 없다. 실제 Sensor 설정 배치·담당자·권한, 운영 DB의 `is_public` 존재 여부, 브라우저 재현은 미검증이다.
- PPID의 모든 경로 간 업무 의미 동일성, HMAC 도입 계약, 외부 메일 renderer/sender 등 기존 미확인 사항은 그대로 남긴다. 문서 정리를 해당 기능의 구현·운영 검증 완료로 해석하지 않는다.
