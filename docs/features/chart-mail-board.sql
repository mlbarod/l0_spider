-- Chart Mailing 게시판: MySQL / InnoDB / utf8mb4 기준.
-- 운영 담당자가 DB 버전/권한을 확인하고 대상 DB에서 별도로 실행한다.
-- 기존 테이블을 변경하지 않으며 애플리케이션은 DDL을 자동 실행하지 않는다.
CREATE TABLE chart_mail_post (
    post_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sender_knox_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    title VARCHAR(300) NOT NULL,
    details TEXT NOT NULL,
    comment TEXT NOT NULL,
    chart_url TEXT NOT NULL,
    app VARCHAR(40) NOT NULL,
    work_status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    mail_state VARCHAR(20) NOT NULL DEFAULT 'pending',
    diagnostics TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL,
    mail_updated_at DATETIME(3) NULL,
    updated_at DATETIME(3) NOT NULL,
    INDEX idx_chart_mail_post_created (created_at, post_id),
    INDEX idx_chart_mail_post_sender (sender_knox_id, created_at),
    INDEX idx_chart_mail_post_work (work_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE chart_mail_post_recipient (
    post_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    recipient_knox_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    recipient_order SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (post_id, recipient_knox_id),
    INDEX idx_chart_mail_recipient_user (recipient_knox_id, post_id),
    CONSTRAINT fk_chart_mail_recipient_post FOREIGN KEY (post_id) REFERENCES chart_mail_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE chart_mail_post_image (
    post_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    image_png MEDIUMBLOB NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    image_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    CONSTRAINT fk_chart_mail_image_post FOREIGN KEY (post_id) REFERENCES chart_mail_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE chart_mail_post_history (
    history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    post_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    previous_status VARCHAR(20) NOT NULL,
    next_status VARCHAR(20) NOT NULL,
    changed_by VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    comment VARCHAR(1000) NOT NULL,
    changed_at DATETIME(3) NOT NULL,
    CONSTRAINT fk_chart_mail_history_post FOREIGN KEY (post_id) REFERENCES chart_mail_post (post_id),
    INDEX idx_chart_mail_history_post (post_id, history_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
