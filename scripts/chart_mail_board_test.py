"""DB logic tests on an isolated in-memory SQL adapter; no production DB access."""
import base64
import contextlib
import io
import json
import sqlite3
import sys
import unittest
from urllib.parse import urlencode
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
                title TEXT, details TEXT, comment TEXT, chart_url TEXT, app TEXT, line TEXT DEFAULT '', sdwt TEXT DEFAULT '', work_status TEXT,
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
        self.assertEqual((post["line"], post["sdwt"]), ("TEST", ""))
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

    def test_scope_filter_counts_pages_and_options_cover_entire_board(self):
        for index in range(25):
            scope = {"line": "L1" if index < 23 else "L2", "sdwt": "TEAM 공통 &+" if index < 22 or index == 23 else "TEAM2"}
            board.execute_action(self.db, "begin", draft(id=f"{index:064x}", chartUrl="https://example.test/self-equipment?" + urlencode(scope)))
        first = self.run_action("list", page=1, search="", status="", line="L1", sdwt="TEAM 공통 &+")
        self.assertEqual(first["total"], 22)
        self.assertEqual(len(first["posts"]), 20)
        self.assertTrue(all(post["line"] == "L1" and post["sdwt"] == "TEAM 공통 &+" for post in first["posts"]))
        second = self.run_action("list", page=2, search="", status="", line="L1", sdwt="TEAM 공통 &+")
        self.assertEqual(len(second["posts"]), 2)
        self.assertFalse({post["id"] for post in first["posts"]} & {post["id"] for post in second["posts"]})
        self.assertEqual(self.run_action("list", page=1, search="", status="", sdwt="TEAM 공통 &+")["total"], 23)
        self.assertEqual(self.run_action("list", page=1, search="", status="", line="L1")["total"], 23)
        self.run_action("status", id=f"{0:064x}", status="COMPLETED", version=1, comment="done")
        combined = self.run_action("list", page=1, search="TEST", status="COMPLETED", line="L1", sdwt="TEAM 공통 &+")
        self.assertEqual(combined["total"], 1)
        # Options remain available even if status/search returns no matching posts.
        empty = self.run_action("list", page=1, search="no match", status="COMPLETED", line="L2")
        self.assertEqual(empty["total"], 0)
        self.assertEqual(empty["filters"], {"lines": ["L1", "L2"], "sdwts": ["TEAM 공통 &+", "TEAM2"]})
        for field in ("line", "sdwt"):
            for value in ("TEAM", "L", "%' OR 1=1 --"):
                self.assertEqual(self.run_action("list", page=1, search="", status="", **{field: value})["total"], 0)
            with self.assertRaisesRegex(board.BoardError, "BOARD_INVALID"):
                self.run_action("list", page=1, search="", status="", **{field: "x" * 201})

    def test_line_limits_sdwt_options_and_missing_metadata_remains_visible(self):
        for index, query in enumerate(("line=L1&sdwt=S1", "line=L2&sdwt=S2", "")):
            board.execute_action(self.db, "begin", draft(id=f"{index:064x}", chartUrl="https://example.test/common-anomaly?" + query))
        filtered = self.run_action("list", page=1, search="", status="", line="L1")
        self.assertEqual(filtered["filters"], {"lines": ["L1", "L2"], "sdwts": ["S1"]})
        unfiltered = self.run_action("list", page=1, search="", status="")
        self.assertEqual(unfiltered["total"], 3)
        self.assertEqual(len([post for post in unfiltered["posts"] if post["line"] == "" and post["sdwt"] == ""]), 1)

    def test_scope_parser_preserves_send_compatibility(self):
        self.assertEqual(board.chart_scope(""), {"line": "", "sdwt": ""})
        self.assertEqual(board.chart_scope("http://[invalid"), {"line": "", "sdwt": ""})
        self.assertEqual(board.chart_scope("https://example.test/fdc_trend/matching-anomaly?line=L+1&sdwt=T%2B1&sdwt=ignored"), {"line": "L 1", "sdwt": "T+1"})
        self.assertEqual(board.chart_scope("https://example.test/?line=" + "x" * 201 + "&sdwt=S%00X"), {"line": "", "sdwt": ""})

    def test_actual_chart_sdwt_takes_priority_over_view_or_mapping_key(self):
        for app, folder in (("self-equipment", "erd"), ("common-anomaly", "common"), ("matching-anomaly", "erd_commonality")):
            for team in ("__MY_EQP__", "__SKIP_LIST__", "TEAM_KEY"):
                url = "https://example.test/" + app + "?" + urlencode({
                    "line": "L1", "sdwt": team,
                    "chart": f"/appdata/abnormal_trend/pic_server2/{folder}/2026-09-18/Actual SDWT/ETCH/img.png",
                })
                self.assertEqual(board.chart_scope(url), {"line": "L1", "sdwt": "Actual SDWT"})
        self.assertEqual(board.chart_scope("https://example.test/self-equipment?line=L1&sdwt=__MY_EQP__"), {"line": "L1", "sdwt": ""})


if __name__ == "__main__":
    unittest.main()
