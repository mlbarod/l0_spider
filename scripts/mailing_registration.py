import ast
import json
import os
import pickle
import sys


DB_INFO_PATH = os.environ.get("DB_INFO_PATH") or "/appdata/l0_spider/db_info.pkl"
EMAIL_COLUMNS = ("email", "sdwt", "priority")
REQUIRED_EMAIL_COLUMNS = frozenset(EMAIL_COLUMNS)


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


def read_email_column_schema(connection, db_name):
    query = """
        SELECT `COLUMN_NAME`, `DATA_TYPE`, `CHARACTER_MAXIMUM_LENGTH`
        FROM `information_schema`.`COLUMNS`
        WHERE `TABLE_SCHEMA` = %s
          AND `TABLE_NAME` = 'email'
    """
    with connection.cursor() as cursor:
        cursor.execute(query, (db_name,))
        rows = cursor.fetchall()

    schema = {
        row[0]: {
            "dataType": str(row[1]).lower(),
            "maxLength": int(row[2]) if row[2] is not None else None,
        }
        for row in rows
    }
    missing_columns = REQUIRED_EMAIL_COLUMNS.difference(schema)
    if missing_columns:
        missing_text = ", ".join(sorted(missing_columns))
        raise ValueError(f"email 테이블에 필요한 컬럼이 없습니다: {missing_text}")
    return schema


def ensure_text_fits(column_name, value, column_schema):
    max_length = column_schema[column_name]["maxLength"]
    if max_length is not None and len(value) > max_length:
        raise ValueError(
            f"email.{column_name} 컬럼 길이가 부족합니다. "
            f"현재 VARCHAR({max_length}), 필요한 길이 {len(value)}자"
        )


def split_list_for_column(values, max_length, column_name):
    if max_length is None:
        return [values]

    chunks = []
    current = []
    for value in values:
        candidate = [*current, value]
        if len(serialize_list(candidate)) <= max_length:
            current = candidate
            continue
        if not current:
            raise ValueError(
                f"email.{column_name} 컬럼 VARCHAR({max_length})에 값 1개도 저장할 수 없습니다: {value}"
            )
        chunks.append(current)
        current = [value]
        if len(serialize_list(current)) > max_length:
            raise ValueError(
                f"email.{column_name} 컬럼 VARCHAR({max_length})에 값 1개도 저장할 수 없습니다: {value}"
            )

    if current:
        chunks.append(current)
    return chunks


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


def merge_unique_values(*groups):
    merged = []
    seen = set()
    for group in groups:
        for value in group:
            normalized = str(value).strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            merged.append(normalized)
    return merged


def merge_registration_values(payload, existing_rows):
    existing_sdwts = []
    existing_priorities = []
    for raw_sdwt, raw_priority in existing_rows:
        existing_sdwts.extend(parse_list(raw_sdwt))
        existing_priorities.extend(parse_list(raw_priority))
    return {
        "sdwts": merge_unique_values(existing_sdwts, payload["sdwts"]),
        "priorities": merge_unique_values(payload["priorities"], existing_priorities),
    }


def insert_registration(payload, db_info):
    select_query = """
        SELECT `sdwt`, `priority`
        FROM `email`
        WHERE `email` = %s
        FOR UPDATE
    """
    insert_query = """
        INSERT INTO `email` (`email`, `sdwt`, `priority`)
        VALUES (%s, %s, %s)
    """
    update_query = """
        UPDATE `email`
        SET `sdwt` = %s, `priority` = %s
        WHERE `email` = %s
    """
    with connect(db_info) as connection:
        column_schema = read_email_column_schema(connection, db_info["DB_NAME"])
        ensure_text_fits("email", payload["knoxId"], column_schema)
        with connection.cursor() as cursor:
            cursor.execute(select_query, (payload["knoxId"],))
            existing_rows = cursor.fetchall()
            merged = merge_registration_values(payload, existing_rows)
            serialized_sdwts = serialize_list(merged["sdwts"])
            serialized_priorities = serialize_list(merged["priorities"])
            ensure_text_fits("sdwt", serialized_sdwts, column_schema)
            ensure_text_fits("priority", serialized_priorities, column_schema)
            if existing_rows:
                affected_rows = cursor.execute(
                    update_query,
                    (serialized_sdwts, serialized_priorities, payload["knoxId"]),
                )
                operation = "merged"
            else:
                affected_rows = cursor.execute(
                    insert_query,
                    (payload["knoxId"], serialized_sdwts, serialized_priorities),
                )
                operation = "inserted"
        connection.commit()

    return {
        "ok": True,
        "affectedRows": affected_rows,
        "requestedRows": 1,
        "operation": operation,
        "mergedExistingRows": len(existing_rows),
        "storage": {
            "sdwtType": column_schema["sdwt"]["dataType"],
            "sdwtMaxLength": column_schema["sdwt"]["maxLength"],
            "priorityType": column_schema["priority"]["dataType"],
            "priorityMaxLength": column_schema["priority"]["maxLength"],
        },
    }


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


