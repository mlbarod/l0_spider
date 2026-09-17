# Chart Mailing 수신인 그룹 DB 구성안

상태: 테이블 생성용 제안. 현재 파일 저장 코드를 DB로 전환하지 않았으며 실제 DB에 DDL을 실행하지 않았다.

## 대상과 생성 SQL

기존 등록 기능은 `scripts/mailing_registration.py`에서 PyMySQL을 사용한다. 실제 DB 제품과 버전은 아직 확인하지 않았으므로, 이 구성안은 **MySQL 8.0.16 이상**을 전제로 한다. MariaDB나 다른 버전에서는 호환성을 별도로 확인한다.

먼저 `SELECT VERSION();`으로 버전을 확인하고, 대상 DB를 선택한 뒤 [생성 SQL](./chart-mail-recipient-groups.sql)의 부모 테이블, 자식 테이블 순서로 생성한다. 기존 `email` 및 `myeqp_regist`는 변경하지 않는다.

## 두 테이블의 역할

| 테이블 | 한 행의 의미 | 주요 값 |
|---|---|---|
| `chart_mail_recipient_group` | 특정 사용자가 만든 그룹 하나 | UUID, 소유자 Knox ID, 그룹 이름, 생성·수정 시각 |
| `chart_mail_recipient_group_member` | 해당 그룹에 등록한 수신인 한 명 | 그룹 UUID, 수신인 Knox ID, 순서 |

소유자가 다른 사용자는 같은 그룹 이름을 사용할 수 있다. 한 사용자의 그룹 이름은 대소문자만 다른 중복을 허용하지 않는다. 같은 수신인은 여러 그룹에 속할 수 있지만 한 그룹 안에서는 중복 등록할 수 없다. 별도의 전사 사용자·메일 주소록 테이블은 현재 기능에 필요하지 않다.

## Python에서 생성 SQL 실행하기

DB 관리 도구 대신 Python 또는 Jupyter Notebook에서 [생성 SQL](./chart-mail-recipient-groups.sql)을 실행할 수 있다. 아래 예제는 **사용자가 실행하면 입력한 DB에 실제 테이블을 생성하는 코드**다. 문서 작성 과정에서 실제 DB에 접속하거나 실행하지 않았다.

### 1. 실행 환경 준비

DB에 접속 가능한 Python 환경과 대상 DB의 테이블 생성·외래키 참조에 필요한 권한이 있는 계정을 사용한다. 사내 DB 접속에 별도의 TLS 설정 등이 필요하면 기존 접속 설정을 함께 적용한다.

PyMySQL이 설치되어 있지 않으면 터미널에서 실행한다.

```bash
python -m pip install pymysql
```

Jupyter Notebook에서는 셀에서 다음 명령을 실행한다.

```python
%pip install pymysql
```

### 2. SQL 파일 위치 지정

`chart-mail-recipient-groups.sql`을 Python의 **현재 작업 폴더**에 복사한다. 아래 예제의 상대 경로는 Python 파일이 있는 위치가 아니라 현재 작업 폴더를 기준으로 한다. Notebook에서도 같은 기준이다.

다른 위치에 두었다면 코드의 `Path(...)`를 실제 SQL 파일 경로로 바꾼다. 저장소 루트에서 실행하는 경우에는 `Path("docs/features/chart-mail-recipient-groups.sql")`을 사용하면 된다.

### 3. Python 코드 실행

아래 코드를 Notebook 셀에서 실행하거나 `create_chart_mail_tables.py`라는 파일로 저장해 `python create_chart_mail_tables.py`로 실행한다. DB 주소·포트·계정·비밀번호·DB 이름은 실행 시 입력한다. 비밀번호를 코드에 직접 적거나 Git에 저장하지 않는다.

코드는 버전을 확인한 다음 부모·자식 테이블 순서로 생성하고, 생성된 두 테이블의 정의를 출력한다. MariaDB 또는 MySQL 8.0.16 미만이면 생성 전에 중단한다. 기존 테이블을 삭제하거나 테스트 데이터를 넣는 작업은 포함하지 않는다.

