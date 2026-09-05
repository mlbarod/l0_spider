# L0 Spider Sensor 제외 설정 운영 가이드

## 1. 가장 간단한 적용 방법

L0 Spider를 다음과 같이 실행하고 있다면 실행 명령을 바꿀 필요가 없다.

```bash
PORT=<port> node server.mjs
```

서버의 L0 Spider application root에서 다음 파일 하나만 수정한다.

```text
config/sensor-exclusions.json
```

예를 들어 application root가 `/app/l0_spider`라면 실제 수정 파일은 다음과 같다.

```text
/app/l0_spider/config/sensor-exclusions.json
```

`/app/l0_spider`는 설명용 예시다. 실제 서버에서는 `server.mjs`가 있는 directory를 application root로 사용한다.

정리하면 다음과 같다.

```text
<application-root>/server.mjs
<application-root>/config/sensor-exclusions.json  ← 이 파일을 수정
```

- 환경변수 설정: 필요 없음
- 서버 실행 명령 변경: 필요 없음
- JSON 내용 변경 후 재build: 필요 없음
- JSON 내용 변경 후 서버 재시작: 필요 없음
- 적용 시점: 다음 관련 API 요청

## 2. 별도 서버에서 처음 확인하기

### 2.1 Application root 확인

현재 `PORT=<port> node server.mjs`를 실행하는 directory에서 확인한다.

```bash
# 운영자용 확인 명령
pwd
ls -l server.mjs config/sensor-exclusions.json
```

두 파일이 함께 확인되면 기본 설정 파일을 바로 사용할 수 있다.

Git에서 배포하는 파일은 `config/sensor-exclusions.example.json`이다. 실제 runtime 파일 `config/sensor-exclusions.json`은 source 배포나 서버 실행으로 자동 생성되지 않는다.
최초 준비는 대상 서버의 개발자·배포 담당자가 맡되, 실제 담당자와 배치 경로는 운영 환경에서 확인한다. 기존 설정 또는 `SENSOR_EXCLUSION_CONFIG_PATH` 사용 여부를 먼저 확인하고, runtime 파일이 없는 경우 예제를 임시본으로 복사해 필요한 규칙을 작성한다. §2.2의 validation을 임시본 경로로 실행한 뒤 정상 설정만 확정된 경로에 배치한다. 기존 운영 파일을 덮어쓰지 않는다.
예제와 runtime 파일은 형식을 공유하지만 실제 제외 단어까지 동일할 필요는 없다. 파일을 읽을 수 없으면 같은 경로의 메모리상 마지막 정상 설정을 사용하고, 정상 설정이 없으면 제외 없이 동작한다(§9).

### 2.2 설정 파일 검증

application root에서 실행한다.

```bash
# 운영자용 검증 명령
npm run sensor-exclusions:validate -- config/sensor-exclusions.json
```

성공 예시:

```json
{"ok":true,"termCounts":{"selfEquipment":0,"matchingAnomaly":0,"commonAnomaly":0,"commonCommonalityAnomaly":0,"mailing":0}}
```

출력에는 App별 등록 개수만 표시되고 실제 sensor 단어는 표시되지 않는다.
검증에 실패한 파일로 서버를 시작하거나 정상 파일을 덮어쓰지 않는다.

### 2.3 기존 명령으로 서버 실행

```bash
PORT=<port> node server.mjs
```

애플리케이션은 자동으로 다음 파일을 읽는다.

```text
<application-root>/config/sensor-exclusions.json
```

## 3. 설정 파일 전체 형식

초기 파일은 다음과 같다.

```json
{
  "version": 1,
  "apps": {
    "selfEquipment": {
      "contains": []
    },
    "matchingAnomaly": {
      "contains": []
    },
    "commonAnomaly": {
      "contains": []
    },
    "commonCommonalityAnomaly": {
      "contains": []
    },
    "mailing": {
      "contains": []
    }
  }
}
```

### App별 적용 위치

| App key | 적용 위치 | 비고 |
|---|---|---|
| `selfEquipment` | 일반 자설비 이상감지와 MY EQP | 두 기능이 같은 규칙 사용 |
| `matchingAnomaly` | 동일성 이상감지 | option과 결과에서 제외 |
| `commonAnomaly` | 공통부 이상감지 | option과 결과에서 제외 |
| `commonCommonalityAnomaly` | 공통부 동일성 이상감지 | option과 결과에서 제외 |
| `mailing` | `lineDashboard.mailingSummary` | Dashboard 화면 수치는 유지 |

각 App 규칙은 서로 독립적이다.
자설비와 Mailing에서 모두 같은 sensor를 제외하려면 `selfEquipment`와 `mailing`에 각각 입력해야 한다.

## 4. Sensor 단어 입력 예시

