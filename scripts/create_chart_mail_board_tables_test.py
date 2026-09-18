import contextlib
import io
import unittest
from unittest.mock import MagicMock, patch

from scripts import create_chart_mail_board_tables as setup


class CreateTablesTest(unittest.TestCase):
    def connection(self, existing=()):
        connection = MagicMock()
        connection.__enter__.return_value = connection
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchall.return_value = existing
        return connection, cursor

    def test_preview_never_connects_or_reads_credentials(self):
        with patch.object(setup, "connect") as connect, contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(setup.main([]), 0)
        connect.assert_not_called()
        self.assertEqual(output.getvalue().count("CREATE TABLE "), 4)

    def test_existing_table_prevents_all_ddl(self):
        connection, cursor = self.connection([("chart_mail_post",)])
        with self.assertRaises(setup.SetupError):
            setup.create_tables(connection, setup.read_statements())
        self.assertEqual(cursor.execute.call_count, 1)
        self.assertTrue(cursor.execute.call_args.args[0].startswith("SELECT "))

    def test_creation_uses_checked_in_sql_in_foreign_key_order(self):
        connection, cursor = self.connection()
        statements = setup.read_statements()
        with contextlib.redirect_stdout(io.StringIO()):
            setup.create_tables(connection, statements)
        self.assertEqual([call.args[0] for call in cursor.execute.call_args_list[1:]], statements)

    def test_failure_stops_remaining_ddl_and_hides_driver_details(self):
        connection, cursor = self.connection()
        cursor.execute.side_effect = [None, None, RuntimeError("private connection details")]
        with patch.object(setup, "connect", return_value=connection), \
                contextlib.redirect_stdout(io.StringIO()) as output, \
                contextlib.redirect_stderr(io.StringIO()) as error:
            self.assertEqual(setup.main(["--apply"]), 1)
        self.assertEqual(cursor.execute.call_count, 3)
        self.assertIn("생성 완료: chart_mail_post", output.getvalue())
        self.assertNotIn("private connection details", error.getvalue())
        self.assertIn("롤백되지 않습니다", error.getvalue())


if __name__ == "__main__":
    unittest.main()
