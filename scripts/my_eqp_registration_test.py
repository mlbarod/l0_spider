import unittest

from scripts.my_eqp_registration import MY_EQP_COLUMNS, build_list_query


class MyEqpRegistrationQueryTest(unittest.TestCase):
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
