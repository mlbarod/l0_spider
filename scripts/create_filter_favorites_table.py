"""즐겨찾기 테이블 생성. 실행: python3 scripts/create_filter_favorites_table.py"""
import argparse
from pathlib import Path
import re
import sys


SQL_PATH = Path(__file__).resolve().parents[1] / "docs/features/anomaly-filter-favorites.sql"
TABLE_NAME = "anomaly_filter_favorite_items"


def read_statement():
    # 주석으로 남겨 둔 이전 테이블의 데이터 이관 쿼리는 실행하지 않습니다.
    sql = "\n".join(
        line for line in SQL_PATH.read_text(encoding="utf-8").splitlines()
        if not line.lstrip().startswith("--")
    )
    statements = [part.strip() for part in sql.split(";") if part.strip()]
    if len(statements) != 1 or not re.match(
        rf"CREATE TABLE IF NOT EXISTS {TABLE_NAME}\s*\(", statements[0]
    ):
        raise ValueError("Unexpected table creation SQL")
    return statements[0]


def connect():
    import pymysql
    try:
        from .mailing_registration import load_db_info
    except ImportError:
        from mailing_registration import load_db_info
    config = load_db_info()
    return pymysql.connect(
        host=config["DB_HOST"], port=config["DB_PORT"], database=config["DB_NAME"],
        user=config["DB_USER"], password=config["DB_PASSWORD"], charset="utf8mb4",
        autocommit=True, connect_timeout=5, read_timeout=30, write_timeout=30,
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="DB 연결 없이 생성 SQL만 표시")
    args = parser.parse_args(argv)
    try:
        statement = read_statement()
        if args.dry_run:
            print(statement + ";")
            return 0
        with connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(statement)
        print(f"테이블 생성 명령 완료: {TABLE_NAME} (이미 존재하면 기존 테이블과 데이터를 유지합니다).")
        return 0
    except Exception:
        # DB 드라이버 오류에 포함될 수 있는 접속 정보는 출력하지 않습니다.
        print("테이블 생성에 실패했습니다. pymysql 설치, DB_INFO_PATH 설정, DB 연결 및 CREATE 권한을 확인해 주세요.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
