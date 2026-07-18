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


def insert_registration(payload, db_info):
    import pymysql

    eqps = payload["eqps"]
    values = [
        (
            payload["line"],
            payload["sdwt"],
            payload["prcGroup"],
            eqp,
            payload["execDate"],
            payload["periode"],
            payload["comment"],
            payload["knoxId"],
        )
        for eqp in eqps
    ]
    query = """
        INSERT INTO `myeqp_regist`
            (`line`, `sdwt`, `prc_group`, `eqp`, `exec_date`, `periode`, `comment`, `knox_id`)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
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
            affected_rows = cursor.executemany(query, values)
        connection.commit()

    return {
        "ok": True,
        "affectedRows": affected_rows,
        "requestedRows": len(values),
    }


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        result = insert_registration(payload, load_db_info())
        write_json(result)
    except Exception as error:
        print(f"my eqp registration failed: {error}", file=sys.stderr)
        write_json({"ok": False, "error": "My EQP 기준정보 DB 저장에 실패했습니다."})


if __name__ == "__main__":
    main()