```python
from pathlib import Path
from getpass import getpass
import re
import pymysql

# SQL 파일을 다른 위치에 두었다면 경로를 수정하세요.
sql = Path("chart-mail-recipient-groups.sql").read_text(encoding="utf-8")
# 파일 상단 주석의 SELECT VERSION(); 등이 실행 문장으로 분리되지 않게 합니다.
sql = "\n".join(
    line for line in sql.splitlines()
    if not line.lstrip().startswith("--")
)

conn = pymysql.connect(
    host=input("DB 서버 주소: ").strip(),
    port=int(input("DB 포트 [3306]: ").strip() or "3306"),
    user=input("DB 계정: ").strip(),
    password=getpass("DB 비밀번호: "),
    database=input("테이블을 생성할 DB 이름: ").strip(),
    charset="utf8mb4",
    connect_timeout=10,
    autocommit=True,
)

try:
    with conn.cursor() as cursor:
        cursor.execute("SELECT VERSION(), DATABASE()")
        version, database = cursor.fetchone()
        print(f"DB 버전: {version}, 대상 DB: {database}")

        match = re.match(r"^(\d+)\.(\d+)\.(\d+)", version)
        if (
            "mariadb" in version.lower()
            or not match
            or tuple(map(int, match.groups())) < (8, 0, 16)
        ):
            raise RuntimeError("이 SQL은 MySQL 8.0.16 이상 기준입니다.")

        # 제공한 SQL 파일의 CREATE TABLE 두 문장을 순서대로 실행합니다.
        for statement in sql.split(";"):
            if statement.strip():
                cursor.execute(statement)

        for table in (
            "chart_mail_recipient_group",
            "chart_mail_recipient_group_member",
        ):
            cursor.execute(f"SHOW CREATE TABLE `{table}`")
            print(cursor.fetchone()[1])
            print()

        print("테이블 2개 생성 완료")
finally:
    conn.close()
```

