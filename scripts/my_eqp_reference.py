import json
import os
import pickle
import sys


DB_INFO_PATH = os.environ.get("DB_INFO_PATH") or "/appdata/l0_spider/db_info.pkl"


def write_json(payload):
    print(json.dumps(payload, ensure_ascii=False, default=str))


def load_db_info():
    with open(DB_INFO_PATH, "rb") as file:
        db_info = pickle.load(file)

    return {
        "DB_HOST": db_info["DB_HOST"],
        "DB_PORT": int(db_info["DB_PORT"]),
        "DB_NAME": db_info["DB_NAME"],
        "DB_USER": db_info["DB_USER"],
        "DB_PASSWORD": db_info["DB_PASSWORD"],
    }


def read_reference_rows(db_info):
    import pymysql

    query = """
        SELECT DISTINCT `main`, `disp_name`, `sdwt_prod`, `prc_group`
        FROM `erdtsum_info`
        ORDER BY `sdwt_prod`, `prc_group`, `main`, `disp_name`
    """

    with pymysql.connect(
        host=db_info["DB_HOST"],
        user=db_info["DB_USER"],
        password=db_info["DB_PASSWORD"],
        db=db_info["DB_NAME"],
        charset="utf8",
        port=db_info["DB_PORT"],
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()

    return [
        {
            "main": str(row[0] or "").strip(),
            "disp_name": str(row[1] or "").strip(),
            "sdwt_prod": str(row[2] or "").strip(),
            "prc_group": str(row[3] or "").strip(),
        }
        for row in rows
    ]


def main():
    try:
        rows = read_reference_rows(load_db_info())
    except Exception as error:
        print(f"my eqp reference lookup failed: {error}", file=sys.stderr)
        write_json({
            "ok": False,
            "code": "LOOKUP_FAILED",
            "error": "erdtsum_info 기준정보를 조회하지 못했습니다.",
        })
        return

    write_json({"ok": True, "rows": rows})


if __name__ == "__main__":
    main()
