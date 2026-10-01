-- Mailing Report: 수신인별 SDWT·Grade 조건을 여러 행으로 저장하기 위한 변경안.
-- 확인된 기존 구조: email VARCHAR(120) PRIMARY KEY,
-- sdwt VARCHAR(255), priority VARCHAR(25), InnoDB, utf8mb4_general_ci.
-- 기존 컬럼, 데이터, NOT NULL, 문자셋은 유지한다. 애플리케이션은 DDL을 실행하지 않는다.
-- 대상 DB를 선택한 운영자가 아래 조회 결과를 확인한 뒤 변경 구문만 별도 실행한다.

SHOW CREATE TABLE email;
SHOW INDEX FROM email;

-- 결과가 있으면 참조 관계를 먼저 검토한다. 외래키 검사를 끄고 강제로 변경하지 않는다.
SELECT TABLE_SCHEMA, TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME,
       REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME = 'email';

-- 적용 조건: 위에 확인된 기존 구조이며 참조 외래키가 없고,
-- PRIMARY KEY 필수 운영 정책이 없으며 idx_mailing_email_lookup 이름이 미사용일 것.
-- 이 파일을 통째로 실행해도 조회만 수행하도록 변경 구문은 주석 처리했다.
-- 아래 한 문장의 주석을 해제하여 별도로 적용한다. 재실행하지 않는다.
-- ALTER TABLE email
--   DROP PRIMARY KEY,
--   ADD INDEX idx_mailing_email_lookup (email);

-- 적용 후 SHOW INDEX FROM email; 결과:
-- email 단독 PRIMARY/UNIQUE 없음, idx_mailing_email_lookup의 Non_unique = 1.
-- 데이터가 여러 행으로 나뉜 뒤 PRIMARY KEY(email)를 단순 복원하면 중복 오류가 발생한다.
-- 외부 발송기도 수신인의 모든 행을 읽고 각 행의 SDWT × Grade 조합을 유지해야 한다.
