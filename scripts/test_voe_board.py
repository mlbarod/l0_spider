"""운영 DB 없이 SQLite 임시 DB로 VOE 저장/권한/이력 흐름을 검증합니다."""
import copy
from datetime import datetime
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import unittest

from voe_board import BoardError, body, execute
from create_voe_tables import create_tables

OWNER = {'userId': 'owner', 'displayName': '작성자', 'role': 'general'}
OTHER = {'userId': 'other', 'displayName': '다른 사용자', 'role': 'general'}
MASTER = {'userId': 'master', 'displayName': '마스터', 'role': 'master'}


class Cursor:
    def __init__(self, db):
        self.cursor = db.cursor()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.cursor.close()

    def execute(self, sql, args=()):
        sql = sql.replace('%s', '?').replace(' FOR UPDATE', '').replace('UTC_TIMESTAMP(3)', "'2026-09-29 01:02:03'")
        self.cursor.execute(sql, args)
        self.lastrowid = self.cursor.lastrowid

    def fetchall(self):
        result = []
        for row in self.cursor.fetchall():
            row = dict(row)
            if row.get('created_at'):
                row['created_at'] = datetime.fromisoformat(row['created_at'])
            result.append(row)
        return result

    def fetchone(self):
        row = self.cursor.fetchone()
        return dict(row) if row else None


