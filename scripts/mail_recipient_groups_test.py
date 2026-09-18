"""Synthetic transactional SQL tests. Never loads real DB settings or connects to MySQL."""

import sqlite3
import unittest
from datetime import datetime
from unittest.mock import patch

from scripts import mail_recipient_groups as groups


class Cursor:
    def __init__(self, connection):
        self.connection = connection
        self.cursor = connection.db.cursor()
        self.lock_result = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.cursor.close()

    def execute(self, sql, params=()):
        self.connection.events.append(("sql", sql, params))
        if "GET_LOCK" in sql:
            self.lock_result = (self.connection.lock_available,)
            return 1
        self.lock_result = None
        values = tuple(value.isoformat(" ") if isinstance(value, datetime) else value for value in params)
        self.cursor.execute(sql.replace("%s", "?").replace(" FOR UPDATE", ""), values)
        return self.cursor.rowcount

    def executemany(self, sql, values):
        for index, value in enumerate(values):
            self.execute(sql, value)
            if self.connection.fail_members and index == 0:
                raise RuntimeError("synthetic insert failure")

    def fetchone(self):
        return self.lock_result if self.lock_result is not None else self.cursor.fetchone()

    def fetchall(self):
        rows = self.cursor.fetchall()
        # PyMySQL returns DATETIME columns as datetime objects.
        return [(row[0], row[1], datetime.fromisoformat(row[2]), row[3]) for row in rows]


class Connection:
    def __init__(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript("""
            PRAGMA foreign_keys = ON;
            CREATE TABLE chart_mail_recipient_group (
                group_id TEXT PRIMARY KEY, owner_knox_id TEXT NOT NULL,
                group_name TEXT NOT NULL, group_name_key TEXT NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                UNIQUE(owner_knox_id, group_name_key));
            CREATE TABLE chart_mail_recipient_group_member (
                group_id TEXT NOT NULL REFERENCES chart_mail_recipient_group(group_id) ON DELETE CASCADE,
                recipient_order INTEGER CHECK(recipient_order BETWEEN 1 AND 100), recipient_knox_id TEXT NOT NULL,
                PRIMARY KEY(group_id, recipient_order), UNIQUE(group_id, recipient_knox_id));
        """)
        self.events = []
        self.fail_members = False
        self.lock_available = 1

    def cursor(self):
        return Cursor(self)

    def begin(self):
        self.events.append("begin")
        self.db.execute("BEGIN")

    def commit(self):
        self.events.append("commit")
        self.db.commit()

    def rollback(self):
        self.events.append("rollback")
        self.db.rollback()

    def close(self):
        # Preserve the synthetic database across requests; record lock release.
        self.events.append("close")


class MailRecipientGroupsTest(unittest.TestCase):
    def setUp(self):
        self.connection = Connection()
        self.addCleanup(self.connection.db.close)

    def request(self, action, **payload):
        return groups.handle(action, {"owner": "owner.a", **payload}, {"DB_NAME": "synthetic"},
                             connector=lambda _: self.connection)

    def save(self, name="담당자", recipients=None, **extra):
        return self.request("save", name=name, nameKey=name.lower(),
                            recipients=recipients or ["test.b", "test.a"], **extra)["group"]

    def test_round_trip_order_ownership_edit_and_cascade_delete(self):
        group = self.save()
        self.assertEqual(self.request("list")["groups"], [group])
        self.assertEqual(self.request("list", owner="owner.b")["groups"], [])
        for action in ("save", "delete"):
            with self.assertRaises(groups.GroupInputError):
                self.request(action, owner="owner.b", id=group["id"], name="other", nameKey="other", recipients=["x"])
        updated = self.save(id=group["id"], recipients=["test.c"])
        self.assertEqual(updated["id"], group["id"])
        self.assertEqual(self.request("list")["groups"], [updated])
        self.request("delete", id=group["id"])
        self.assertEqual(self.request("list")["groups"], [])
        self.assertEqual(self.connection.db.execute("SELECT COUNT(*) FROM chart_mail_recipient_group_member").fetchone()[0], 0)

    def test_duplicate_names_and_limits_preserve_existing_records(self):
        first = self.save(name="Group")
        with self.assertRaisesRegex(groups.GroupInputError, "DUPLICATE_GROUP"):
            self.save(name="GROUP")
        self.save(name="GROUP", owner="owner.b")
        for index in range(1, 50):
            self.save(name=f"Group {index}")
        with self.assertRaisesRegex(groups.GroupInputError, "GROUP_LIMIT"):
            self.save(name="Overflow")
        self.save(id=first["id"], recipients=["updated"])
        self.assertEqual(len(self.request("list")["groups"]), 50)
        self.assertEqual(len(self.request("list", owner="owner.b")["groups"]), 1)

    def test_insert_and_member_replacement_roll_back_on_partial_failure(self):
        original = self.save()
        self.connection.fail_members = True
        for extra in ({"name": "new"}, {"id": original["id"], "name": "renamed"}):
            with self.assertRaisesRegex(RuntimeError, "synthetic insert failure"):
                self.save(recipients=["new.a", "new.b"], **extra)
            self.assertEqual(self.connection.events[-2:], ["rollback", "close"])
            self.assertEqual(self.request("list")["groups"], [original])

    def test_write_lock_precedes_transaction_and_is_held_through_commit(self):
        self.save()
        events = self.connection.events
        self.assertIn("GET_LOCK", events[0][1])
        self.assertLessEqual(len(events[0][2][0]), 64)
        self.assertEqual(events[1], "begin")
        self.assertEqual(events[-2:], ["commit", "close"])
        self.connection.events.clear()
        self.connection.lock_available = 0
        with self.assertRaisesRegex(RuntimeError, "GROUP_LOCK_UNAVAILABLE"):
            self.save(name="blocked")
        self.assertNotIn("begin", self.connection.events)
        self.assertEqual(self.connection.events[-2:], ["rollback", "close"])
        self.assertEqual(len(self.request("list")["groups"]), 1)

    def test_input_rejected_before_connection_and_recipient_limit(self):
        for payload in ({"owner": ""}, {"owner": "owner.a", "name": "bad", "nameKey": "bad", "recipients": ["external@example.com"]}):
            with self.assertRaises(groups.GroupInputError):
                groups.handle("save", payload, {}, connector=lambda _: self.fail("must not connect"))
        self.save(recipients=[f"test.{index}" for index in range(100)])
        with self.assertRaises(groups.GroupInputError):
            self.save(name="too many", recipients=[f"test.{index}" for index in range(101)])

    def test_connect_uses_existing_credentials_utf8mb4_and_utc(self):
        info = {"DB_HOST": "synthetic", "DB_PORT": 3306, "DB_USER": "test", "DB_PASSWORD": "synthetic", "DB_NAME": "test"}
        from unittest.mock import Mock
        driver = Mock()
        with patch.dict("sys.modules", {"pymysql": driver}):
            groups.connect(info)
        options = driver.connect.call_args.kwargs
        self.assertEqual(options["db"], info["DB_NAME"])
        self.assertEqual(options["charset"], "utf8mb4")
        self.assertEqual(options["init_command"], "SET time_zone = '+00:00'")
        self.assertFalse(options["autocommit"])


if __name__ == "__main__":
    unittest.main()
