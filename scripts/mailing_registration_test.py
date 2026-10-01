import unittest
import sqlite3
from itertools import combinations
from unittest.mock import patch

from scripts.mailing_registration import (
    MailingSchemaError, database_error_payload, delete_line_registration, insert_registration, missing_registration_groups,
    parse_list, remaining_registration_groups, serialize_list, split_list_for_column,
)


class SyntheticCursor:
    def __init__(self, connection):
        self.connection = connection
        self.cursor = connection.cursor()
        self.metadata_rows = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.cursor.close()

    def execute(self, query, values):
        self.metadata_rows = None
        if "`information_schema`.`STATISTICS`" in query:
            self.metadata_rows = []
            for index in self.connection.execute("PRAGMA index_list(email)").fetchall():
                if index[2]:
                    columns = self.connection.execute("SELECT name FROM pragma_index_info(?) ORDER BY seqno", (index[1],)).fetchall()
                    self.metadata_rows.extend((index[1], row[0]) for row in columns)
            return len(self.metadata_rows)
        self.cursor.execute(query.replace("%s", "?").replace("FOR UPDATE", ""), values)
        return self.cursor.rowcount

    def fetchall(self):
        if self.metadata_rows is not None:
            return self.metadata_rows
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

    def test_unique_email_is_rejected_before_any_split_write(self):
        before = self.connection.rows()
        # Emulate an incompatible unique-email schema without accessing production.
        self.connection.db.execute("CREATE UNIQUE INDEX one_row_per_user ON email(email)")
        statements = []
        self.connection.db.set_trace_callback(statements.append)
        with self.assertRaises(MailingSchemaError) as raised:
            delete_line_registration({
                "knoxId": "user01", "line": "L1", "sdwts": ["S1"], "priorities": ["D"],
            }, self.db_info)
        self.assertEqual(self.connection.rows(), before)
        self.assertEqual(database_error_payload(raised.exception, "delete_line")["code"], "MAILING_DB_SINGLE_ROW_LIMIT")
        self.assertFalse(any(sql.lstrip().startswith(("UPDATE", "INSERT", "DELETE")) for sql in statements))

    def test_unique_email_allows_line_delete_and_single_sdwt_grade_update(self):
        self.connection.db.execute("CREATE UNIQUE INDEX one_row_per_user ON email(email)")
        delete_line_registration({"knoxId": "user01", "line": "L1", "sdwts": ["S2"]}, self.db_info)
        delete_line_registration({
            "knoxId": "user01", "line": "L1", "sdwts": ["S1"], "priorities": ["D"],
        }, self.db_info)
        self.assertEqual({item for item in self.connection.pairs() if item[0] == "user01"}, {
            ("user01", "S1", grade) for grade in ["A", "B", "M", "N"]
        })

    def test_unique_email_rejects_new_combinations_before_inserting(self):
        self.connection.db.execute("CREATE UNIQUE INDEX one_row_per_user ON email(email)")
        before = self.connection.rows()
        with self.assertRaises(MailingSchemaError):
            insert_registration({"knoxId": "user01", "sdwts": ["S3"], "priorities": ["D"]}, self.db_info)
        self.assertEqual(self.connection.rows(), before)

    def test_non_unique_email_index_preserves_data_and_enables_grade_delete_and_add(self):
        # Emulate the uniqueness change in memory; this does not execute MySQL DDL.
        self.connection.db.execute("CREATE UNIQUE INDEX one_row_per_user ON email(email)")
        original_rows = self.connection.rows()
        original_pairs = self.connection.pairs()
        payload = {"knoxId": "user01", "line": "L1", "sdwts": ["S1"], "priorities": ["D"]}
        with self.assertRaises(MailingSchemaError):
            delete_line_registration(payload, self.db_info)

        self.connection.db.execute("DROP INDEX one_row_per_user")
        self.connection.db.execute("CREATE INDEX idx_mailing_email_lookup ON email(email)")
        self.assertEqual(self.connection.rows(), original_rows)
        delete_line_registration(payload, self.db_info)
        self.assertEqual(self.connection.pairs(), original_pairs - {("user01", "S1", "D")})
        insert_registration({"knoxId": "user01", "sdwts": ["S3"], "priorities": ["N"]}, self.db_info)
        self.assertEqual(self.connection.pairs(),
                         (original_pairs - {("user01", "S1", "D")}) | {("user01", "S3", "N")})


if __name__ == "__main__":
    unittest.main()
