"""Preview or explicitly apply the checked-in Chart Mailing board schema."""
import argparse
from pathlib import Path
import re
import sys


SQL_PATH = Path(__file__).resolve().parents[1] / "docs/features/chart-mail-board.sql"
TABLES = (
    "chart_mail_post",
    "chart_mail_post_recipient",
    "chart_mail_post_image",
    "chart_mail_post_history",
)


class SetupError(Exception):
    pass


def read_statements():
    # This repository SQL contains only CREATE TABLE statements and line comments.
    sql = "\n".join(line for line in SQL_PATH.read_text(encoding="utf-8").splitlines()
                    if not line.lstrip().startswith("--"))
    statements = [part.strip() for part in sql.split(";") if part.strip()]
    names = [re.match(r"CREATE TABLE ([a-z_]+)\s*\(", statement) for statement in statements]
    if tuple(match.group(1) if match else None for match in names) != TABLES:
        raise SetupError("테이블 생성 SQL의 구성과 순서를 확인해 주세요.")
    return statements


def connect():
    import pymysql
    try:
        from .mailing_registration import load_db_info
    except ImportError:
        from mailing_registration import load_db_info
    config = load_db_info()
    return pymysql.connect(
        host=config["DB_HOST"], port=config["DB_PORT"], db=config["DB_NAME"],
        user=config["DB_USER"], password=config["DB_PASSWORD"], charset="utf8mb4",
        autocommit=True, connect_timeout=5, read_timeout=30, write_timeout=30,
    )


def create_tables(connection, statements):
    with connection.cursor() as cursor:
        placeholders = ", ".join(["%s"] * len(TABLES))
        cursor.execute(
            "SELECT TABLE_NAME FROM information_schema.TABLES "
            f"WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ({placeholders})", TABLES)
        if cursor.fetchall():
            raise SetupError("대상 테이블이 이미 존재합니다. 기존 구조를 확인해 주세요. 변경하지 않았습니다.")
        for name, statement in zip(TABLES, statements):
            cursor.execute(statement)
            print(f"생성 완료: {name}", flush=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Chart Mailing 게시판 테이블 4개 생성 (MySQL)")
    parser.add_argument("--apply", action="store_true", help="DB_INFO_PATH의 DB에 실제로 테이블 생성")
    args = parser.parse_args(argv)
    try:
        statements = read_statements()
        if not args.apply:
            print("SQL 미리보기입니다. DB에 접속하지 않습니다. 실제 생성: --apply\n")
            print(";\n\n".join(statements) + ";")
            return 0
        with connect() as connection:
            create_tables(connection, statements)
        print("게시판 테이블 4개를 생성했습니다.")
        return 0
    except SetupError as error:
        print(str(error), file=sys.stderr)
    except Exception:
        # Do not print connection details or raw driver errors.
        print("테이블 생성에 실패했습니다. DB 설정·권한·버전과 테이블 존재 여부를 확인해 주세요. "
              "이미 생성된 테이블은 유지됩니다(MySQL DDL은 전체 롤백되지 않습니다).", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