예를 들어 sensor 이름에 `TEST_SENSOR` 또는 `VIRTUAL`이 포함된 항목을 자설비와 Mailing에서 제외하고,
`DUMMY`가 포함된 sensor를 동일성 이상감지에서 제외하려면 다음과 같이 작성한다.

```json
{
  "version": 1,
  "apps": {
    "selfEquipment": {
      "contains": ["TEST_SENSOR", "VIRTUAL"]
    },
    "matchingAnomaly": {
      "contains": ["DUMMY"]
    },
    "commonAnomaly": {
      "contains": []
    },
    "commonCommonalityAnomaly": {
      "contains": []
    },
    "mailing": {
      "contains": ["TEST_SENSOR", "VIRTUAL"]
    }
  }
}
```

입력 규칙:

- 대소문자를 구분하지 않는다.
- sensor 이름에 입력 단어가 포함되면 제외한다.
- `TEMP`를 입력하면 `TEMP`, `TEMP_SENSOR`, `CH1_TEMP_AVG`가 모두 제외될 수 있다.
- STEP, EQP, recipe, Grade와 file path는 비교하지 않는다.
- App별 최대 100개 단어를 입력할 수 있다.
- 빈 문자열과 공백만 있는 값은 사용할 수 없다.
- 같은 App 안의 대소문자 중복은 하나로 처리한다.

짧고 범위가 넓은 단어는 예상보다 많은 sensor를 제외할 수 있으므로 반영 전에 영향 범위를 확인한다.

## 5. 파일 수정 후 반영

실행 중인 서버가 미검증 내용을 먼저 읽지 않도록, 활성 파일 자체를 바로 편집하지 않고 같은 directory의 임시본을 검증한 뒤 교체한다.

1. `config/sensor-exclusions.json`의 이전 정상 내용을 복구할 수 있게 보존한다.
2. 기존 mode와 owner를 최대한 유지하도록 임시본을 만든다.
3. `config/sensor-exclusions.next.json`의 `contains` 배열을 수정한다.
4. 임시본을 validation한다.
5. validation 성공 후 임시본으로 활성 파일을 교체한다.
6. 브라우저에서 필터를 다시 조회하거나 페이지를 새로 불러온다.
7. 제외 대상과 제외하지 않은 sensor를 각각 확인한다.

```bash
cp -p config/sensor-exclusions.json config/sensor-exclusions.next.json

# config/sensor-exclusions.next.json을 편집한 뒤 실행
npm run sensor-exclusions:validate -- config/sensor-exclusions.next.json
mv config/sensor-exclusions.next.json config/sensor-exclusions.json
```

`mv`는 validation이 성공한 경우에만 실행한다. 두 파일을 같은 `config/` directory에 두면 교체가 같은 filesystem 안에서 이뤄지고, `cp -p`는 기존 mode와 owner 보존을 시도한다.
교체 후 `ls -l config/sensor-exclusions.json`으로 권한과 owner가 이전과 같은지 확인한다.

같은 활성 경로의 파일을 교체하면 실행 중인 Node 서버가 다음 API 요청에서 mtime·size 변경을 확인하고 다시 읽는다.
따라서 일반적인 sensor 추가·삭제에는 server 재시작이 필요하지 않다.

React Query browser cache 때문에 이미 열린 화면은 이전 결과를 잠시 유지할 수 있다.
운영 확인 시 페이지를 새로 불러오거나 필터를 다시 선택해 새로운 API 요청을 발생시킨다.

## 6. `ALL`과 MY EQP 동작

sensor 제외는 `ALL` 조건보다 먼저 적용된다.

```text
원본 row
→ 기존 SKIP 제외
→ selfEquipment sensor 제외
→ 남은 sensor option 계산
→ sensor=ALL / ch_step=ALL 결과 생성
```

- 일부 sensor를 제외하면 `ALL`에는 남은 sensor만 포함된다.
- 모든 sensor가 제외되면 오류 대신 빈 option과 빈 결과가 표시된다.
- 선택 중이던 sensor가 새 규칙으로 제외되면 해당 선택은 유효하지 않은 값으로 정리되고 결과는 빈 상태가 된다.
- MY EQP의 Sensor Grade option도 제외 후 row를 기준으로 계산한다.

## 7. Mailing 적용 경계

`mailing.contains`는 현재 저장소에서 `GET /api/dashboard-data` 응답의 `lineDashboard.mailingSummary`에 적용된다.
Dashboard 화면의 KPI, `summary`, `lineSummary`, `dailyTrend`는 변경하지 않는다.

실제 Mailing renderer·sender와 MY EQP `my_eqp_rows` 생산기는 현재 저장소에서 확인되지 않았다.
별도 mail 서버가 데이터를 자체 집계한다면 그 서버에도 같은 sensor 제외 계약이 적용되는지 별도로 확인해야 한다.

