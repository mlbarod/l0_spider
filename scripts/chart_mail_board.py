"""Chart mail snapshots and workflow. No DDL, file image storage or mail transport."""
import base64
import hashlib
import json
import re
import sys
from datetime import datetime, timezone

try:
    from .mailing_registration import load_db_info
except ImportError:
    from mailing_registration import load_db_info


class BoardError(Exception):
    pass


def connect():
    import pymysql
    config = load_db_info()
    return pymysql.connect(
        host=config["DB_HOST"], port=config["DB_PORT"], db=config["DB_NAME"],
        user=config["DB_USER"], password=config["DB_PASSWORD"], charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor, autocommit=False,
        connect_timeout=5, read_timeout=15, write_timeout=15,
        init_command="SET time_zone = '+00:00'",
    )


def timestamp():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def json_date(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    return str(value)


def require_post(cursor, post_id, actor, lock=False):
    cursor.execute("SELECT * FROM chart_mail_post WHERE post_id = %s" + (" FOR UPDATE" if lock else ""), (post_id,))
    post = cursor.fetchone()
    if not post:
        raise BoardError("BOARD_NOT_FOUND")
    cursor.execute("SELECT recipient_knox_id FROM chart_mail_post_recipient WHERE post_id = %s ORDER BY recipient_order", (post_id,))
    recipients = [row["recipient_knox_id"] for row in cursor.fetchall()]
    return post, recipients


def public_post(row):
    return {
        "id": row["post_id"], "title": row["title"], "sender": row["sender_knox_id"],
        "app": row["app"], "workStatus": row["work_status"], "mailState": row["mail_state"],
        "version": row["version"], "createdAt": row["created_at"], "updatedAt": row["updated_at"],
    }


def begin(cursor, payload):
    image = base64.b64decode(payload["imageBase64"], validate=True)
    if not 45 <= len(image) <= 5 * 1024 * 1024 or not image.startswith(b"\x89PNG\r\n\x1a\n"):
        raise BoardError("BOARD_INVALID")
    now = timestamp()
    # A unique primary key and this row lock serialize the same send request across processes.
    cursor.execute("""INSERT INTO chart_mail_post
        (post_id, fingerprint, sender_knox_id, title, details, comment, chart_url, app,
         work_status, version, mail_state, diagnostics, created_at, updated_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'IN_PROGRESS',1,'pending',%s,%s,%s)
        ON DUPLICATE KEY UPDATE post_id = post_id""", (
        payload["id"], payload["fingerprint"], payload["actor"], payload["title"],
        payload["details"], payload["comment"], payload["chartUrl"], payload["app"],
        json.dumps(payload["diagnostics"]), now, now,
    ))
    created = cursor.rowcount == 1
    cursor.execute("SELECT fingerprint, mail_state, diagnostics FROM chart_mail_post WHERE post_id = %s FOR UPDATE", (payload["id"],))
    row = cursor.fetchone()
    if row["fingerprint"] != payload["fingerprint"]:
        raise BoardError("MAIL_REQUEST_CONFLICT")
    if not created:
        return {"created": False, "state": row["mail_state"], "diagnostics": json.loads(row["diagnostics"])}
    for index, recipient in enumerate(payload["recipients"]):
        cursor.execute("INSERT INTO chart_mail_post_recipient (post_id, recipient_knox_id, recipient_order) VALUES (%s,%s,%s)", (payload["id"], recipient, index))
    cursor.execute("INSERT INTO chart_mail_post_image (post_id, image_png, byte_size, image_sha256) VALUES (%s,%s,%s,%s)",
                   (payload["id"], image, len(image), hashlib.sha256(image).hexdigest()))
    return {"created": True}


def execute_action(connection, action, payload):
    actor = payload.get("actor")
    if not isinstance(actor, str) or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,127}", actor):
        raise BoardError("BOARD_INVALID")
    if action != "list" and not re.fullmatch(r"[a-f0-9]{64}", str(payload.get("id", ""))):
        raise BoardError("BOARD_INVALID")
    with connection.cursor() as cursor:
        if action == "begin":
            result = begin(cursor, payload)
        elif action == "finish":
            if payload["state"] not in ("accepted", "rejected", "unknown"):
                raise BoardError("BOARD_INVALID")
            cursor.execute("""UPDATE chart_mail_post SET mail_state = %s, diagnostics = %s, mail_updated_at = %s
                WHERE post_id = %s AND sender_knox_id = %s AND mail_state = 'pending'""",
                (payload["state"], json.dumps(payload["diagnostics"]), timestamp(), payload["id"], actor))
            if cursor.rowcount != 1:
                raise BoardError("BOARD_CONFLICT")
            result = {}
        elif action == "list":
            page = payload["page"]
            if not isinstance(page, int) or not 1 <= page <= 100000 or payload["status"] not in ("", "IN_PROGRESS", "COMPLETED") or len(payload["search"]) > 200:
                raise BoardError("BOARD_INVALID")
            where = "1 = 1"
            params = []
            if payload["status"]:
                where += " AND p.work_status = %s"
                params.append(payload["status"])
            if payload["search"]:
                where += " AND (LOCATE(%s, p.title) > 0 OR LOCATE(%s, p.sender_knox_id) > 0 OR LOCATE(%s, p.details) > 0)"
                params.extend([payload["search"]] * 3)
            cursor.execute("SELECT COUNT(*) AS total FROM chart_mail_post p WHERE " + where, tuple(params))
            total = cursor.fetchone()["total"]
            cursor.execute("""SELECT p.post_id, p.title, p.sender_knox_id, p.app, p.work_status,
                p.mail_state, p.version, p.created_at, p.updated_at FROM chart_mail_post p WHERE """ + where
                + " ORDER BY p.created_at DESC, p.post_id DESC LIMIT 20 OFFSET %s", tuple(params + [(page - 1) * 20]))
            result = {"posts": [public_post(row) for row in cursor.fetchall()], "total": total, "page": page, "pageSize": 20}
        elif action in ("detail", "image", "status"):
            post, recipients = require_post(cursor, payload["id"], actor, lock=action == "status")
            if action == "image":
                cursor.execute("SELECT image_png FROM chart_mail_post_image WHERE post_id = %s", (payload["id"],))
                image_row = cursor.fetchone()
                if not image_row:
                    raise BoardError("BOARD_NOT_FOUND")
                result = {"imageBase64": base64.b64encode(image_row["image_png"]).decode("ascii")}
            elif action == "status":
                status, version = payload["status"], payload["version"]
                comment = payload["comment"]
                if status not in ("IN_PROGRESS", "COMPLETED") or type(version) is not int or version < 1 or not isinstance(comment, str) or len(comment) > 1000:
                    raise BoardError("BOARD_INVALID")
                if post["version"] != version:
                    raise BoardError("BOARD_CONFLICT")
                if post["work_status"] != status:
                    now = timestamp()
                    cursor.execute("INSERT INTO chart_mail_post_history (post_id, previous_status, next_status, changed_by, comment, changed_at) VALUES (%s,%s,%s,%s,%s,%s)",
                                   (payload["id"], post["work_status"], status, actor, comment, now))
                    cursor.execute("UPDATE chart_mail_post SET work_status = %s, version = version + 1, updated_at = %s WHERE post_id = %s", (status, now, payload["id"]))
                result = {}
            else:
                cursor.execute("SELECT previous_status, next_status, changed_by, comment, changed_at FROM chart_mail_post_history WHERE post_id = %s ORDER BY history_id DESC LIMIT 100", (payload["id"],))
                history = [{"from": row["previous_status"], "to": row["next_status"], "changedBy": row["changed_by"], "comment": row["comment"], "changedAt": row["changed_at"]} for row in cursor.fetchall()]
                result = {"post": {**public_post(post), "details": post["details"], "comment": post["comment"],
                          "chartUrl": post["chart_url"], "recipients": recipients, "canChangeStatus": True,
                          "mailUpdatedAt": post["mail_updated_at"], "diagnostics": json.loads(post["diagnostics"]), "history": history}}
        else:
            raise BoardError("BOARD_INVALID")
    connection.commit()
    return {"ok": True, **result}


def main():
    try:
        payload = json.load(sys.stdin)
        with connect() as connection:
            try:
                result = execute_action(connection, sys.argv[1], payload)
            except Exception:
                connection.rollback()
                raise
        print(json.dumps(result, ensure_ascii=False, default=json_date))
    except BoardError as error:
        print(json.dumps({"ok": False, "code": str(error)}))
    except Exception:
        # Never expose DB credentials, images, recipients, SQL or driver errors.
        print(json.dumps({"ok": False, "code": "BOARD_STORAGE_ERROR"}))


if __name__ == "__main__":
    main()
