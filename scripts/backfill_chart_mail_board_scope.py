"""Fill missing board scope from saved links after the additive schema migration."""
import argparse
import sys

try:
    from .chart_mail_board import chart_scope, connect
except ImportError:
    from chart_mail_board import chart_scope, connect


def backfill(connection):
    last_id = ""
    updated = 0
    while True:
        with connection.cursor() as cursor:
            cursor.execute("SELECT post_id, chart_url, line, sdwt FROM chart_mail_post "
                           "WHERE post_id > %s AND (line = '' OR sdwt = '') ORDER BY post_id LIMIT 200", (last_id,))
            rows = cursor.fetchall()
            if not rows:
                break
            for row in rows:
                scope = chart_scope(row["chart_url"])
                if not any(not row[key] and scope[key] for key in ("line", "sdwt")):
                    continue
                # Retry-safe and does not overwrite a classification already stored.
                cursor.execute("UPDATE chart_mail_post SET line = CASE WHEN line = '' THEN %s ELSE line END, "
                               "sdwt = CASE WHEN sdwt = '' THEN %s ELSE sdwt END WHERE post_id = %s",
                               (scope["line"], scope["sdwt"], row["post_id"]))
                updated += cursor.rowcount
            last_id = rows[-1]["post_id"]
        connection.commit()
    return updated


def main(argv=None):
    parser = argparse.ArgumentParser(description="기존 차트 링크에서 게시글 라인·SDWT 채우기")
    parser.add_argument("--apply", action="store_true", help="DB_INFO_PATH의 DB에 실제 반영")
    args = parser.parse_args(argv)
    if not args.apply:
        print("DB에 접속하지 않습니다. 먼저 chart-mail-board-scope-migration.sql을 적용한 뒤 --apply로 실행하세요.\n"
              "기존 chart_url의 line·sdwt를 읽어 빈 항목만 200건 단위로 채웁니다. 재실행할 수 있습니다.\n"
              "링크에 없는 값은 빈값(미지정)으로 유지하며 본문·이미지·상태·변경 시각은 수정하지 않습니다.")
        return 0
    try:
        with connect() as connection:
            try:
                updated = backfill(connection)
            except Exception:
                connection.rollback()
                raise
        print(f"라인·SDWT 보완 완료: {updated}건")
        return 0
    except Exception:
        print("보완에 실패했습니다. DB 설정·권한과 line·sdwt 컬럼을 확인해 주세요. "
              "완료한 묶음은 유지되며 원인 해결 후 재실행할 수 있습니다.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
