import json
import os
import pickle
import sys
from datetime import datetime


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


def normalize_update_date(value):
    text = str(value or "").strip()
    if not text:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone().replace(tzinfo=None)
    return parsed.strftime("%Y-%m-%d %H:%M:%S")


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        line_name = str(payload.get("lineName") or "").strip()
        select_step = str(payload.get("selectStep") or "").strip().split("_", 1)[0].strip()
        update_date = normalize_update_date(payload.get("updateDate"))
        knox_id = str(payload.get("knoxId") or "").strip()
        if not line_name or not select_step or not knox_id:
            raise ValueError("clicked_history_defect 저장값이 올바르지 않습니다.")

        db_info = load_db_info()
        import pymysql

        with pymysql.connect(
            host=db_info["DB_HOST"],
            user=db_info["DB_USER"],
            password=db_info["DB_PASSWORD"],
            db=db_info["DB_NAME"],
            charset="utf8",
            port=db_info["DB_PORT"],
        ) as connection:
            with connection.cursor() as cursor:
                affected_rows = cursor.execute(
                    """
                    INSERT INTO `clicked_history_defect`
                    VALUES (%s, %s, %s, %s)
                    """,
                    (line_name, select_step, update_date, knox_id),
                )
            connection.commit()

        write_json({
            "ok": True,
            "affectedRows": affected_rows,
            "record": {
                "lineName": line_name,
                "selectStep": select_step,
                "updateDate": update_date,
                "knoxId": knox_id,
            },
        })
    except Exception as error:
        print(f"clicked history defect operation failed: {error}", file=sys.stderr)
        write_json({"ok": False, "error": f"clicked_history_defect DB 작업에 실패했습니다: {error}"})


if __name__ == "__main__":
    main()
