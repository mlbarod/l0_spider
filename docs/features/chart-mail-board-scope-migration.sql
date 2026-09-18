-- 기존 Chart Mailing 게시판에만 1회 적용한다. 신규 설치는 chart-mail-board.sql 사용.
-- 운영 담당자가 대상 DB, 백업, ALTER 권한 및 인덱스 길이 지원을 확인한 뒤 실행한다.
-- 애플리케이션 배포 전에 적용하고 backfill_chart_mail_board_scope.py로 기존 값을 채운다.
ALTER TABLE chart_mail_post
    ADD COLUMN line VARCHAR(200) COLLATE utf8mb4_bin NOT NULL DEFAULT '',
    ADD COLUMN sdwt VARCHAR(200) COLLATE utf8mb4_bin NOT NULL DEFAULT '',
    ADD INDEX idx_chart_mail_post_scope (line, sdwt, created_at),
    ADD INDEX idx_chart_mail_post_sdwt (sdwt, created_at);
