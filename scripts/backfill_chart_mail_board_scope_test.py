"""Scope migration checks on synthetic, in-memory records only."""
import contextlib
import io
import unittest
from unittest.mock import patch

from scripts import backfill_chart_mail_board_scope as migration
from scripts import chart_mail_board as board
from scripts.chart_mail_board_test import Database, draft


class BackfillTest(unittest.TestCase):
    def test_preview_never_connects(self):
        with patch.object(migration, "connect") as connect, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(migration.main([]), 0)
        connect.assert_not_called()

    def test_backfill_batches_legacy_posts_without_changing_snapshots_or_existing_scope(self):
        db = Database()
        self.addCleanup(db.connection.close)
        for index in range(203):
            board.execute_action(db, "begin", draft(id=f"{index:064x}", chartUrl="https://example.test/self-equipment?line=L+1&sdwt=TEAM%2B%26"))
        board.execute_action(db, "begin", draft(id="f" * 64, chartUrl=""))
        db.connection.execute("UPDATE chart_mail_post SET line = '', sdwt = ''")
        db.connection.execute("UPDATE chart_mail_post SET line = 'KEEP' WHERE post_id = ?", (f"{0:064x}",))
        db.commit()
        before = [dict(row) for row in db.connection.execute("SELECT * FROM chart_mail_post ORDER BY post_id")]
        self.assertEqual(migration.backfill(db), 203)
        after = [dict(row) for row in db.connection.execute("SELECT * FROM chart_mail_post ORDER BY post_id")]
        self.assertEqual(after[0]["line"], "KEEP")
        self.assertEqual(after[0]["sdwt"], "TEAM+&")
        self.assertEqual(after[-2]["line"], "L 1")
        self.assertEqual((after[-1]["line"], after[-1]["sdwt"]), ("", ""))
        for old, new in zip(before, after):
            for key in old.keys() - {"line", "sdwt"}:
                self.assertEqual(old[key], new[key])
        self.assertEqual(migration.backfill(db), 0)

    def test_apply_failure_masks_driver_details_and_rolls_back_current_batch(self):
        db = Database()
        self.addCleanup(db.connection.close)
        with patch.object(migration, "connect", return_value=db), patch.object(migration, "backfill", side_effect=RuntimeError("private connection")), \
                patch.object(db, "rollback") as rollback, contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertEqual(migration.main(["--apply"]), 1)
        rollback.assert_called_once()
        self.assertNotIn("private connection", output.getvalue())


if __name__ == "__main__":
    unittest.main()
