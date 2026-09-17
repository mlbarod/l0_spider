-- Chart Mailing 개인별 수신인 그룹: DB 저장 연동용 스키마 (기존 테이블에 재실행하지 않음)
-- 대상: MySQL 8.0.16 이상 / InnoDB / utf8mb4
-- 실행 전에 SELECT VERSION(); 으로 DB 종류와 버전을 확인하고 대상 DB를 선택한다.
-- MySQL 8.0.16 미만에서는 CHECK가 무시되므로 이 SQL로 100명 제한을 보장할 수 없다.
-- 기존 email / myeqp_regist 테이블과 별도로 생성한다.

CREATE TABLE chart_mail_recipient_group (
    group_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
        COMMENT '애플리케이션에서 생성한 UUID, 현재 API의 id',
    owner_knox_id VARCHAR(128) NOT NULL
        COMMENT '로그인 사용자 Knox ID, 앞뒤 공백 제거 및 소문자 정규화',
    group_name VARCHAR(80) NOT NULL
        COMMENT '화면에 표시할 그룹 이름',
    group_name_key VARCHAR(160) NOT NULL
        COMMENT '서버에서 group_name.trim().toLowerCase()로 생성하는 중복 확인 키',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (group_id),
    UNIQUE KEY uq_chart_mail_group_owner_name (owner_knox_id, group_name_key),
    CONSTRAINT chk_chart_mail_group_name
        CHECK (CHAR_LENGTH(group_name) BETWEEN 1 AND 80),
    CONSTRAINT chk_chart_mail_group_name_key
        CHECK (CHAR_LENGTH(group_name_key) BETWEEN 1 AND 160),
    CONSTRAINT chk_chart_mail_group_owner
        CHECK (CHAR_LENGTH(owner_knox_id) BETWEEN 1 AND 128)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
  COMMENT='Chart Mailing 개인별 수신인 그룹';

CREATE TABLE chart_mail_recipient_group_member (
    group_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    recipient_order TINYINT UNSIGNED NOT NULL
        COMMENT '그룹 내 수신인 순서, 1부터 100까지',
    recipient_knox_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL
        COMMENT '이메일 도메인을 제거하고 소문자로 정규화한 수신인 Knox ID',

    PRIMARY KEY (group_id, recipient_order),
    UNIQUE KEY uq_chart_mail_group_recipient (group_id, recipient_knox_id),
    CONSTRAINT chk_chart_mail_recipient_order
        CHECK (recipient_order BETWEEN 1 AND 100),
    CONSTRAINT chk_chart_mail_recipient_id
        CHECK (CHAR_LENGTH(recipient_knox_id) BETWEEN 1 AND 128),
    CONSTRAINT fk_chart_mail_member_group
        FOREIGN KEY (group_id)
        REFERENCES chart_mail_recipient_group (group_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
  COMMENT='Chart Mailing 그룹별 수신인, 그룹당 최대 100명';
