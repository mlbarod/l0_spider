"""Validate reference merging with synthetic SQL data, without a production DB."""
import sqlite3
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace

from my_eqp_reference import lookup_error_details, read_reference_rows


class ReferenceMergeTest(unittest.TestCase):
    def test_missing_column_diagnostic_does_not_expose_raw_error(self):
        for name in ("eqpid", "sdwt_code", "fdc_model", "eqp_model", "eqp_prc_group"):
            details = lookup_error_details(Exception(1054, f"Unknown column 'e.{name}' in 'field list'"))
            self.assertEqual(details, {"db_errno": 1054, "missing_column": f"edisn.m_equipment.{name}"})
        self.assertEqual(lookup_error_details(Exception(1054, "Unknown column 'secret'")),
                         {"db_errno": 1054, "missing_column": None})
        self.assertEqual(lookup_error_details(Exception("secret connection details")),
                         {"db_errno": None, "missing_column": None})

    def test_preserves_existing_rows_and_maps_equipment_only_rows(self):
        db = sqlite3.connect(":memory:")
        self.addCleanup(db.close)
        db.execute("ATTACH DATABASE ':memory:' AS edisn")
        db.execute("""CREATE TABLE erdtsum_info (
            main TEXT, disp_name TEXT, sdwt_prod TEXT, fdc_model TEXT,
            eqp_model TEXT, prc_group TEXT, extra_column TEXT)""")
        db.execute("""CREATE TABLE edisn.m_equipment (
            eqpid TEXT, sdwt_code TEXT, fdc_model TEXT,
            eqp_model TEXT, eqp_prc_group TEXT)""")
        original = [
            ("MATCH", "CH1", "OLD", "F1", "M1", "P1", "keep"),
            ("MATCH", "CH2", "OLD", "F2", "M2", "P1", None),
            ("ERD_ONLY", "CH1", "S2", None, None, "P2", "original"),
            ("ERD_NULL", None, "S4", "F4", "M4", "P4", "keep-null-row"),
            ("ERD_EMPTY", "", "S5", None, None, "P5", "keep-empty"),
        ]
        db.executemany("INSERT INTO erdtsum_info VALUES (?, ?, ?, ?, ?, ?, ?)", original)
        db.executemany("INSERT INTO edisn.m_equipment VALUES (?, ?, ?, ?, ?)", [
            ("MATCH", "NEW", "OTHER", "OTHER", "OTHER"),
            ("EQP_ONLY", "S3", "F3", "M3", "P3"),
        ])

        class Cursor:
            def __enter__(self):
                self.inner = db.cursor()
                return self

            def __exit__(self, *args):
                self.inner.close()

            def execute(self, query):
                self.inner.execute(query)
                self.description = self.inner.description

            def fetchall(self):
                return self.inner.fetchall()

        class Connection:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def cursor(self):
                return Cursor()

        with patch.dict(sys.modules, {"pymysql": SimpleNamespace(connect=lambda **kwargs: Connection())}):
            rows = read_reference_rows(dict(DB_HOST="test", DB_USER="test", DB_PASSWORD="", DB_NAME="test", DB_PORT=3306))

        columns = [item[1] for item in db.execute("PRAGMA table_info(erdtsum_info)")]
        self.assertEqual(rows[:3], [dict(zip(columns, row)) for row in original[:3]])
        self.assertEqual(rows[3:7], [
            dict(zip(columns, ("ERD_NULL", name, "S4", "F4", "M4", "P4", "keep-null-row")))
            for name in ("PM1", "PM2", "PM3", "PM4")
        ])
        self.assertEqual(rows[7], dict(zip(columns, original[4])))
        self.assertEqual(rows[8:], [
            dict(zip(columns, ("EQP_ONLY", name, "S3", "F3", "M3", "P3", None)))
            for name in ("PM1", "PM2", "PM3", "PM4")
        ])
        self.assertTrue(all(list(row) == columns for row in rows))


if __name__ == "__main__":
    unittest.main()
