-- 기존 DB_INFO_PATH가 가리키는 MySQL/MariaDB DB에서 수동 실행합니다.
-- 4개 App 공통: 사용자별 Line 및 (Line, SDWT)를 독립적으로 복수 등록/해제합니다.
-- 0개 등록 허용. 현재 조회는 단일 선택을 유지하며 먼저 등록한 유효 항목으로 시작합니다.
-- 앱 DB 계정에 SELECT, INSERT, UPDATE, DELETE 권한이 필요합니다.
CREATE TABLE IF NOT EXISTS anomaly_filter_favorite_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    knox_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    filter_type VARCHAR(8) COLLATE utf8mb4_bin NOT NULL,
    line_name VARCHAR(160) COLLATE utf8mb4_bin NOT NULL,
    sdwt VARCHAR(160) COLLATE utf8mb4_bin NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_filter_item (knox_id, filter_type, line_name, sdwt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- 이전 단일 즐겨찾기 테이블을 이미 사용 중인 경우에만 아래 두 쿼리를 최초 전환 시 1회 실행합니다.
-- 신규 설치는 실행하지 않습니다. 기존 테이블은 보존합니다.
-- 전환 후 다시 실행하면 사용자가 해제한 항목이 복원될 수 있으므로 재실행하지 않습니다.
-- INSERT INTO anomaly_filter_favorite_items (knox_id, filter_type, line_name, sdwt)
-- SELECT knox_id, 'line', line_name, '' FROM anomaly_filter_favorites
-- ON DUPLICATE KEY UPDATE id = id;
-- INSERT INTO anomaly_filter_favorite_items (knox_id, filter_type, line_name, sdwt)
-- SELECT knox_id, 'sdwt', line_name, sdwt FROM anomaly_filter_favorites
-- WHERE sdwt IS NOT NULL AND sdwt <> ''
-- ON DUPLICATE KEY UPDATE id = id;
