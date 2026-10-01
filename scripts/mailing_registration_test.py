import unittest
import sqlite3
from itertools import combinations
from unittest.mock import patch

from scripts.mailing_registration import (
    delete_line_registration, insert_registration, missing_registration_groups,
    parse_list, remaining_registration_groups, serialize_list, split_list_for_column,
)


class SyntheticCursor:
    def __init__(self, connection):
        self.cursor = connection.cursor()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.cursor.close()

    def execute(self, query, values):
        self.cursor.execute(query.replace("%s", "?").replace("FOR UPDATE", ""), values)
        return self.cursor.rowcount

    def fetchall(self):
        return self.cursor.fetchall()


class SyntheticConnection:
    """In-memory SQL fixture; never connects to the operational database."""
    def __init__(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("CREATE TABLE email (email TEXT, sdwt TEXT, priority TEXT)")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.db.rollback()  # Like closing a PyMySQL connection: only explicit commit persists.

    def cursor(self):
        return SyntheticCursor(self.db)

    def commit(self):
        self.db.commit()

    def seed(self, user, sdwts, priorities):
        self.db.execute("INSERT INTO email VALUES (?, ?, ?)", (user, serialize_list(sdwts), serialize_list(priorities)))
        self.commit()

    def rows(self):
        return self.db.execute("SELECT email, sdwt, priority FROM email").fetchall()

    def pairs(self):
        return {(user, sdwt, grade) for user, sdwts, grades in self.rows()
                for sdwt in parse_list(sdwts) for grade in parse_list(grades)}


class MailingRegistrationStorageTest(unittest.TestCase):
    def test_sdwt_list_is_split_to_fit_varchar_length(self):
        values = ["DREAMS P1D", "NAND P1D", "TERA P1D"]
        chunks = split_list_for_column(values, 28, "sdwt")

        self.assertEqual([item for chunk in chunks for item in chunk], values)
        self.assertTrue(all(len(serialize_list(chunk)) <= 28 for chunk in chunks))
        self.assertGreater(len(chunks), 1)

    def test_single_sdwt_larger_than_column_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "값 1개도 저장할 수 없습니다"):
            split_list_for_column(["DREAMS P1D"], 5, "sdwt")

    def test_priority_list_is_split_to_fit_varchar_length(self):
        values = ["A", "B", "D", "M", "N"]
        chunks = split_list_for_column(values, 9, "priority")

        self.assertEqual([item for chunk in chunks for item in chunk], values)
        self.assertTrue(all(len(serialize_list(chunk)) <= 9 for chunk in chunks))

    def test_new_grades_only_apply_to_requested_sdwts(self):
        groups = missing_registration_groups(
            {
                "sdwts": ["NAND P1D", "TERA P1D"],
                "priorities": ["A", "B", "D", "M", "N"],
            },
            [
                ('["DREAMS P1D","NAND P1D"]', '["A","B"]'),
            ],
        )

        self.assertEqual(groups, [
            {"sdwts": ["NAND P1D"], "priorities": ["D", "M", "N"]},
            {"sdwts": ["TERA P1D"], "priorities": ["A", "B", "D", "M", "N"]},
        ])

    def test_subtraction_preserves_every_unselected_pair(self):
        sdwts, grades = ["S1", "S2", "S3"], ["A", "B", "D"]
        original = {(sdwt, grade) for sdwt in sdwts for grade in grades}
        for sdwt_count in range(1, 4):
            for target_sdwts in combinations(sdwts, sdwt_count):
                for grade_count in range(1, 4):
                    for target_grades in combinations(grades, grade_count):
                        result = remaining_registration_groups(sdwts, grades, {
                            "sdwts": target_sdwts, "priorities": target_grades,
                        })
                        remaining = {(sdwt, grade) for group in result
                                     for sdwt in group["sdwts"] for grade in group["priorities"]}
                        removed = {(sdwt, grade) for sdwt in target_sdwts for grade in target_grades}
                        self.assertEqual(remaining, original - removed)