class Connection:
    def __init__(self, database=':memory:'):
        self.db = sqlite3.connect(database)
        self.db.row_factory = sqlite3.Row
        self.db.create_function('JSON_UNQUOTE', 1, lambda v: v)
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS spider_voe_posts (question_id INTEGER PRIMARY KEY AUTOINCREMENT,
                document TEXT NOT NULL, summary TEXT NOT NULL, hidden INTEGER DEFAULT 0, updated_at TEXT);
            CREATE TABLE IF NOT EXISTS spider_voe_events (event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER, actor_id TEXT, actor_name TEXT, action TEXT, detail TEXT,
                recipient_id TEXT, read_at TEXT, created_at TEXT);
        ''')

    def cursor(self):
        return Cursor(self.db)


class VoeTests(unittest.TestCase):
    def setUp(self):
        self.connection = Connection()
        self.addCleanup(self.connection.db.close)
        self.created = self.call('create', input={'title': '기능 요청', 'bodyHtml': '<p>문의 본문</p>'})['post']

    def call(self, action, actor=OWNER, **kwargs):
        payload = {'action': action, 'actor': actor, 'questionId': 1, **kwargs}
        try:
            result = execute(self.connection, payload)
            self.connection.db.commit()
            return result
        except Exception:
            self.connection.db.rollback()
            raise

    def denied(self, action, actor=OTHER, code='QNA_FORBIDDEN', **kwargs):
        with self.assertRaises(BoardError) as caught:
            self.call(action, actor, **kwargs)
        self.assertEqual(caught.exception.code, code)

    def test_create_list_detail_and_view(self):
        listed = self.call('list')['posts'][0]
        self.assertFalse(listed['detailLoaded'])
        self.assertEqual(listed['content'], '')
        self.assertNotIn('searchText', listed)
        self.assertEqual(self.call('detail')['post']['content'], '<p>문의 본문</p>')
        self.call('update', input={'operation': 'view'})
        self.assertEqual(self.call('detail')['post']['views'], 1)

    def test_removed_fields_are_not_required_or_stored(self):
        post = self.call('create', input={'title': '새 질문', 'bodyHtml': '<p>분류 없는 본문</p>',
                         'lineName': 'P3D', 'tags': ['예전 클라이언트']})['post']
        self.assertEqual(post['status'], 'waiting')
        self.assertEqual(post['category'], '기타')
        for field in ['line', 'tags', 'searchText']:
            self.assertNotIn(field, post)
        row = self.connection.db.execute('SELECT document, summary FROM spider_voe_posts WHERE question_id=2').fetchone()
        for value in row:
            stored = json.loads(value)
            self.assertNotIn('searchText', stored)
            self.assertEqual(stored['category'], '기타')

    def test_legacy_post_can_be_read_and_updated_without_classifications(self):
        fields = {'category': 'FDC', 'line': 'P3D', 'tags': ['기존'], 'process': '공정',
                  'department': '부서', 'type': '문의', 'searchText': '검색용 전체 본문'}
        for column in ['document', 'summary']:
            row = self.connection.db.execute(f'SELECT {column} FROM spider_voe_posts WHERE question_id=1').fetchone()
            stored = {**json.loads(row[0]), **fields}
            self.connection.db.execute(f'UPDATE spider_voe_posts SET {column}=? WHERE question_id=1', (json.dumps(stored),))
        self.connection.db.commit()
        removed_fields = fields.keys() - {'category'}
        for post in [self.call('list')['posts'][0], self.call('detail')['post']]:
            self.assertTrue(removed_fields.isdisjoint(post))
            self.assertEqual(post['category'], '기타')
        updated = self.call('update', input={'title': '수정 제목', 'bodyHtml': '<p>수정 본문</p>'})['post']
        self.assertEqual(updated['content'], '<p>수정 본문</p>')
        for value in self.connection.db.execute('SELECT document, summary FROM spider_voe_posts WHERE question_id=1').fetchone():
            self.assertTrue(removed_fields.isdisjoint(json.loads(value)))
            self.assertEqual(json.loads(value)['category'], '기타')

    def test_categories_persist_in_document_summary_list_and_detail(self):
        for category in ['L0 SPIDER', 'L1 SPIDER', 'L3 SPIDER', 'Defect SPIDER', '기타']:
            with self.subTest(category=category):
                post = self.call('create', input={'title': category, 'category': category, 'bodyHtml': '<p>문의</p>'})['post']
                qid = post['questionId']
                self.assertEqual(post['category'], category)
                self.assertEqual(self.call('list')['posts'][0]['category'], category)
                self.assertEqual(self.call('detail', questionId=qid)['post']['category'], category)
                for value in self.connection.db.execute('SELECT document, summary FROM spider_voe_posts WHERE question_id=?', (qid,)).fetchone():
                    self.assertEqual(json.loads(value)['category'], category)

    def test_category_edit_preserved_by_reply_status_and_older_client(self):
        self.call('update', input={'title': '수정', 'category': 'Defect SPIDER', 'bodyHtml': '<p>수정</p>'})
        self.call('reply', OTHER, input={'bodyHtml': '<p>답변</p>'})
        self.call('update', MASTER, input={'operation': 'status', 'status': 'completed'})
        post = self.call('update', input={'title': '다시 수정', 'bodyHtml': '<p>본문</p>'})['post']
        self.assertEqual(post['category'], 'Defect SPIDER')
        self.assertEqual(self.call('list')['posts'][0]['category'], 'Defect SPIDER')
        self.denied('update', input={'title': '권한 없음', 'category': 'L0 SPIDER', 'bodyHtml': '<p>본문</p>'})
        self.assertEqual(self.call('detail')['post']['category'], 'Defect SPIDER')

    def test_invalid_category_is_rejected_without_changing_posts(self):
        original = self.call('detail')['post']
        for category in ['', 'FDC', 'L2 SPIDER', None, [], {}]:
            with self.subTest(category=category):
                data = {'title': '질문', 'bodyHtml': '<p>본문</p>', 'category': category}
                self.denied('create', OWNER, code='VALIDATION_FAILED', input=data)
                self.denied('update', OWNER, code='VALIDATION_FAILED', input=data)
                self.assertEqual(len(self.call('list')['posts']), 1)
                self.assertEqual(self.call('detail')['post'], original)

    def test_missing_legacy_category_defaults_without_writing_on_read(self):
        for column in ['document', 'summary']:
            row = self.connection.db.execute(f'SELECT {column} FROM spider_voe_posts WHERE question_id=1').fetchone()
            stored = json.loads(row[0])
            stored.pop('category')
            self.connection.db.execute(f'UPDATE spider_voe_posts SET {column}=? WHERE question_id=1', (json.dumps(stored),))
        self.connection.db.commit()
        self.assertEqual(self.call('list')['posts'][0]['category'], '기타')
        self.assertEqual(self.call('detail')['post']['category'], '기타')
        for value in self.connection.db.execute('SELECT document, summary FROM spider_voe_posts WHERE question_id=1').fetchone():
            self.assertNotIn('category', json.loads(value))

    def test_author_permissions_and_restore(self):
        self.denied('update', input={'title': '탈취', 'bodyHtml': '<p>악성</p>'})
        self.denied('update', OWNER, input={'operation': 'status', 'status': 'completed'})
        self.call('update', input={'operation': 'hide'})
        self.assertEqual(self.call('list')['posts'], [])
        self.denied('detail', code='QNA_NOT_FOUND')
        self.denied('reply', code='QNA_NOT_FOUND', input={'bodyHtml': '<p>댓글</p>'})
        self.call('update', MASTER, input={'operation': 'restore'})
        self.assertEqual(len(self.call('list')['posts']), 1)

    def test_reply_final_delete_restore_notification_history(self):
        replied = self.call('reply', OTHER, input={'bodyHtml': '<p>담당자 답변</p>'})['post']
        self.assertEqual(replied['status'], 'active')
        self.denied('update', OWNER, input={'operation': 'hide'})
        self.denied('message', OWNER, messageId=1, input={'operation': 'hide'})
        self.call('update', MASTER, input={'operation': 'final', 'messageId': 1})
        self.assertTrue(self.call('detail')['post']['messages'][0]['isFinal'])
        self.call('message', OTHER, messageId=1, input={'operation': 'hide'})
        self.assertEqual(self.call('detail')['post']['status'], 'waiting')
        self.assertEqual(self.call('detail')['post']['messages'], [])
        self.call('message', MASTER, messageId=1, input={'operation': 'restore'})
        self.assertEqual(self.call('detail')['post']['status'], 'active')
        notifications = self.call('list')['notifications']
        self.assertEqual(len(notifications), 2)
        self.call('notifications', OTHER, input={'notificationId': notifications[0]['id']})
        self.assertFalse(self.call('list')['notifications'][0]['read'])
        self.call('notifications', input={'all': True})
        self.assertTrue(all(n['read'] for n in self.call('list')['notifications']))
        self.assertEqual(self.call('list')['history'], [])
        self.assertGreaterEqual(len(self.call('list', MASTER)['history']), 5)

    def test_failed_mutation_does_not_change_stored_post(self):
        original = copy.deepcopy(self.call('detail')['post'])
        self.denied('update', OWNER, code='VALIDATION_FAILED', input={'title': '수정', 'bodyHtml': '<p></p>'})
        self.assertEqual(self.call('detail')['post'], original)
        self.denied('create', OWNER, code='VALIDATION_FAILED', input={'title': '', 'bodyHtml': '<p>x</p>'})
        self.assertEqual(len(self.call('list')['posts']), 1)

    def test_rich_html_sanitization(self):
        html, plain = body('<p onclick="bad()"><span data-qna-font-size="18" style="position:fixed">안전</span></p><script>alert(1)</script><svg onload="bad()"></svg><a href="javascript:bad()">링크</a><img src="data:image/svg+xml;base64,ABC" onerror="bad()"><table><tr><td colspan="2">표</td></tr></table>')
        for unsafe in ['onclick', '<script', '<svg', 'javascript:', 'onerror', 'style=', 'alert(1)', 'image/svg']:
            self.assertNotIn(unsafe, html)
        self.assertIn('data-qna-font-size="18"', html)
        self.assertIn('colspan="2"', html)
        self.assertIn('안전', plain)

    def test_setup_rejects_incompatible_existing_table_before_ddl(self):
        class ExistingTable:
            def __init__(self):
                self.statements = []

            def cursor(self):
                return self

            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def execute(self, sql, args=()):
                self.statements.append(sql)

            def fetchone(self):
                return {'engine': 'MyISAM'}

        connection = ExistingTable()
        with self.assertRaises(ValueError):
            create_tables(connection)
        self.assertFalse(any(sql.startswith('CREATE') for sql in connection.statements))

    def test_setup_preview_never_connects(self):
        result = subprocess.run([sys.executable, str(Path(__file__).with_name('create_voe_tables.py'))], capture_output=True, text=True, check=True)
        self.assertEqual(result.stdout.count('CREATE TABLE IF NOT EXISTS'), 2)
        self.assertNotIn('DROP ', result.stdout)


if __name__ == '__main__':
    unittest.main()
