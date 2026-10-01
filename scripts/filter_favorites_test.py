"""Synthetic in-memory persistence tests; adapt only MySQL placeholder/upsert syntax."""
import sqlite3
import unittest
from filter_favorites import process


class Cursor:
    def __init__(self, db):
        self.cursor = db.cursor()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.cursor.close()

    def execute(self, sql, values):
        self.cursor.execute(sql.replace("%s", "?").replace("ON DUPLICATE KEY UPDATE id = id", "ON CONFLICT DO NOTHING"), values)

    def fetchall(self):
        return self.cursor.fetchall()


class Connection:
    def __init__(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("CREATE TABLE anomaly_filter_favorite_items (id INTEGER PRIMARY KEY AUTOINCREMENT, knox_id TEXT, filter_type TEXT, line_name TEXT, sdwt TEXT, UNIQUE(knox_id, filter_type, line_name, sdwt))")

    def cursor(self):
        return Cursor(self.db)

    def commit(self):
        self.db.commit()


class FavoriteTests(unittest.TestCase):
    def test_multiple_independent_idempotent_items_and_empty_state(self):
        connection = Connection()
        self.addCleanup(connection.db.close)
        def save(field, line, sdwt=None, selected=True, user="u1"):
            return process(connection, "save", dict(knoxId=user, field=field, line=line, sdwt=sdwt, selected=selected))
        save("line", "L2")
        save("line", "L1")
        save("line", "L2")
        save("sdwt", "L2", "B")
        save("sdwt", "L2", "C")
        save("sdwt", "L1", "A", user="u2")
        self.assertEqual(process(connection, "get", {"knoxId": "u1"})["favorites"], {"lines": ["L2", "L1"], "sdwts": [{"line": "L2", "sdwt": "B"}, {"line": "L2", "sdwt": "C"}]})
        save("line", "L2", selected=False)
        save("line", "L1", selected=False)
        self.assertEqual(process(connection, "get", {"knoxId": "u1"})["favorite"], {"line": "L2", "sdwt": "B"})
        save("sdwt", "L2", "B", selected=False)
        result = save("sdwt", "L2", "C", selected=False)
        self.assertEqual(result["favorites"], {"lines": [], "sdwts": []})
        self.assertIsNone(result["favorite"])
        self.assertEqual(save("sdwt", "L2", "C", selected=False)["favorites"], result["favorites"])
        self.assertEqual(process(connection, "get", {"knoxId": "u2"})["favorites"]["sdwts"], [{"line": "L1", "sdwt": "A"}])


if __name__ == "__main__":
    unittest.main()
