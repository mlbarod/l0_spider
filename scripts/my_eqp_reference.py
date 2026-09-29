import json
import os
import pickle
import sys


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


def read_reference_rows(db_info):
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
            # Read the actual schema so equipment-only rows retain exactly the
            # erdtsum_info column layout, including columns unused by the UI.
            cursor.execute("SELECT * FROM `erdtsum_info` LIMIT 0")
            columns = [column[0] for column in cursor.description]
            equipment_columns = {
                "main": "eqpid", "sdwt_prod": "sdwt_code",
                "fdc_model": "fdc_model", "eqp_model": "eqp_model",
                "prc_group": "eqp_prc_group",
            }
            projection = ", ".join(
                f"e.`{equipment_columns[column]}`" if column in equipment_columns else "NULL"
                for column in columns
            )
            cursor.execute(f"""
                SELECT r.* FROM `erdtsum_info` r
                UNION ALL
                SELECT {projection}
                FROM `edisn`.`m_equipment` e
                WHERE NOT EXISTS (
                    SELECT 1 FROM `erdtsum_info` r WHERE r.`main` = e.`eqpid`
                )
            """)
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

    return [
        {**row, "disp_name": disp_name}
        for row in rows
        for disp_name in (
            ("PM1", "PM2", "PM3", "PM4")
            if row["disp_name"] is None else (row["disp_name"],)
        )
    ]


def main():
    try:
        rows = read_reference_rows(load_db_info())
    except Exception as error:
        # Do not expose DB connection details or raw SQL errors.
        db_errno = error.args[0] if error.args and type(error.args[0]) is int else None
        write_json({
            "ok": False,
            "code": "LOOKUP_FAILED",
            "db_errno": db_errno,
            "error": "erdtsum_info 기준정보를 조회하지 못했습니다.",
        })
        return

    write_json({"ok": True, "rows": rows})


if __name__ == "__main__":
    main()
