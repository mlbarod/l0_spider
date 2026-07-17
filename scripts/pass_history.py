import json
import os
import pickle
import sys
from datetime import datetime


DB_INFO_PATH = os.environ.get("DB_INFO_PATH") or "/appdata/l0_spider/db_info.pkl"
PASS_HISTORY_COLUMNS = (
    "line_id",
    "ver",
    "sdwt",
    "desc",
    "recipe_id",
    "update_date",
    "priority",
    "sensor",
    "step",
    "eqp",
    "knox_id",
    "exec_date",
    "comment",
)


def write_json(payload):
    print(json.dumps(payload, ensure_ascii=False, default=str))


def read_payload():
    text = sys.stdin.read()
    return json.loads(text) if text.strip() else {}


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


def connect(db_info):
    import pymysql

    return pymysql.connect(
        host=db_info["DB_HOST"],
        user=db_info["DB_USER"],
        password=db_info["DB_PASSWORD"],
        db=db_info["DB_NAME"],
        charset="utf8",
        port=db_info["DB_PORT"],
    )


def normalize_exec_date(value):
    text = str(value or "").strip()
    if not text:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone().replace(tzinfo=None)
    return parsed.strftime("%Y-%m-%d %H:%M:%S")


def identity_values(payload):
    return (
        payload["lineId"],
        payload["ver"],
        payload["sdwt"],
        payload["desc"],
        payload["recipeId"],
        payload["updateDate"],
        payload["priority"],
        payload["sensor"],
        payload["step"],
        payload["eqp"],
    )


def list_history(connection, payload):
    conditions = ["`line_id` = %s"]
    values = [payload["lineId"]]
    for column in ("sdwt", "desc"):
        value = str(payload.get(column) or "").strip()
        if value:
            conditions.append(f"`{column}` = %s")
            values.append(value)

    columns_sql = ", ".join(f"`{column}`" for column in PASS_HISTORY_COLUMNS)
    sql = f"SELECT {columns_sql} FROM `pass_history` WHERE {' AND '.join(conditions)} ORDER BY `exec_date` DESC"
    with connection.cursor() as cursor:
        cursor.execute(sql, tuple(values))
        rows = cursor.fetchall()

    records = []
    for row in rows:
        records.append(dict(zip(PASS_HISTORY_COLUMNS, row)))
    return {"ok": True, "records": records}


def insert_history(connection, payload):
    exec_date = normalize_exec_date(payload.get("execDate"))
    identity_columns = PASS_HISTORY_COLUMNS[:10]
    identity_conditions = " AND ".join(f"`{column}` = %s" for column in identity_columns)
    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT 1 FROM `pass_history` WHERE {identity_conditions} LIMIT 1",
            identity_values(payload),
        )
        if cursor.fetchone():
            affected_rows = cursor.execute(
                f"UPDATE `pass_history` SET `knox_id` = %s, `exec_date` = %s, `comment` = %s "
                f"WHERE {identity_conditions}",
                (
                    payload["knoxId"],
                    exec_date,
                    str(payload.get("comment") or ""),
                    *identity_values(payload),
                ),
            )
            connection.commit()
            return {
                "ok": True,
                "affectedRows": affected_rows,
                "reactivated": True,
                "execDate": exec_date,
            }

    values = (
        *identity_values(payload),
        payload["knoxId"],
        exec_date,
        str(payload.get("comment") or ""),
    )
    columns_sql = ", ".join(f"`{column}`" for column in PASS_HISTORY_COLUMNS)
    placeholders = ", ".join(["%s"] * len(PASS_HISTORY_COLUMNS))
    with connection.cursor() as cursor:
        cursor.execute(f"INSERT INTO `pass_history` ({columns_sql}) VALUES ({placeholders})", values)
    connection.commit()
    return {"ok": True, "affectedRows": 1, "execDate": exec_date}


def insert_many_history(connection, payload):
    records = payload.get("records") or []
    if not records:
        raise ValueError("일괄 SKIP 대상이 없습니다.")

    identity_columns = PASS_HISTORY_COLUMNS[:10]
    identity_conditions = " AND ".join(f"`{column}` = %s" for column in identity_columns)
    columns_sql = ", ".join(f"`{column}`" for column in PASS_HISTORY_COLUMNS)
    placeholders = ", ".join(["%s"] * len(PASS_HISTORY_COLUMNS))
    affected_rows = 0
    reactivated_rows = 0
    exec_dates = []

    with connection.cursor() as cursor:
        for record in records:
            exec_date = normalize_exec_date(record.get("execDate"))
            exec_dates.append(exec_date)
            cursor.execute(
                f"SELECT 1 FROM `pass_history` WHERE {identity_conditions} LIMIT 1",
                identity_values(record),
            )
            if cursor.fetchone():
                cursor.execute(
                    f"UPDATE `pass_history` SET `knox_id` = %s, `exec_date` = %s, `comment` = %s "
                    f"WHERE {identity_conditions}",
                    (
                        record["knoxId"],
                        exec_date,
                        str(record.get("comment") or ""),
                        *identity_values(record),
                    ),
                )
                reactivated_rows += 1
                continue

            values = (
                *identity_values(record),
                record["knoxId"],
                exec_date,
                str(record.get("comment") or ""),
            )
            cursor.execute(
                f"INSERT INTO `pass_history` ({columns_sql}) VALUES ({placeholders})",
                values,
            )
            affected_rows += 1

    connection.commit()
    return {
        "ok": True,
        "affectedRows": affected_rows,
        "reactivatedRows": reactivated_rows,
        "requestedRows": len(records),
        "execDate": exec_dates[0] if exec_dates else "",
    }


def delete_history(connection, payload):
    identity_columns = PASS_HISTORY_COLUMNS[:10]
    conditions = " AND ".join(f"`{column}` = %s" for column in identity_columns)
    with connection.cursor() as cursor:
        affected_rows = cursor.execute(
            f"DELETE FROM `pass_history` WHERE {conditions}",
            identity_values(payload),
        )
    connection.commit()
    return {"ok": True, "affectedRows": affected_rows}


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        payload = read_payload()
        db_info = load_db_info()
        with connect(db_info) as connection:
            if action == "list":
                result = list_history(connection, payload)
            elif action == "insert":
                result = insert_history(connection, payload)
            elif action == "insert-many":
                result = insert_many_history(connection, payload)
            elif action == "delete":
                result = delete_history(connection, payload)
            else:
                raise ValueError("지원하지 않는 PASS 이력 작업입니다.")
        write_json(result)
    except Exception as error:
        print(f"pass history operation failed: {error}", file=sys.stderr)
        write_json({"ok": False, "error": "PASS 이력 DB 작업에 실패했습니다."})


if __name__ == "__main__":
    main()
