"""Chart Mailing group storage. Uses the existing Spider DB configuration; no DDL."""

import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from uuid import uuid4

try:
    from .mailing_registration import load_db_info
except ImportError:
    from mailing_registration import load_db_info


class GroupInputError(Exception):
    pass


def connect(db_info):
    import pymysql

    return pymysql.connect(
        host=db_info["DB_HOST"], port=db_info["DB_PORT"],
        user=db_info["DB_USER"], password=db_info["DB_PASSWORD"],
        db=db_info["DB_NAME"], charset="utf8mb4", autocommit=False,
        connect_timeout=5, read_timeout=10, write_timeout=10,
        init_command="SET time_zone = '+00:00'",
    )


def validate(action, payload):
    if not isinstance(payload, dict):
        raise GroupInputError("INVALID_GROUP")
    owner = payload.get("owner")
    if not isinstance(owner, str) or not owner or len(owner) > 128 or owner != owner.strip().lower():
        raise GroupInputError("INVALID_GROUP")
    if action not in ("list", "save", "delete"):
        raise GroupInputError("INVALID_GROUP")
    group_id = payload.get("id")
    if (group_id is not None and (not isinstance(group_id, str) or not re.fullmatch(r"[0-9a-f-]{36}", group_id))) or (action == "delete" and not group_id):
        raise GroupInputError("INVALID_GROUP")
    if action != "save":
        return
    name, key, recipients = payload.get("name"), payload.get("nameKey"), payload.get("recipients")
    if not isinstance(name, str) or not 1 <= len(name) <= 80 or name != name.strip() or any(ord(c) < 32 or ord(c) == 127 for c in name):
        raise GroupInputError("INVALID_GROUP")
    if not isinstance(key, str) or not 1 <= len(key) <= 160 or key != name.lower():
        raise GroupInputError("INVALID_GROUP")
    if not isinstance(recipients, list) or not 1 <= len(recipients) <= 100:
        raise GroupInputError("INVALID_GROUP")
    if any(not isinstance(r, str) or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,127}", r) for r in recipients) or len(set(recipients)) != len(recipients):
        raise GroupInputError("INVALID_GROUP")


def iso_time(value):
    return value.replace(tzinfo=timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def list_groups(cursor, owner):
    cursor.execute("""
        SELECT g.group_id, g.group_name, g.updated_at, m.recipient_knox_id
        FROM chart_mail_recipient_group AS g
        LEFT JOIN chart_mail_recipient_group_member AS m ON m.group_id = g.group_id
        WHERE g.owner_knox_id = %s
        ORDER BY g.created_at, g.group_id, m.recipient_order
    """, (owner,))
    groups = {}
    for group_id, name, updated_at, recipient in cursor.fetchall():
        group = groups.setdefault(group_id, {
            "id": group_id, "name": name, "updatedAt": iso_time(updated_at), "recipients": [],
        })
        if recipient is not None:
            group["recipients"].append(recipient)
    return {"ok": True, "groups": list(groups.values())}


def save_group(cursor, payload):
    owner, group_id = payload["owner"], payload.get("id")
    if group_id:
        cursor.execute("""
            SELECT group_id FROM chart_mail_recipient_group
            WHERE group_id = %s AND owner_knox_id = %s FOR UPDATE
        """, (group_id, owner))
        if cursor.fetchone() is None:
            raise GroupInputError("GROUP_NOT_FOUND")
    cursor.execute("""
        SELECT group_id FROM chart_mail_recipient_group
        WHERE owner_knox_id = %s AND group_name_key = %s
    """, (owner, payload["nameKey"]))
    duplicate = cursor.fetchone()
    if duplicate and duplicate[0] != group_id:
        raise GroupInputError("DUPLICATE_GROUP")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    now = now.replace(microsecond=(now.microsecond // 1000) * 1000)
    if group_id:
        cursor.execute("""
            UPDATE chart_mail_recipient_group SET group_name = %s, group_name_key = %s, updated_at = %s
            WHERE group_id = %s AND owner_knox_id = %s
        """, (payload["name"], payload["nameKey"], now, group_id, owner))
        cursor.execute("DELETE FROM chart_mail_recipient_group_member WHERE group_id = %s", (group_id,))
    else:
        cursor.execute("SELECT COUNT(*) FROM chart_mail_recipient_group WHERE owner_knox_id = %s", (owner,))
        if cursor.fetchone()[0] >= 50:
            raise GroupInputError("GROUP_LIMIT")
        group_id = str(uuid4())
        cursor.execute("""
            INSERT INTO chart_mail_recipient_group
                (group_id, owner_knox_id, group_name, group_name_key, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (group_id, owner, payload["name"], payload["nameKey"], now, now))
    cursor.executemany("""
        INSERT INTO chart_mail_recipient_group_member (group_id, recipient_order, recipient_knox_id)
        VALUES (%s, %s, %s)
    """, [(group_id, index, recipient) for index, recipient in enumerate(payload["recipients"], 1)])
    return {"ok": True, "group": {
        "id": group_id, "name": payload["name"], "recipients": payload["recipients"], "updatedAt": iso_time(now),
    }}


def delete_group(cursor, payload):
    # The existing FK deletes members with the parent in the same transaction.
    count = cursor.execute("DELETE FROM chart_mail_recipient_group WHERE group_id = %s AND owner_knox_id = %s",
                           (payload["id"], payload["owner"]))
    if count != 1:
        raise GroupInputError("DELETE_NOT_FOUND")
    return {"ok": True}


def handle(action, payload, db_info, connector=connect):
    validate(action, payload)
    connection = connector(db_info)
    try:
        with connection.cursor() as cursor:
            if action == "list":
                return list_groups(cursor, payload["owner"])
            # Serialize this owner's writes across Node/Python processes, including
            # the first insert when there is no parent row to lock yet. The lock
            # is held until the dedicated connection closes, after commit/rollback.
            lock_key = hashlib.sha256((db_info["DB_NAME"] + "\0" + payload["owner"]).encode()).hexdigest()
            cursor.execute("SELECT GET_LOCK(%s, 5)", (lock_key,))
            if cursor.fetchone()[0] != 1:
                raise RuntimeError("GROUP_LOCK_UNAVAILABLE")
            connection.begin()
            result = save_group(cursor, payload) if action == "save" else delete_group(cursor, payload)
            connection.commit()
            return result
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main():
    try:
        payload = json.load(sys.stdin)
        action = sys.argv[1] if len(sys.argv) == 2 else ""
        validate(action, payload)
        result = handle(action, payload, load_db_info())
    except GroupInputError as error:
        result = {"ok": False, "code": str(error)}
    except Exception:
        # Never emit connection details, SQL, names or recipients to subprocess output.
        result = {"ok": False, "code": "MAIL_GROUP_STORAGE_ERROR"}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