이 예제는 먼저 `--`로 시작하는 주석 줄을 제거한다. 파일 상단 주석에 있는 `SELECT VERSION();`의 세미콜론이 문장 분리를 방해하지 않게 하기 위해서다. 이후의 `sql.split(";")`는 현재 제공한 SQL 파일의 단순한 두 `CREATE TABLE` 문장에 맞춘 것이다. 문자열 안에 세미콜론이 들어가거나 프로시저·트리거 등이 포함된 다른 SQL 파일을 실행하는 범용 도구로 사용하지 않는다. 연결과 SQL 실행 방식은 [PyMySQL 공식 예제](https://pymysql.readthedocs.io/en/latest/user/examples.html)를 참고한다.

### 4. 실행 결과와 오류 처리

`테이블 2개 생성 완료`가 출력되면 아래의 **생성 후 확인** 기준과 출력된 테이블 정의를 비교한다. 이후 DB 연결 구현을 위해 DB 종류·버전, DB 이름, 기존 Spider와 동일한 접속 설정을 사용하는지, 두 테이블의 `SHOW CREATE TABLE` 결과를 전달한다. 비밀번호는 전달하지 않는다.

실행 중 오류가 나면 테이블을 삭제하거나 전체 코드를 반복 실행하지 말고 오류 내용을 확인한다. 특히 `Table already exists`는 기존 테이블이 있거나 이전 실행에서 일부 생성됐다는 뜻이다. 조회용 `SHOW CREATE TABLE`로 현재 상태를 확인한 뒤 필요한 조치를 정한다.

MySQL의 `CREATE TABLE`은 일반 데이터 변경처럼 전체를 `rollback()`으로 되돌릴 수 없다. 첫 번째 테이블 생성 후 두 번째에서 오류가 나면 첫 번째 테이블은 남을 수 있다. [MySQL 공식 설명](https://dev.mysql.com/doc/refman/8.0/en/implicit-commit.html)

테이블 생성만으로 애플리케이션의 저장 대상이 DB로 바뀌지는 않는다. 현재 개인별 수신인 그룹의 파일 저장 부분을 DB에 연결하는 구현은 별도로 진행한다.

## DB 관리 화면에서 직접 만드는 순서

아래 명세는 [생성 SQL](./chart-mail-recipient-groups.sql)과 같은 구조다. SQL 실행 대신 관리 화면에서 테이블과 컬럼을 하나씩 생성할 때 사용한다.

1. 대상 DB를 선택하고 `chart_mail_recipient_group` 테이블부터 만든다.
2. 그룹 테이블의 컬럼 6개와 기본키·UNIQUE·CHECK를 설정한다.
3. `chart_mail_recipient_group_member` 테이블을 만들고 컬럼 3개를 추가한다.
4. 수신인 테이블의 복합 기본키·UNIQUE·CHECK·외래키를 설정한다.
5. 아래 생성 후 확인 SQL로 저장된 구조를 확인한다. 두 테이블에는 테스트용 데이터를 넣지 않아도 된다.

공통 입력 기준:

| 관리 화면 항목 | 설정값 |
|---|---|
| 스토리지 엔진 / Engine | 두 테이블 모두 `InnoDB` |
| 테이블 문자셋 / Character set | `utf8mb4` |
| 테이블 정렬 규칙 / Collation | `utf8mb4_bin` |
| NULL 허용 / Allow NULL | 모든 컬럼에서 해제: `NOT NULL` |
| 자동 증가 / Auto Increment / Identity | 모든 컬럼에서 해제 |
| 생성 컬럼 / Generated column | 모든 컬럼에서 해제 |
| 아래 표의 기본값 `없음` | 기본값을 설정하지 않는다. 문자열 `없음`, 빈 문자열 `''`, `NULL`을 입력하는 뜻이 아님 |

컬럼별 문자셋·정렬 규칙을 따로 지정한 항목은 테이블 기본값보다 우선한다. UUID는 DB의 자동 증가 값이 아니라 애플리케이션이 생성한다.

### 1. 그룹 테이블: `chart_mail_recipient_group`

테이블 설명: `Chart Mailing 개인별 수신인 그룹`

| 순서 | 컬럼명 | 자료형 | 길이 / 정밀도 | NULL 허용 | 기본값 | 문자셋 / 정렬 규칙 | 용도 |
|---|---|---|---|---|---|---|---|
| 1 | `group_id` | `CHAR` | `36` | 아니오 | 없음 | `ascii` / `ascii_bin` | 그룹 UUID. 현재 API의 `id` |
| 2 | `owner_knox_id` | `VARCHAR` | `128` | 아니오 | 없음 | `utf8mb4` / `utf8mb4_bin` | 그룹을 만든 로그인 사용자 Knox ID |
| 3 | `group_name` | `VARCHAR` | `80` | 아니오 | 없음 | `utf8mb4` / `utf8mb4_bin` | 화면에 표시할 그룹 이름 |
| 4 | `group_name_key` | `VARCHAR` | `160` | 아니오 | 없음 | `utf8mb4` / `utf8mb4_bin` | 같은 소유자의 그룹 이름 중복 확인용 값 |
| 5 | `created_at` | `DATETIME` | 소수 초 정밀도 `3` | 아니오 | `CURRENT_TIMESTAMP(3)` | 해당 없음 | 생성 시각 |
| 6 | `updated_at` | `DATETIME` | 소수 초 정밀도 `3` | 아니오 | `CURRENT_TIMESTAMP(3)` | 해당 없음 | 마지막 수정 시각 |

추가 컬럼 설정:

- 시각 컬럼의 최종 자료형은 모두 **`DATETIME(3)`**이다. 여기서 `3`은 문자열 길이가 아니라 밀리초를 저장하는 소수 초 정밀도다.
- `CURRENT_TIMESTAMP(3)`는 따옴표 없는 SQL 식으로 설정한다. `'CURRENT_TIMESTAMP(3)'`라는 문자열을 저장하는 기본값으로 만들지 않는다.
- **`updated_at`에만** `ON UPDATE CURRENT_TIMESTAMP(3)`를 설정한다. 관리 도구에 별도 `On update` 항목이 있다면 여기에 `CURRENT_TIMESTAMP(3)`를 지정한다. `created_at`에는 설정하지 않는다.
- `group_name_key`는 일반 `VARCHAR` 컬럼이다. DB의 생성 컬럼으로 만들지 않는다. 향후 DB 저장 코드가 `group_name.trim().toLowerCase()` 결과를 넣는다.

기본키·인덱스 설정:

| 이름 | 종류 | 구성 컬럼과 순서 | 설정 의미 |
|---|---|---|---|
| `PRIMARY` | 기본키 / PRIMARY KEY | `group_id` | 그룹 UUID 중복 방지 |
| `uq_chart_mail_group_owner_name` | 고유 인덱스 / UNIQUE | 1: `owner_knox_id`, 2: `group_name_key` | 같은 소유자 안에서 그룹 이름 중복 방지 |

UNIQUE는 **두 컬럼을 묶은 인덱스 하나**다. `owner_knox_id`와 `group_name_key`를 각각 독립적인 UNIQUE로 설정하지 않는다. 같은 사용자가 여러 그룹을 만들고, 서로 다른 사용자가 같은 그룹 이름을 쓰는 동작을 보존하기 위해서다.

CHECK 제약조건 설정:

| 제약조건 이름 | 검사 식 | 적용 |
|---|---|---|
| `chk_chart_mail_group_name` | `CHAR_LENGTH(group_name) BETWEEN 1 AND 80` | 활성화 / ENFORCED |
| `chk_chart_mail_group_name_key` | `CHAR_LENGTH(group_name_key) BETWEEN 1 AND 160` | 활성화 / ENFORCED |
| `chk_chart_mail_group_owner` | `CHAR_LENGTH(owner_knox_id) BETWEEN 1 AND 128` | 활성화 / ENFORCED |

이 테이블에는 다른 테이블을 참조하는 외래키를 만들지 않는다. 별도의 사용자 테이블을 전제로 하지 않는다.

### 2. 수신인 테이블: `chart_mail_recipient_group_member`

테이블 설명: `Chart Mailing 그룹별 수신인, 그룹당 최대 100명`

| 순서 | 컬럼명 | 자료형 | 길이 / 추가 속성 | NULL 허용 | 기본값 | 문자셋 / 정렬 규칙 | 용도 |
|---|---|---|---|---|---|---|---|
| 1 | `group_id` | `CHAR` | `36` | 아니오 | 없음 | `ascii` / `ascii_bin` | 소속 그룹 UUID |
| 2 | `recipient_order` | `TINYINT` | **UNSIGNED 선택** | 아니오 | 없음 | 해당 없음 | 그룹 안의 등록 순서: 1~100 |
| 3 | `recipient_knox_id` | `VARCHAR` | `128` | 아니오 | 없음 | `ascii` / `ascii_general_ci` | 수신인 Knox ID |

추가 컬럼 설정:

- `group_id`의 자료형·길이·문자셋·정렬 규칙은 부모 테이블의 `group_id`와 동일하게 지정한다.
- `recipient_order`의 최종 자료형은 **`TINYINT UNSIGNED`**다. `100`을 자료형 길이로 입력해도 인원수 제한이 되지 않는다. 아래 CHECK와 복합 기본키를 함께 설정해야 한다.
- `recipient_order`는 자동 증가로 만들지 않는다. 향후 저장 코드가 각 그룹마다 1부터 순서대로 지정한다.
- `recipient_knox_id`는 전체 이메일 주소가 아닌 정규화한 Knox ID를 저장한다. 대소문자를 구분하지 않는 `ascii_general_ci`를 지정하여 동일 ID의 대소문자 차이로 중복 등록되는 것을 막는다.

기본키·인덱스 설정:

| 이름 | 종류 | 구성 컬럼과 순서 | 설정 의미 |
|---|---|---|---|
| `PRIMARY` | 복합 기본키 / PRIMARY KEY | 1: `group_id`, 2: `recipient_order` | 같은 그룹에서 순번 중복 방지 |
| `uq_chart_mail_group_recipient` | 고유 인덱스 / UNIQUE | 1: `group_id`, 2: `recipient_knox_id` | 같은 그룹에서 수신인 중복 방지 |

각 행은 **두 컬럼을 묶은 키 하나**다. `group_id`만 단독 기본키로 지정하면 한 그룹에 수신인을 한 명밖에 등록할 수 없으므로, 반드시 `recipient_order`를 함께 선택한다. 별도의 자동 증가 `id` 컬럼은 추가하지 않아도 된다.

CHECK 제약조건 설정:

| 제약조건 이름 | 검사 식 | 적용 |
|---|---|---|
| `chk_chart_mail_recipient_order` | `recipient_order BETWEEN 1 AND 100` | 활성화 / ENFORCED |
| `chk_chart_mail_recipient_id` | `CHAR_LENGTH(recipient_knox_id) BETWEEN 1 AND 128` | 활성화 / ENFORCED |

외래키 설정:

| 관리 화면 항목 | 설정값 |
|---|---|
| 외래키 이름 | `fk_chart_mail_member_group` |
| 현재 테이블 컬럼 | `group_id` |
| 참조 DB | 두 테이블을 만든 동일 DB |
| 참조 테이블 | `chart_mail_recipient_group` |
| 참조 컬럼 | `group_id` |
| 삭제 시 / ON DELETE | `CASCADE` |
| 변경 시 / ON UPDATE | 기본값 유지 (`NO ACTION` 또는 `RESTRICT`) |

### 3. 관리 화면에 CHECK 입력 항목이 없을 때

컬럼과 키는 관리 화면에서 만들고, **아직 추가하지 않은 CHECK만** SQL 편집기에서 아래와 같이 추가할 수 있다. 이미 같은 이름의 제약조건이 있으면 다시 실행하지 않는다. 이 SQL은 기존 컬럼·키·외래키 설정을 대신하지 않는다.

```sql
ALTER TABLE chart_mail_recipient_group
    ADD CONSTRAINT chk_chart_mail_group_name
        CHECK (CHAR_LENGTH(group_name) BETWEEN 1 AND 80),
    ADD CONSTRAINT chk_chart_mail_group_name_key
        CHECK (CHAR_LENGTH(group_name_key) BETWEEN 1 AND 160),
    ADD CONSTRAINT chk_chart_mail_group_owner
        CHECK (CHAR_LENGTH(owner_knox_id) BETWEEN 1 AND 128);

ALTER TABLE chart_mail_recipient_group_member
    ADD CONSTRAINT chk_chart_mail_recipient_order
        CHECK (recipient_order BETWEEN 1 AND 100),
    ADD CONSTRAINT chk_chart_mail_recipient_id
        CHECK (CHAR_LENGTH(recipient_knox_id) BETWEEN 1 AND 128);
```

CHECK를 생략하거나 비활성화하면 DB에서의 그룹당 100명 제한을 보장할 수 없다. DB 버전 조건도 함께 충족해야 한다.

### 4. 생성 후 확인

아래 명령은 데이터 변경 없이 테이블 정의를 조회한다.

```sql
SHOW CREATE TABLE chart_mail_recipient_group;
SHOW CREATE TABLE chart_mail_recipient_group_member;
```

결과에서 다음을 확인한다.

- 그룹 테이블 6개 컬럼, 수신인 테이블 3개 컬럼이 위 명세와 일치한다.
- 두 테이블 모두 InnoDB이며 모든 컬럼이 NOT NULL이다.
- 그룹 테이블의 소유자·이름 UNIQUE와 수신인 테이블의 복합 기본키·UNIQUE가 컬럼 두 개씩으로 구성되어 있다.
- CHECK 5개가 있고 `NOT ENFORCED`로 표시되지 않는다. 특히 `recipient_order`의 범위가 1~100이다.
- 수신인 테이블 외래키가 그룹 테이블을 참조하며 `ON DELETE CASCADE`가 있다.
- `updated_at`에만 `ON UPDATE CURRENT_TIMESTAMP(3)`가 있다.

## 현재 코드와의 대응

| 현재 값 | DB 값 | 저장 규칙 |
|---|---|---|
| `id` | `group_id` | 현재 `randomUUID()` 값을 그대로 사용 |
| 내부 `owner` | `owner_knox_id` | 서버의 SSO 로그인 정보에서 정규화하며 요청 본문의 소유자 값을 사용하지 않음 |
| `name` | `group_name` | 현재처럼 앞뒤 공백 제거, 최대 80자 검증 |
| 이름 중복 비교 | `group_name_key` | 서버 JavaScript의 `name.trim().toLowerCase()` 결과 저장. 일부 문자의 소문자 변환 시 길이가 늘어날 수 있어 160자로 확보 |
| `recipients[]` | 자식 테이블 여러 행 | 소문자 Knox ID로 정규화·중복 제거 후 순서대로 1~100 부여 |
| `updatedAt` | `updated_at` | UTC 기준으로 저장하고 API 응답은 기존 ISO 문자열 형식 유지 |

`group_name_key`는 수신인 등록 화면에서 입력하는 항목이 아니다. DB 저장 코드가 자동으로 계산할 값이다. `utf8mb4_bin` 비교를 사용하여 이름의 대소문자 처리 규칙은 현재 JavaScript 코드에 맡긴다.

## 그룹당 100명 제한

- 현재 `parseMailRecipients()`가 정규화와 중복 제거 후 **1~100명**을 검사한다. 그룹 저장 API와 작성창에서 공통으로 사용한다.
- DB에서는 `recipient_order`를 `NOT NULL`과 `CHECK (recipient_order BETWEEN 1 AND 100)`로 제한한다.
- `(group_id, recipient_order)`가 기본키이므로 같은 그룹에 사용할 수 있는 순서는 최대 100개다. 따라서 CHECK가 활성화된 DB에서는 동시 저장 상황에도 101번째 수신인 행을 넣을 수 없다.
- `(group_id, recipient_knox_id)`의 UNIQUE는 같은 수신인의 중복 등록을 방지한다. 이 컬럼은 ASCII 대소문자를 구분하지 않아 대문자로 직접 입력한 동일 ID도 중복으로 처리한다.
- 최소 1명 등록은 애플리케이션에서 검증한다. 부모 테이블의 행만 생성하는 작업까지 이 DDL이 금지하지는 않는다.

이 방식은 별도 인원수 컬럼이나 인원수 계산 트리거가 필요하지 않다. MySQL의 CHECK 제약은 **8.0.16부터 실제 적용**되며 이전 버전에서는 무시된다. [MySQL 공식 CHECK 문서](https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html)

현재 작성창에는 여러 그룹과 직접 입력을 합친 **최종 수신인도 최대 100명**으로 제한하는 동작이 있다. 이번 그룹당 100명 요구사항으로 이 기존 발송 요청 제한을 바꾸지는 않는다.

## DB 연결 시 구현할 사항

1. PyMySQL 연결은 `charset="utf8mb4"`와 UTC 세션 시각을 사용한다. 두 테이블의 생성·수정 시각도 UTC로 저장한다.
2. 그룹 조회·수정·삭제는 로그인 사용자의 `owner_knox_id`를 항상 조건에 포함한다. 테이블 구조만으로 개인별 접근 권한이 자동 적용되지는 않는다.
3. 수정 시 `group_id`와 `owner_knox_id` 조건으로 부모 행을 `SELECT ... FOR UPDATE`하여 소유권을 확인하고 잠근다. 같은 트랜잭션에서 이름 변경, 기존 수신인 교체, 새 순번 1~N 삽입을 처리한다. 실패하면 전체 rollback한다.
4. 수신인만 변경해도 부모 `updated_at`을 명시적으로 갱신한다. 자식 변경만으로 부모의 자동 수정 시각이 바뀌지는 않는다.
5. 그룹 삭제는 소유권 조건으로 부모를 삭제한다. `ON DELETE CASCADE`가 자식 수신인 행을 함께 삭제한다. [MySQL 공식 외래키 문서](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html)
6. 현재 사용자당 그룹 최대 50개 제한도 저장 코드에서 유지한다. 이 DDL 자체는 사용자당 그룹 수를 제한하지 않는다. 다중 연결에서 동시에 새 그룹을 생성하는 경우 소유자별 생성 처리를 직렬화하는 방식을 DB 연결 구현 시 정한다.
7. 기존 파일 그룹을 이전할 때 UUID·소유자·이름·수신인 순서·수정 시각을 보존한다. 파일에는 생성 시각이 없으므로 이전한 그룹의 `created_at`은 이전 시각으로 기록한다. 파일 삭제나 자동 이전은 이번 구성안에 포함하지 않는다.

현재 UI와 API 응답 형태는 유지할 수 있다. 다만 **테이블 생성만으로 저장 대상이 DB로 바뀌지 않으며**, `server/mailRecipientGroups.mjs`의 파일 저장 부분을 DB 구현으로 연결하는 작업이 남는다.
