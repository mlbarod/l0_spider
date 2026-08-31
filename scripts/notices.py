import json
import os
import pickle
import sys


DB_INFO_PATH = os.environ.get("DB_INFO_PATH") or "/appdata/l0_spider/db_info.pkl"


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
        charset="utf8mb4",
        port=db_info["DB_PORT"],
        cursorclass=pymysql.cursors.DictCursor,
    )


def serialize_notice(row):
    if not row:
        return None
    return {
        "noticeId": row.get("notice_id"),
        "title": row.get("title"),
        "body": row.get("body"),
        "status": row.get("status"),
        "createdBy": row.get("created_by"),
        "createdAt": row.get("created_at"),
        "updatedBy": row.get("updated_by"),
        "updatedAt": row.get("updated_at"),
        "completedBy": row.get("completed_by"),
        "completedAt": row.get("completed_at"),
    }


def list_notices(connection, active_only):
    where_clause = "WHERE status = 'ACTIVE'" if active_only else ""
    order_clause = "ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, created_at DESC"
    limit = 50 if active_only else 200
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT notice_id, title, body, status,
                   created_by, created_at, updated_by, updated_at,
                   completed_by, completed_at
            FROM site_notices
            {where_clause}
            {order_clause}
            LIMIT {limit}
            """
        )
        return [serialize_notice(row) for row in cursor.fetchall()]


def create_notice(connection, payload):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO site_notices
                (title, body, status, created_by, created_at, updated_by, updated_at,
                 completed_by, completed_at)
            VALUES (%s, %s, 'ACTIVE', %s, NOW(), %s, NOW(), NULL, NULL)
            """,
            (payload["title"], payload["body"], payload["createdBy"], payload["createdBy"]),
        )
        notice_id = cursor.lastrowid
        cursor.execute(
            """
            SELECT notice_id, title, body, status,
                   created_by, created_at, updated_by, updated_at,
                   completed_by, completed_at
            FROM site_notices
            WHERE notice_id = %s
            """,
            (notice_id,),
        )
        notice = serialize_notice(cursor.fetchone())
    connection.commit()
    return notice


def complete_notice(connection, payload):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE site_notices
            SET status = 'COMPLETED',
                updated_by = %s,
                updated_at = NOW(),
                completed_by = %s,
                completed_at = NOW()
            WHERE notice_id = %s AND status = 'ACTIVE'
            """,
            (payload["completedBy"], payload["completedBy"], payload["noticeId"]),
        )
        affected_rows = cursor.rowcount
    connection.commit()
    return affected_rows


def main():
    try:
        payload = read_payload()
        action = str(payload.get("action") or "").strip()
        db_info = load_db_info()
        with connect(db_info) as connection:
            if action == "list-active":
                result = {"ok": True, "notices": list_notices(connection, True)}
            elif action == "list-all":
                result = {"ok": True, "notices": list_notices(connection, False)}
            elif action == "create":
                result = {"ok": True, "notice": create_notice(connection, payload)}
            elif action == "complete":
                result = {"ok": True, "affectedRows": complete_notice(connection, payload)}
            else:
                raise ValueError("unsupported notice action")
        write_json(result)
    except Exception as error:
        print(f"notice operation failed: {error}", file=sys.stderr)
        write_json({"ok": False, "error": "공지사항 DB 작업에 실패했습니다."})


if __name__ == "__main__":
    main()
