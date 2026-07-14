import json
import os
import pickle
import sys


DB_INFO_PATH = os.environ.get("DB_INFO_PATH") or "/appdata/l0_spider/db_info.pkl"


def write_json(payload):
    print(json.dumps(payload, ensure_ascii=False, default=str))


def get_remote_ip():
    ip_addr = str(os.environ.get("REMOTE_ADDR") or "").strip()
    if ip_addr.startswith("::ffff:"):
        return ip_addr[7:]
    return ip_addr


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


def lookup_current_user(ip_addr, db_info):
    import pymysql

    query = """
        WITH A AS (
            SELECT IP_ADDR, SUB_USER_ID, USER_NAME
            FROM v_ipms_ip_info
            WHERE IP_ADDR = %s AND STATUS = '승인'
        )
        SELECT ip, knox_id, sdwt, available
        FROM user_info
        JOIN A ON knox_id = SUB_USER_ID
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
            cursor.execute(query, (ip_addr,))
            row = cursor.fetchone()

    if not row or not row[1]:
        return None

    return str(row[1]).strip()


def main():
    ip_addr = get_remote_ip()
    if not ip_addr:
        write_json({"ok": False, "code": "IP_NOT_FOUND", "error": "접속자 IP를 확인하지 못했습니다."})
        return

    try:
        db_info = load_db_info()
        knox_id = lookup_current_user(ip_addr, db_info)
    except Exception as error:
        print(f"current user lookup failed: {error}", file=sys.stderr)
        write_json({"ok": False, "code": "LOOKUP_FAILED", "error": "접속자 정보를 조회하지 못했습니다."})
        return

    if not knox_id:
        write_json({
            "ok": False,
            "code": "USER_NOT_FOUND",
            "error": f"승인된 접속자 정보를 찾지 못했습니다: {ip_addr}",
        })
        return

    write_json({"ok": True, "knoxId": knox_id})


if __name__ == "__main__":
    main()
