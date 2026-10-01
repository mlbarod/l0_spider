import contextlib
import io
import unittest
from unittest.mock import MagicMock, patch

import create_filter_favorites_table as setup


class CreateFavoritesTableTests(unittest.TestCase):
    def test_only_current_table_creation_is_loaded(self):
        sql = setup.read_statement()
        self.assertTrue(sql.startswith("CREATE TABLE IF NOT EXISTS anomaly_filter_favorite_items"))
        self.assertNotIn("INSERT INTO", sql)
        self.assertNotIn("SELECT", sql)
        self.assertIn("UNIQUE KEY uq_user_filter_item", sql)

    def test_default_execution_runs_one_create_without_touching_data(self):
        connection = MagicMock()
        with patch.object(setup, "connect", return_value=connection) as connect:
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(setup.main([]), 0)
        connect.assert_called_once_with()
        cursor = connection.__enter__.return_value.cursor.return_value.__enter__.return_value
        cursor.execute.assert_called_once_with(setup.read_statement())

    def test_dry_run_never_connects(self):
        with patch.object(setup, "connect") as connect:
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(setup.main(["--dry-run"]), 0)
        connect.assert_not_called()
        self.assertIn(setup.TABLE_NAME, output.getvalue())

    def test_failure_does_not_expose_driver_details(self):
        with patch.object(setup, "connect", side_effect=RuntimeError("private connection details")):
            with contextlib.redirect_stderr(io.StringIO()) as output:
                self.assertEqual(setup.main([]), 1)
        self.assertNotIn("private", output.getvalue())


if __name__ == "__main__":
    unittest.main()
