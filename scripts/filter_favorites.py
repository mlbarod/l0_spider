"""Personal anomaly filter defaults. Schema creation is deliberately manual."""
import json
import sys
from mailing_registration import connect, load_db_info


def process(connection, action, payload):
    with connection.cursor() as cursor:
        if action == "save":
            values = (payload["knoxId"], payload["field"], payload["line"], payload.get("sdwt") or "")
            if payload.get("selected", True):
                cursor.execute("""
                    INSERT INTO anomaly_filter_favorite_items (knox_id, filter_type, line_name, sdwt)
                    VALUES (%s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE id = id
                """, values)
            else:
                cursor.execute("""
                    DELETE FROM anomaly_filter_favorite_items
                    WHERE knox_id = %s AND filter_type = %s AND line_name = %s AND sdwt = %s
                """, values)
            connection.commit()
        elif action != "get":
            raise ValueError("Unsupported action")
        cursor.execute("""
            SELECT filter_type, line_name, sdwt FROM anomaly_filter_favorite_items
            WHERE knox_id = %s ORDER BY id
        """, (payload["knoxId"],))
        rows = cursor.fetchall()
    favorites = {"lines": [], "sdwts": []}
    for field, line, sdwt in rows:
        if field == "line":
            favorites["lines"].append(line)
        elif field == "sdwt":
            favorites["sdwts"].append({"line": line, "sdwt": sdwt})
    # Keep the former response field for older browser clients.
    line = next(iter(favorites["lines"]), None) or next((item["line"] for item in favorites["sdwts"]), None)
    favorite = {"line": line, "sdwt": next((item["sdwt"] for item in favorites["sdwts"] if item["line"] == line), None)} if line else None
    return {"ok": True, "favorites": favorites, "favorite": favorite}


def main():
    try:
        payload = json.loads(sys.stdin.read())
        with connect(load_db_info()) as connection:
            result = process(connection, sys.argv[1], payload)
        print(json.dumps(result, ensure_ascii=False))
    except Exception:
        # Never expose credentials, SQL parameters or driver details.
        print(json.dumps({"ok": False}))


if __name__ == "__main__":
    main()
