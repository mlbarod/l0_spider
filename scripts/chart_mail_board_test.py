"""DB logic tests on an isolated in-memory SQL adapter; no production DB access."""
import base64
import contextlib
import io
import json
import sqlite3
import sys
import unittest
from datetime import datetime
from unittest.mock import patch

try:
    from . import chart_mail_board as board
except ImportError:
    import chart_mail_board as board

PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC6sAAAAASUVORK5CYII="
sqlite3.register_adapter(datetime, lambda value: value.isoformat())


class Cursor:
    def __init__(self, db):
        self.db = db
        self.cursor = db.connection.cursor()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.cursor.close()

    @property
    def rowcount(self):
        return self.cursor.rowcount

    def execute(self, sql, params=()):
        if self.db.fail_image and "INSERT INTO chart_mail_post_image" in sql:
            raise RuntimeError("private DB credentials")
        sql = sql.replace("%s", "?").replace(" FOR UPDATE", "")
        sql = sql.replace("ON DUPLICATE KEY UPDATE post_id = post_id", "ON CONFLICT(post_id) DO NOTHING")
        self.cursor.execute(sql, params)

    def fetchone(self):
        row = self.cursor.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self):
        return [dict(row) for row in self.cursor.fetchall()]


class Database:
    def __init__(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.create_function("LOCATE", 2, lambda needle, text: text.find(needle) + 1)
        self.fail_image = False
        self.connection.executescript("""
            PRAGMA foreign_keys=ON;
            CREATE TABLE chart_mail_post (post_id TEXT PRIMARY KEY, fingerprint TEXT, sender_knox_id TEXT,
                title TEXT, details TEXT, comment TEXT, chart_url TEXT, app TEXT, work_status TEXT,
                version INTEGER, mail_state TEXT, diagnostics TEXT, created_at TEXT, updated_at TEXT, mail_updated_at TEXT);
            CREATE TABLE chart_mail_post_recipient (post_id TEXT REFERENCES chart_mail_post(post_id), recipient_knox_id TEXT,
                recipient_order INTEGER, PRIMARY KEY(post_id, recipient_knox_id));
            CREATE TABLE chart_mail_post_image (post_id TEXT PRIMARY KEY REFERENCES chart_mail_post(post_id), image_png BLOB,
                byte_size INTEGER, image_sha256 TEXT);
            CREATE TABLE chart_mail_post_history (history_id INTEGER PRIMARY KEY AUTOINCREMENT, post_id TEXT REFERENCES chart_mail_post(post_id),
                previous_status TEXT, next_status TEXT, changed_by TEXT, comment TEXT, changed_at TEXT);
        """)

    def cursor(self):
        return Cursor(self)

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass


def draft(**overrides):
    return {"id": "a" * 64, "fingerprint": "b" * 64, "actor": "sender.test", "title": "TEST 제목",
            "details": "Line: TEST / Sensor: S1", "comment": "첫 줄\n두 번째 줄", "chartUrl": "http://localhost/self-equipment?line=TEST",
            "app": "self-equipment", "recipients": ["reader.test", "reader2.test"], "imageBase64": PNG,
            "diagnostics": {"requestId": "synthetic-request"}, **overrides}


class BoardTest(unittest.TestCase):
    def setUp(self):
        self.db = Database()
        self.addCleanup(self.db.connection.close)

    def run_action(self, action, **payload):
        return board.execute_action(self.db, action, {"actor": "other.logged.in", "id": "a" * 64, **payload})

    def test_snapshot_binary_and_same_request_deduplication(self):
        self.assertTrue(board.execute_action(self.db, "begin", draft())["created"])
        self.assertFalse(board.execute_action(self.db, "begin", draft())["created"])
        post = self.run_action("detail")["post"]
        self.assertEqual(post["recipients"], ["reader.test", "reader2.test"])
        self.assertEqual(post["comment"], "첫 줄\n두 번째 줄")
        self.assertEqual(post["workStatus"], "IN_PROGRESS")
        self.assertEqual(self.run_action("image")["imageBase64"], PNG)
        image = self.db.connection.execute("SELECT image_png, byte_size FROM chart_mail_post_image").fetchone()
        self.assertEqual(image["image_png"], base64.b64decode(PNG))
        self.assertEqual(image["byte_size"], len(base64.b64decode(PNG)))
        with self.assertRaisesRegex(board.BoardError, "MAIL_REQUEST_CONFLICT"):
            board.execute_action(self.db, "begin", draft(fingerprint="c" * 64, title="changed"))
        self.db.rollback()
        self.assertEqual(self.run_action("detail")["post"]["title"], "TEST 제목")
        board.execute_action(self.db, "begin", draft(id="d" * 64))
        self.assertEqual(self.run_action("list", page=1, search="", status="")["total"], 2)

    def test_image_insert_failure_rolls_back_whole_snapshot(self):
        self.db.fail_image = True
        output = io.StringIO()
        with patch.object(board, "connect", return_value=self.db), patch.object(sys, "stdin", io.StringIO(json.dumps(draft()))), patch.object(sys, "argv", ["board", "begin"]), contextlib.redirect_stdout(output):
            board.main()
        self.assertEqual(json.loads(output.getvalue()), {"ok": False, "code": "BOARD_STORAGE_ERROR"})
        for table in ("chart_mail_post", "chart_mail_post_recipient", "chart_mail_post_image"):
            self.assertEqual(self.db.connection.execute("SELECT COUNT(*) FROM " + table).fetchone()[0], 0)

    def test_all_logged_in_users_change_status_with_audit_and_version_conflict(self):
        board.execute_action(self.db, "begin", draft())
        self.run_action("status", status="COMPLETED", version=1, comment="조치 완료")
        with self.assertRaisesRegex(board.BoardError, "BOARD_CONFLICT"):
            self.run_action("status", status="IN_PROGRESS", version=1, comment="stale")
        self.db.rollback()
        post = self.run_action("detail")["post"]
        self.assertEqual(post["workStatus"], "COMPLETED")
        self.assertEqual(post["mailState"], "pending")
        self.assertEqual(post["history"][0]["changedBy"], "other.logged.in")
        self.run_action("status", status="IN_PROGRESS", version=2, comment="재확인")
        self.assertEqual(len(self.run_action("detail")["post"]["history"]), 2)
        self.assertEqual(self.run_action("image")["imageBase64"], PNG)

    def test_mail_result_is_separate_from_work_status(self):
        board.execute_action(self.db, "begin", draft())
        self.run_action("finish", actor="sender.test", state="unknown", diagnostics={"networkCode": "TIMEOUT"})
        self.assertEqual(self.run_action("detail")["post"]["mailState"], "unknown")
        self.assertEqual(self.run_action("detail")["post"]["workStatus"], "IN_PROGRESS")
        self.assertFalse(board.execute_action(self.db, "begin", draft())["created"])
        with self.assertRaisesRegex(board.BoardError, "BOARD_CONFLICT"):
            self.run_action("finish", actor="sender.test", state="accepted", diagnostics={})

    def test_search_status_pagination_and_no_images_in_lists(self):
        for index in range(23):
            board.execute_action(self.db, "begin", draft(id=f"{index:064x}", title=f"등록 건 {index}"))
        first = self.run_action("list", page=1, search="", status="")
        self.assertEqual(first["total"], 23)
        self.assertEqual(len(first["posts"]), 20)
        second = self.run_action("list", page=2, search="", status="")
        self.assertEqual(len(second["posts"]), 3)
        self.assertFalse(set(p["id"] for p in first["posts"]) & set(p["id"] for p in second["posts"]))
        self.assertNotIn("imageBase64", json.dumps(first))
        self.assertEqual(self.run_action("list", page=1, search="등록 건 22", status="IN_PROGRESS")["total"], 1)
        self.assertEqual(self.run_action("list", page=1, search="%' OR 1=1 --", status="")["total"], 0)
        self.assertEqual(self.run_action("list", page=1, search="", status="COMPLETED")["total"], 0)
        with self.assertRaisesRegex(board.BoardError, "BOARD_NOT_FOUND"):
            self.run_action("detail", id="f" * 64)


if __name__ == "__main__":
    unittest.main()
