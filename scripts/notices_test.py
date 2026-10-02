import sqlite3
import unittest

from notices import update_notice


class Cursor:
    def __init__(self, connection):
        self.cursor = connection.cursor()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.cursor.close()

    def execute(self, sql, params):
        self.cursor.execute(sql.replace("%s", "?"), params)

    def fetchone(self):
        row = self.cursor.fetchone()
        return dict(row) if row else None


class Connection:
    def __init__(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.create_function("NOW", 0, lambda: "2026-10-02 10:00:00")
        self.db.execute("""CREATE TABLE site_notices (
            notice_id INTEGER PRIMARY KEY, title TEXT, body TEXT, status TEXT,
            created_by TEXT, created_at TEXT, updated_by TEXT, updated_at TEXT,
            completed_by TEXT, completed_at TEXT
        )""")
        for notice_id, status in [(1, "ACTIVE"), (2, "COMPLETED")]:
            self.db.execute("INSERT INTO site_notices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (
                notice_id, "원래 제목", "원래 본문", status, "author", "2026-10-01",
                "author", "2026-10-01", "finisher" if notice_id == 2 else None,
                "2026-10-01" if notice_id == 2 else None,
            ))
        self.db.commit()

    def cursor(self):
        return Cursor(self.db)

    def commit(self):
        self.db.commit()


class NoticeUpdateTest(unittest.TestCase):
    def test_update_preserves_status_and_creation_completion_metadata(self):
        connection = Connection()
        self.addCleanup(connection.db.close)
        for notice_id, status in [(1, "ACTIVE"), (2, "COMPLETED")]:
            payload = {"noticeId": notice_id, "title": "수정 ' 제목", "body": "수정\n본문", "updatedBy": "editor"}
            for _ in range(2):  # Saving identical content must also succeed.
                notice = update_notice(connection, payload)
                self.assertEqual(notice["title"], payload["title"])
                self.assertEqual(notice["body"], payload["body"])
                self.assertEqual(notice["status"], status)
                self.assertEqual(notice["createdBy"], "author")
                self.assertEqual(notice["createdAt"], "2026-10-01")
                self.assertEqual(notice["updatedBy"], "editor")
                self.assertEqual(notice["updatedAt"], "2026-10-02 10:00:00")
                self.assertEqual(notice["completedBy"], "finisher" if notice_id == 2 else None)
                self.assertEqual(notice["completedAt"], "2026-10-01" if notice_id == 2 else None)
        self.assertIsNone(update_notice(connection, {"noticeId": 999, "title": "제목", "body": "본문", "updatedBy": "editor"}))
        self.assertEqual(connection.db.execute("SELECT COUNT(*) FROM site_notices").fetchone()[0], 2)


if __name__ == "__main__":
    unittest.main()
