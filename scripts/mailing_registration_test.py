import unittest

from scripts.mailing_registration import merge_registration_values, serialize_list, split_list_for_column


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

    def test_existing_and_new_registration_values_are_merged(self):
        merged = merge_registration_values(
            {
                "sdwts": ["NAND P1D", "TERA P1D"],
                "priorities": ["A", "B", "D", "M", "N"],
            },
            [
                ('["DREAMS P1D","NAND P1D"]', '["A","B"]'),
            ],
        )

        self.assertEqual(merged, {
            "sdwts": ["DREAMS P1D", "NAND P1D", "TERA P1D"],
            "priorities": ["A", "B", "D", "M", "N"],
        })


if __name__ == "__main__":
    unittest.main()
