import json
import os
import pickle
import sys


DB_INFO_PATH = os.environ.get("DB_INFO_PATH") or "/appdata/l0_spider/db_info.pkl"
MY_EQP_COLUMNS = (
    "line",
    "sdwt",
    "prc_group",
    "eqp",
    "exec_date",
    "periode",
    "comment",
    "knox_id",
)


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


def list_registrations(payload, db_info):
    import pymysql

    conditions = ["`line` = %s", "`knox_id` = %s"]
    values = [payload["line"], payload["knoxId"]]
    if payload.get("activeOnly"):
        conditions.append("TIMESTAMPADD(DAY, `periode`, `exec_date`) > NOW()")
    columns_sql = ", ".join(f"`{column}`" for column in MY_EQP_COLUMNS)
    query = (
        f"SELECT {columns_sql} FROM `myeqp_regist` "
        f"WHERE {' AND '.join(conditions)} "
        "ORDER BY `exec_date` DESC, `sdwt`, `prc_group`, `eqp`"
    )

    with pymysql.connect(
        host=db_info["DB_HOST"],
        user=db_info["DB_USER"],
        password=db_info["DB_PASSWORD"],
        db=db_info["DB_NAME"],
        charset="utf8",
        port=db_info["DB_PORT"],
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, tuple(values))
            rows = cursor.fetchall()

    return {
        "ok": True,
        "records": [dict(zip(MY_EQP_COLUMNS, row)) for row in rows],
    }


def delete_registration(payload, db_info):
    import pymysql

    eqps = payload["eqps"]
    eqp_placeholders = ", ".join(["%s"] * len(eqps))
    query = f"""
        DELETE FROM `myeqp_regist`
        WHERE `line` = %s
          AND `sdwt` = %s
          AND `prc_group` = %s
          AND `exec_date` = %s
          AND `periode` = %s
          AND `comment` = %s
          AND `knox_id` = %s
          AND `eqp` IN ({eqp_placeholders})
    """
    values = (
        payload["line"],
        payload["sdwt"],
        payload["prcGroup"],
        payload["execDate"],
        payload["periode"],
        payload["comment"],
        payload["knoxId"],
        *eqps,
    )

    with pymysql.connect(
        host=db_info["DB_HOST"],
        user=db_info["DB_USER"],
        password=db_info["DB_PASSWORD"],
        db=db_info["DB_NAME"],
        charset="utf8",
        port=db_info["DB_PORT"],
    ) as connection:
        with connection.cursor() as cursor:
            affected_rows = cursor.execute(query, values)
        connection.commit()

    return {"ok": True, "affectedRows": affected_rows}


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        db_info = load_db_info()
        if action == "insert":
            result = insert_registration(payload, db_info)
        elif action == "list":
            result = list_registrations(payload, db_info)
        elif action == "delete":
            result = delete_registration(payload, db_info)
        else:
            raise ValueError("지원하지 않는 My EQP DB 작업입니다.")
        write_json(result)
    except Exception as error:
        print(f"my eqp registration failed: {error}", file=sys.stderr)
        action_label = {"insert": "저장", "list": "조회", "delete": "삭제"}.get(action, "처리")
        write_json({"ok": False, "error": f"My EQP 기준정보 DB {action_label}에 실패했습니다."})


if __name__ == "__main__":
    main()