## 8. 선택적 외부 경로 사용

기본 `config/sensor-exclusions.json` 대신 application source 밖의 파일을 사용해야 할 때만
`SENSOR_EXCLUSION_CONFIG_PATH`를 지정한다.

```bash
SENSOR_EXCLUSION_CONFIG_PATH=/etc/l0-spider/sensor-exclusions.json \
PORT=<port> node server.mjs
```

이 환경변수는 선택 사항이다.

- 환경변수 미지정: `config/sensor-exclusions.json` 자동 사용
- 환경변수 지정: 지정한 경로 사용; 운영에서는 절대경로 권장
- 상대경로 지정: `PORT=<port> node server.mjs`를 시작한 working directory 기준으로 해석
- 환경변수 경로 변경: Node 서버 재시작 필요
- 동일 경로의 JSON 내용 변경: 재시작 불필요

## 9. 오류와 복구

| 상황 | 서버 동작 | 대응 |
|---|---|---|
| 기본 파일이 정상 | 설정 적용 | 추가 조치 없음 |
| 최초 읽기에서 파일 없음·권한 오류·잘못된 JSON | 오류 log를 한 번 기록하고 제외 없음으로 계속 동작 | 파일 존재·권한·validation 확인 |
| 정상 로드 후 파일이 잘못 변경됨 | memory의 마지막 정상 설정 유지 | 이전 정상 JSON 복구 |
| 모든 sensor가 제외됨 | 해당 App 결과 또는 `mailingSummary`가 빈 상태 | 입력 단어 범위 확인 |

고정 오류 log:

```text
sensor exclusion config load failed; using safe fallback configuration
```

잘못된 JSON을 둔 채 Node 서버를 재시작하면 memory의 마지막 정상값이 사라지고 제외 없음으로 동작할 수 있다.
재시작보다 먼저 정상 JSON을 복구하고 validation을 실행한다.

## 10. 파일 권한과 Git 주의사항

웹사이트 사용자는 이 파일을 수정할 수 없다.
서버 OS에서 개발자·배포 담당자만 `config/sensor-exclusions.json`을 수정할 수 있게 권한을 관리한다.
Node 실행 계정에는 읽기 권한만 있으면 된다.
운영자가 Node 실행과 파일 수정을 같은 OS 계정으로 수행하면 프로세스도 그 계정의 파일 권한을 공유한다.
runtime 쓰기 권한까지 분리해야 하는 환경에서는 Node 전용 실행 계정과 배포 계정을 나누고, 실행 계정은 읽기 가능·쓰기 불가인지 운영 서버에서 확인한다.

운영 서버에서 실제 sensor 이름을 추가한 파일을 Git에 반영할지는 저장소 관리 정책에 따라 별도로 결정한다.
의도하지 않은 sensor 이름, 내부 경로, credential, token과 사용자 정보를 commit하거나 외부 ticket·log에 복사하지 않는다.

## 11. 반영 체크리스트

- [ ] `server.mjs`와 `config/sensor-exclusions.json`의 application root를 확인했다.
- [ ] release source의 예제·운영 가이드와 별도로 실제 runtime 설정을 준비하고, 선택한 경로의 읽기 권한을 확인했다.
- [ ] 수정 전 정상 JSON을 복구할 수 있게 보존했다.
- [ ] 임시본 validation 성공 후 활성 파일을 교체했다.
- [ ] 교체 후 활성 파일의 owner와 mode가 유지됐다.
- [ ] App key와 `contains` 배열 형식을 유지했다.
- [ ] validation이 성공했다.
- [ ] 제외 대상 sensor가 option과 결과에서 사라졌는지 확인했다.
- [ ] 제외하지 않은 sensor가 정상 조회되는지 확인했다.
- [ ] MY EQP와 `sensor=ALL`에 제외 sensor가 다시 포함되지 않는지 확인했다.
- [ ] Dashboard 화면 수치가 유지되는지 확인했다.
- [ ] Mailing의 별도 sender·MY EQP 집계 적용 여부를 구분해 확인했다.

## 12. 관련 파일

- `config/sensor-exclusions.json` — 서버가 기본으로 읽는 실제 설정 파일
- `config/sensor-exclusions.example.json` — 초기 형식 참고용
- `harness/contracts/sensor-exclusions.schema.json` — JSON Schema
- `scripts/validate_sensor_exclusions.mjs` — validation 명령
- `server/sensorExclusionConfig.mjs` — runtime 읽기·fallback
- `docs/operations/runbook.md` — 일반 운영 절차
- `docs/features/mailing.md` — Mailing 구현·Unknown 경계
