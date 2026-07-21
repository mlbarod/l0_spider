import unittest

from scripts.mailing_registration import build_insert_values, serialize_list, split_list_for_column


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

    def test_insert_values_use_one_scalar_recipient(self):
        values = build_insert_values(
            {"knoxId": "user01"},
            [["DREAMS P1D"]],
            [["A", "B"]],
        )

        self.assertEqual(values, [
            ("user01", '["DREAMS P1D"]', '["A","B"]'),
        ])


if __name__ == "__main__":
    unittest.main()
