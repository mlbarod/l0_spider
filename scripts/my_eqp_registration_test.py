import unittest

from scripts.my_eqp_registration import MY_EQP_COLUMNS, build_insert_values, build_list_query


class MyEqpRegistrationQueryTest(unittest.TestCase):
    def test_insert_values_create_each_knox_id_and_eqp_combination(self):
        values = build_insert_values({
            "line": "P1D",
            "sdwt": "DREAMS P1D",
            "prcGroup": "ETCH",
            "eqps": ["EQP01", "EQP02"],
            "execDate": "2026-07-21 10:00:00",
            "periode": 7,
            "comment": "monitor",
            "knoxId": "owner",
            "knoxIds": ["user01", "user02"],
            "isPublic": False,
        })

        self.assertEqual(len(values), 4)
        self.assertEqual([(row[7], row[3]) for row in values], [
            ("user01", "EQP01"),
            ("user01", "EQP02"),
            ("user02", "EQP01"),
            ("user02", "EQP02"),
        ])

    def test_list_query_includes_owned_and_public_rows(self):
        query, values = build_list_query({
            "line": "P1D",
            "knoxId": "user01",
            "activeOnly": True,
        })

        self.assertIn("(`knox_id` = %s OR `is_public` = 1)", query)
        self.assertIn("TIMESTAMPADD(DAY, `periode`, `exec_date`) > NOW()", query)
        self.assertEqual(values, ("P1D", "user01"))
        self.assertEqual(MY_EQP_COLUMNS[-1], "is_public")


if __name__ == "__main__":
    unittest.main()