def delete_line_registration(payload, db_info):
    target_sdwts = set(payload["sdwts"])
    select_query = """
        SELECT `email`, `sdwt`, `priority`
        FROM `email`
        WHERE `email` = %s
        FOR UPDATE
    """
    delete_query = """
        DELETE FROM `email`
        WHERE `email` = %s AND `sdwt` = %s AND `priority` = %s
    """
    update_query = """
        UPDATE `email`
        SET `sdwt` = %s
        WHERE `email` = %s AND `sdwt` = %s AND `priority` = %s
    """
    affected_rows = 0
    deleted_rows = 0
    updated_rows = 0

    with connect(db_info) as connection:
        column_schema = read_email_column_schema(connection, db_info["DB_NAME"])
        with connection.cursor() as cursor:
            cursor.execute(select_query, (payload["knoxId"],))
            rows = cursor.fetchall()

            for email_value, raw_sdwt, raw_priority in rows:
                stored_sdwts = parse_list(raw_sdwt)
                if not target_sdwts.intersection(stored_sdwts):
                    continue

                remaining_sdwts = [sdwt for sdwt in stored_sdwts if sdwt not in target_sdwts]
                if remaining_sdwts:
                    serialized_remaining = serialize_list(remaining_sdwts)
                    ensure_text_fits("sdwt", serialized_remaining, column_schema)
                    changed = cursor.execute(
                        update_query,
                        (serialized_remaining, email_value, raw_sdwt, raw_priority),
                    )
                    updated_rows += changed
                    affected_rows += changed
                else:
                    changed = cursor.execute(
                        delete_query,
                        (email_value, raw_sdwt, raw_priority),
                    )
                    deleted_rows += changed
                    affected_rows += changed
        connection.commit()

    return {
        "ok": True,
        "affectedRows": affected_rows,
        "deletedRows": deleted_rows,
        "updatedRows": updated_rows,
        "line": payload["line"],
    }


def database_error_payload(error, action):
    action_label = {"insert": "저장", "list": "조회", "delete_line": "삭제"}.get(action, "처리")
    error_code = error.args[0] if getattr(error, "args", None) and isinstance(error.args[0], int) else None
    detail = str(error)

    if error_code == 1406:
        message = "email 테이블 VARCHAR 컬럼 길이를 초과했습니다. 컬럼 길이를 확인해 주세요."
    elif error_code == 1146:
        message = "email 테이블을 찾지 못했습니다. DB 이름과 테이블명을 확인해 주세요."
    elif error_code == 1054:
        message = "email 테이블 컬럼 구성이 코드와 다릅니다. email, sdwt, priority 컬럼을 확인해 주세요."
    else:
        message = f"Mailing 기준정보 DB {action_label}에 실패했습니다: {detail}"

    return {
        "ok": False,
        "error": message,
        "dbErrorCode": error_code,
        "dbErrorDetail": detail,
    }


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        db_info = load_db_info()
        if action == "insert":
            result = insert_registration(payload, db_info)
        elif action == "list":
            result = list_registrations(payload, db_info)
        elif action == "delete_line":
            result = delete_line_registration(payload, db_info)
        else:
            raise ValueError("지원하지 않는 Mailing DB 작업입니다.")
        write_json(result)
    except Exception as error:
        print(f"mailing registration failed: {error}", file=sys.stderr)
        write_json(database_error_payload(error, action))


if __name__ == "__main__":
    main()
