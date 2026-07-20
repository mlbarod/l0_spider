import ast
import json
import os
import pickle
import sys


DB_INFO_PATH = os.environ.get("DB_INFO_PATH") or "/appdata/l0_spider/db_info.pkl"
EMAIL_COLUMNS = ("email", "sdwt", "priority")


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


def serialize_list(values):
    return json.dumps(values, ensure_ascii=False, separators=(",", ":"))


def parse_list(value):
    if isinstance(value, list):
        return value
    if value is None:
        return []

    text = str(value).strip()
    if not text:
        return []

    for parser in (json.loads, ast.literal_eval):
        try:
            parsed = parser(text)
            if isinstance(parsed, (list, tuple)):
                return [str(item) for item in parsed]
        except (ValueError, SyntaxError, TypeError, json.JSONDecodeError):
            pass

    return [item.strip() for item in text.split(",") if item.strip()]


def insert_registration(payload, db_info):
    query = """
        INSERT INTO `email` (`email`, `sdwt`, `priority`)
        VALUES (%s, %s, %s)
    """
    values = (
        payload["knoxId"],
        serialize_list(payload["sdwts"]),
        serialize_list(payload["priorities"]),
    )

    with connect(db_info) as connection:
        with connection.cursor() as cursor:
            affected_rows = cursor.execute(query, values)
        connection.commit()

    return {"ok": True, "affectedRows": affected_rows}


def list_registrations(payload, db_info):
    query = """
        SELECT `email`, `sdwt`, `priority`
        FROM `email`
        WHERE `email` = %s
    """

    with connect(db_info) as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (payload["knoxId"],))
            rows = cursor.fetchall()

    records = []
    for row in rows:
        record = dict(zip(EMAIL_COLUMNS, row))
        record["sdwt"] = parse_list(record["sdwt"])
        record["priority"] = parse_list(record["priority"])
        records.append(record)

    return {"ok": True, "records": records}


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        db_info = load_db_info()
        if action == "insert":
            result = insert_registration(payload, db_info)
        elif action == "list":
            result = list_registrations(payload, db_info)
        else:
            raise ValueError("지원하지 않는 Mailing DB 작업입니다.")
        write_json(result)
    except Exception as error:
        print(f"mailing registration failed: {error}", file=sys.stderr)
        action_label = {"insert": "저장", "list": "조회"}.get(action, "처리")
        write_json({"ok": False, "error": f"Mailing 기준정보 DB {action_label}에 실패했습니다."})


if __name__ == "__main__":
    main()