class MailingRegistrationTransactionTest(unittest.TestCase):
    def setUp(self):
        self.connection = SyntheticConnection()
        self.addCleanup(self.connection.db.close)
        schema = {name: {"dataType": "varchar", "maxLength": 200} for name in ["email", "sdwt", "priority"]}
        for patcher in [
            patch("scripts.mailing_registration.connect", return_value=self.connection),
            patch("scripts.mailing_registration.read_email_column_schema", return_value=schema),
        ]:
            patcher.start()
            self.addCleanup(patcher.stop)
        self.db_info = {"DB_NAME": "synthetic"}
        self.connection.seed("user01", ["S1", "S2"], ["A", "B", "D", "M", "N"])
        self.connection.seed("other-user", ["S1"], ["D"])

    def test_single_grade_deletion_splits_legacy_record_without_losing_other_conditions(self):
        before = self.connection.pairs()
        result = delete_line_registration({
            "knoxId": "user01", "line": "L1", "sdwts": ["S1"], "priorities": ["D"],
        }, self.db_info)
        self.assertEqual(self.connection.pairs(), before - {("user01", "S1", "D")})
        self.assertEqual(result["insertedRows"], 1)
        # A second deletion must be a no-op, not remove other Grades or duplicate rows.
        rows = self.connection.rows()
        delete_line_registration({
            "knoxId": "user01", "line": "L1", "sdwts": ["S1"], "priorities": ["D"],
        }, self.db_info)
        self.assertEqual(self.connection.rows(), rows)

    def test_re_registration_does_not_restore_deleted_grade_to_other_sdwts(self):
        delete_line_registration({
            "knoxId": "user01", "line": "L1", "sdwts": ["S1"], "priorities": ["D"],
        }, self.db_info)
        before = self.connection.pairs()
        payload = {"knoxId": "user01", "sdwts": ["S2", "S3"], "priorities": ["D"]}
        insert_registration(payload, self.db_info)
        self.assertEqual(self.connection.pairs(), before | {("user01", "S3", "D")})
        rows = self.connection.rows()
        result = insert_registration(payload, self.db_info)
        self.assertEqual(result["affectedRows"], 0)
        self.assertEqual(self.connection.rows(), rows)

    def test_last_grade_deletes_row_and_legacy_line_delete_removes_all_grades(self):
        self.connection.seed("user02", ["S1"], ["N"])
        delete_line_registration({
            "knoxId": "user02", "line": "L1", "sdwts": ["S1"], "priorities": ["N"],
        }, self.db_info)
        self.assertFalse(any(row[0] == "user02" for row in self.connection.rows()))
        self.connection.seed("user01", ["S1", "S2"], ["HISTORICAL"])
        before = self.connection.pairs()
        delete_line_registration({"knoxId": "user01", "line": "L1", "sdwts": ["S1"]}, self.db_info)
        self.assertEqual(self.connection.pairs(), {item for item in before if item[:2] != ("user01", "S1")})

    def test_duplicate_legacy_rows_do_not_duplicate_split_records(self):
        self.connection.seed("user01", ["S1", "S2"], ["A", "B", "D", "M", "N"])
        before = self.connection.pairs()
        delete_line_registration({
            "knoxId": "user01", "line": "L1", "sdwts": ["S1"], "priorities": ["D"],
        }, self.db_info)
        self.assertEqual(self.connection.pairs(), before - {("user01", "S1", "D")})
        self.assertEqual(sum(parse_list(row[1]) == ["S1"] and row[0] == "user01" for row in self.connection.rows()), 1)

    def test_split_failure_rolls_back_original_registration(self):
        before = self.connection.rows()
        # Emulate an incompatible unique-email schema without accessing production.
        self.connection.db.execute("CREATE UNIQUE INDEX one_row_per_user ON email(email)")
        with self.assertRaises(sqlite3.IntegrityError):
            delete_line_registration({
                "knoxId": "user01", "line": "L1", "sdwts": ["S1"], "priorities": ["D"],
            }, self.db_info)
        self.assertEqual(self.connection.rows(), before)


if __name__ == "__main__":
    unittest.main()
