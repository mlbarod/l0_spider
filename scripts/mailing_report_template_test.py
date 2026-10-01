"""Synthetic Jinja rendering checks; no database or mail transport is used."""

from html.parser import HTMLParser
from pathlib import Path
import unittest
from urllib.parse import parse_qs, urlsplit

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape


class ReportTables(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tables = []
        self.table = None
        self.row = None
        self.cell = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table" and attrs.get("class") == "detail-table":
            self.table = []
            self.tables.append(self.table)
        elif self.table is not None:
            if tag == "tr":
                self.row = {"cells": [], "links": []}
                self.table.append(self.row)
            elif tag in ("td", "th"):
                self.cell = []
            elif tag == "a":
                self.row["links"].append(attrs["href"])

    def handle_endtag(self, tag):
        if tag == "table":
            self.table = None
        elif tag in ("td", "th") and self.cell is not None:
            self.row["cells"].append(" ".join("".join(self.cell).split()))
            self.cell = None

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)


def registration(grade, **overrides):
    return dict(knox_id="synthetic-user", line_name="P1", sdwt="TEAM & ONE",
                sensor_grade=grade, dashboard_abnormal_count=99999, **overrides)


def summary(grade, count, **overrides):
    return {"lineId": "P1", "sdwt": "TEAM & ONE", "sensorGrade": grade,
            "abnormalCount": count, **overrides}


class MailingReportTemplateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        public = Path(__file__).resolve().parents[1] / "public"
        cls.template = Environment(
            loader=FileSystemLoader(public), autoescape=select_autoescape(["html"]),
            undefined=StrictUndefined,
        ).get_template("mailing-report.html")

    def context(self):
        return dict(
            spider_base_url="https://spider.example.test", generated_at="2026-10-01 09:00",
            latest_date_time="2026-10-01 08:00", start_date="2026-10-01", end_date="2026-10-01",
            dashboard_monitoring_sensor_total=1000, total_abnormal_count=100,
            ab_grade_count=40, d_grade_count=20, n_grade_count=20, m_grade_count=20,
            dashboard_previous_date_time="", dashboard_change_from_previous_day="비교 데이터 없음",
            dashboard_change_color="#667085", recipient_knox_id="synthetic-user",
            rows=[registration(grade) for grade in ["A", "B", "D", "M", "N"]],
            mailing_critical_summary=[summary("A", 1000), summary("B", 2), summary("D", 3)],
        )

    def render(self, context):
        return ReportTables(self.template.render(**context)).tables

    def test_all_registered_grades_critical_counts_and_links(self):
        context = self.context()
        context["rows"].append(registration("A"))  # Duplicate registration must not double counts.
        table = self.render(context)[0]
        self.assertEqual(table[0]["cells"], ["Line Name", "SDWT", "Sensor Grade", "심각도", "이상건수", "LINK"])
        self.assertEqual([row["cells"][2:5] for row in table[1:]], [
            ["A/B", "CRITICAL", "1,002건"], ["D", "CRITICAL", "3건"],
            ["M", "CRITICAL", "0건"], ["N", "CRITICAL", "0건"],
        ])
        for row in table[1:]:
            url = urlsplit(row["links"][0])
            self.assertEqual(url.path, "/self-equipment")
            self.assertEqual(parse_qs(url.query), {
                "line": ["P1"], "sdwt": ["TEAM & ONE"],
                "grade": [row["cells"][2]], "status": ["ALARM"],
            })

    def test_recipient_line_sdwt_and_registered_grade_isolation(self):
        context = self.context()
        context["rows"] = [registration("D"), {**registration("A"), "knox_id": "another-user"}]
        context["mailing_critical_summary"] += [
            summary("D", 900, lineId="P2"), summary("D", 800, sdwt="OTHER TEAM"),
        ]
        rows = self.render(context)[0][1:]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["cells"][2:5], ["D", "CRITICAL", "3건"])

    def test_ab_only_sums_registered_priorities(self):
        context = self.context()
        context["rows"] = [registration("B")]
        self.assertEqual(self.render(context)[0][1]["cells"][4], "2건")
        context["rows"] = [registration("A/B"), registration("B")]
        self.assertEqual(self.render(context)[0][1]["cells"][4], "1,002건")

    def test_missing_summary_never_uses_total_counts_as_critical(self):
        context = self.context()
        del context["mailing_critical_summary"]
        self.assertTrue(all(row["cells"][4] == "집계 미연결" for row in self.render(context)[0][1:]))
        context["mailing_critical_summary"] = None
        self.assertEqual(self.render(context)[0][1]["cells"][4], "집계 미연결")
        context["mailing_critical_summary"] = []
        self.assertTrue(all(row["cells"][4] == "0건" for row in self.render(context)[0][1:]))

    def test_empty_registration_and_my_eqp_are_independent(self):
        context = self.context()
        context["rows"] = []
        context["my_eqp_rows"] = [{
            **registration("N"), "prc_group": "STEP", "eqp": "EQ-1", "dashboard_abnormal_count": 42,
        }]
        tables = self.render(context)
        self.assertEqual(tables[0][1]["cells"], ["등록된 전체설비 Report 수신 조건이 없습니다."])
        self.assertEqual(tables[1][1]["cells"][5], "42건")
        query = parse_qs(urlsplit(tables[1][1]["links"][0]).query)
        self.assertNotIn("status", query)
        self.assertEqual(query["sdwt"], ["MY_EQP"])

    def test_labels_are_escaped_and_link_conditions_round_trip(self):
        context = self.context()
        special = '<script>alert("synthetic")</script> & TEAM'
        context["rows"] = [{**registration("D"), "sdwt": special}]
        context["mailing_critical_summary"] = [summary("D", 4, sdwt=special)]
        html = self.template.render(**context)
        self.assertNotIn("<script>", html)
        row = ReportTables(html).tables[0][1]
        self.assertEqual(row["cells"][1], special)
        self.assertEqual(parse_qs(urlsplit(row["links"][0]).query)["sdwt"], [special])
        self.assertEqual(row["cells"][4], "4건")


if __name__ == "__main__":
    unittest.main()
