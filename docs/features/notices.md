# 공지사항

## 동작

- `ACTIVE` 공지가 1건 이상이면 사이트 최초 접속 시 공지 팝업을 자동으로 연다.
- 우측 상단 공지 아이콘은 모든 화면에 표시하며 진행중 공지만 조회한다.
- 메인 화면의 공지 등록 버튼은 현재 `knoxId`가 서버 환경변수 `NOTICE_ADMIN_KNOX_IDS`의 쉼표 구분 목록에 포함될 때만 표시한다.
- 서버는 저장소 root의 `notices.env`에서 공지 관리자 환경변수를 읽으며, 이 파일은 Git에 기록하지 않는다.
- 등록·전체 목록 조회·완료 처리는 서버에서도 동일한 관리자 권한을 다시 검사한다.
- 완료 처리는 row를 삭제하지 않고 `status`를 `COMPLETED`로 변경한다.

## API

| Method | Path | 권한 | 설명 |
|---|---|---|---|
| `GET` | `/api/notices` | 전체 | `ACTIVE` 공지와 `permissions.canManage` 조회 |
| `GET` | `/api/notices/permissions` | 전체 | DB 조회와 독립적으로 공지 관리 권한 조회 |
| `GET` | `/api/notices/manage` | 관리자 | 완료 건을 포함한 최근 공지 조회 |
| `POST` | `/api/notices` | 관리자 | 제목과 본문으로 `ACTIVE` 공지 등록 |
| `PATCH` | `/api/notices` | 관리자 | `noticeId`에 해당하는 `ACTIVE` 공지 완료 처리 |

## DB 계약

기존 DB의 `site_notices` 테이블을 사용한다. 애플리케이션 실행 중 DDL은 수행하지 않는다.

```sql
CREATE TABLE `site_notices` (
    `notice_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `body` TEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `created_by` VARCHAR(128) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_by` VARCHAR(128) NOT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `completed_by` VARCHAR(128) NULL,
    `completed_at` DATETIME NULL,
    PRIMARY KEY (`notice_id`),
    KEY `idx_site_notices_status_created_at` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

| Column | 요구사항 |
|---|---|
| `notice_id` | 양의 정수 PK, auto increment |
| `title` | 공지 제목, 최대 200자 |
| `body` | 공지 본문, 최대 10,000자 |
| `status` | `ACTIVE` 또는 `COMPLETED` |
| `created_by`, `updated_by` | 처리한 `knoxId` |
| `created_at`, `updated_at` | DB에서 `NOW()`로 기록 가능한 일시형 |
| `completed_by`, `completed_at` | 완료 전 `NULL`, 완료 시 처리자와 일시 |

일반 조회는 `status = 'ACTIVE'` 조건과 `created_at DESC` 순서를 사용한다. 관리 조회는 진행중 공지를 먼저 표시하며 최대 200건을 반환한다.
