"""VOE 저장소. 게시글 행 잠금 안에서 답변·상태·이력을 함께 저장합니다."""
import copy
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
import json
import re
import sys

from create_voe_tables import connect

REMOVED_POST_FIELDS = {'category', 'line', 'lineName', 'tags', 'process', 'department', 'type', 'searchText'}
STATUSES = {'waiting', 'active', 'completed'}
ACTIONS = {'created': '질문 등록', 'edited': '질문 수정', 'hide': '질문 삭제',
           'restore': '질문 복구', 'status': '상태 변경', 'final': '최종 답변 지정',
           'reply': '답변 등록', 'reply_edited': '답변 수정', 'reply_hide': '답변 삭제', 'reply_restore': '답변 복구'}


class BoardError(Exception):
    def __init__(self, code):
        self.code = code


def require(condition, code='VALIDATION_FAILED'):
    if not condition:
        raise BoardError(code)


class SafeHTML(HTMLParser):
    tags = set('p br strong b em i u s blockquote ul ol li h1 h2 h3 h4 pre code div span a img table tbody thead tr th td colgroup col hr'.split())
    voids = {'br', 'img', 'hr', 'col'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output, self.text, self.stack = [], [], []
        self.blocked = 0

    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style', 'iframe', 'object', 'svg', 'math'}:
            self.blocked += 1
            return
        if self.blocked or tag not in self.tags:
            return
        safe = []
        for key, value in attrs:
            value = value or ''
            if key in {'alt', 'title'}:
                safe.append((key, value))
            elif key == 'data-qna-font-size' and value in {'8','9','10','11','12','14','16','18','20','24','28','32','36'}:
                safe.append((key, value))
            elif tag in {'td','th','col'} and key in {'colspan','rowspan','span','width'} and re.fullmatch(r'[1-9][0-9]{0,3}', value):
                safe.append((key, value))
            elif tag == 'a' and key == 'href' and re.match(r'^https?://', value, re.I) and not re.search(r'[\x00-\x20]', value):
                safe.append((key, value))
            elif tag == 'img' and key == 'src' and (re.fullmatch(r'data:image/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\s]+', value) or re.match(r'^https?://[^\s]+$', value)):
                safe.append((key, value))
        if tag == 'a':
            safe.append(('rel', 'noopener noreferrer'))
        self.output.append('<' + tag + ''.join(f' {k}="{escape(v, quote=True)}"' for k, v in safe) + '>')
        if tag not in self.voids:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in {'script', 'style', 'iframe', 'object', 'svg', 'math'}:
            self.blocked = max(0, self.blocked - 1)
        elif not self.blocked and tag in self.stack:
            while self.stack:
                current = self.stack.pop()
                self.output.append(f'</{current}>')
                if current == tag:
                    break
            self.text.append(' ')

    def handle_data(self, data):
        if not self.blocked:
            self.output.append(escape(data))
            self.text.append(data)


def body(value):
    require(isinstance(value, str))
    require(len(value.encode()) <= 15 * 1024 * 1024, 'BODY_TOO_LARGE')
    parser = SafeHTML()
    parser.feed(value)
    for tag in reversed(parser.stack):
        parser.output.append(f'</{tag}>')
    text = ''.join(parser.text).strip()
    require(bool(text))
    return ''.join(parser.output), text


def text(value, maximum):
    require(isinstance(value, str) and 0 < len(value.strip()) <= maximum)
    return value.strip()


def now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def serialized(post, actor, summary=False):
    result = copy.deepcopy({key: value for key, value in post.items() if key not in REMOVED_POST_FIELDS})
    if actor['role'] != 'master':
        result['messages'] = [m for m in result['messages'] if not m.get('hidden')]
    if summary:
        result['content'] = ''
        for message in result['messages']:
            message.pop('content', None)
            message['body'] = message.get('body', '')[:200]
        result['detailLoaded'] = False
    return result


def save(cursor, post):
    for key in REMOVED_POST_FIELDS:
        post.pop(key, None)
    document = json.dumps(post, ensure_ascii=False)
    require(len(document.encode()) <= 48 * 1024 * 1024, 'BODY_TOO_LARGE')
    summary = serialized(post, {'role': 'master'}, True)
    cursor.execute('UPDATE spider_voe_posts SET document=%s, summary=%s, hidden=%s, updated_at=UTC_TIMESTAMP(3) WHERE question_id=%s',
                   (document, json.dumps(summary, ensure_ascii=False), int(post.get('hidden', False)), post['questionId']))


def events(cursor, actor):
    cursor.execute("SELECT e.*, JSON_UNQUOTE(JSON_EXTRACT(p.summary, '$.title')) AS title, JSON_UNQUOTE(JSON_EXTRACT(p.summary, '$.id')) AS post_id FROM spider_voe_events e JOIN spider_voe_posts p ON p.question_id=e.question_id WHERE e.recipient_id=%s AND p.hidden=0 ORDER BY e.event_id DESC LIMIT 500", (actor['userId'],))
    notifications = []
    for row in cursor.fetchall():
        notifications.append({'id': str(row['event_id']), 'postId': row['post_id'], 'title': ACTIONS.get(row['action'], row['action']), 'detail': row['title'],
                              'time': row['created_at'].isoformat() + 'Z', 'read': row['read_at'] is not None, 'icon': 'reply' if row['action'] == 'reply' else 'complete'})
    history = []
    if actor['role'] == 'master':
        cursor.execute("SELECT e.*, JSON_UNQUOTE(JSON_EXTRACT(p.summary, '$.title')) AS title, JSON_UNQUOTE(JSON_EXTRACT(p.summary, '$.id')) AS post_id FROM spider_voe_events e JOIN spider_voe_posts p ON p.question_id=e.question_id ORDER BY e.event_id DESC LIMIT 500")
        history = [{'id': str(r['event_id']), 'targetName': r['title'], 'actor': r['actor_name'], 'action': ACTIONS.get(r['action'], r['action']),
                    'detail': r['detail'], 'occurredAt': r['created_at'].isoformat() + 'Z'} for r in cursor.fetchall()]
    return {'notifications': notifications, 'history': history}


def event(cursor, post, actor, action, detail=''):
    recipient = post['authorUserId'] if action in {'reply','status','final'} and post['authorUserId'] != actor['userId'] else None
    cursor.execute('INSERT INTO spider_voe_events (question_id,actor_id,actor_name,action,detail,recipient_id,created_at) VALUES (%s,%s,%s,%s,%s,%s,UTC_TIMESTAMP(3))',
                   (post['questionId'], actor['userId'], actor['displayName'], action, detail, recipient))


def apply_change(post, action, data, actor, message_id=None):
    master = actor['role'] == 'master'
    owner = post['authorUserId'] == actor['userId']
    operation = data.get('operation', 'edit')
    if post.get('hidden'):
        require(master and action == 'update' and operation == 'restore', 'QNA_NOT_FOUND')
    stamp = now()
    if action == 'reply':
        html, plain = body(data.get('bodyHtml'))
        mid = max([m['messageId'] for m in post['messages']] + [0]) + 1
        post['messages'].append({'id': str(mid), 'messageId': mid, 'author': actor['displayName'], 'authorUserId': actor['userId'],
                                 'role': '질문자' if owner else '답변·댓글', 'time': stamp, 'body': plain, 'content': html, 'hidden': False, 'isFinal': False})
        if post['status'] == 'waiting':
            post['status'] = 'active'
        label = 'reply'
    elif action == 'message':
        message = next((m for m in post['messages'] if m['messageId'] == message_id), None)
        require(message is not None, 'QNA_NOT_FOUND')
        require(master or message['authorUserId'] == actor['userId'], 'QNA_FORBIDDEN')
        require(not message.get('hidden') or (master and operation == 'restore'), 'QNA_NOT_FOUND')
        if operation == 'restore':
            require(master, 'QNA_FORBIDDEN')
            message['hidden'] = False
            if post['status'] == 'waiting':
                post['status'] = 'active'
        elif operation == 'hide':
            message['hidden'] = True
            if message.get('isFinal'):
                message['isFinal'] = False
                post['status'] = 'active' if any(not m.get('hidden') for m in post['messages']) else 'waiting'
        else:
            require(operation == 'edit')
            message['content'], message['body'] = body(data.get('bodyHtml'))
        label = 'reply_' + ('edited' if operation == 'edit' else operation)
    else:
        require(action == 'update')
        if operation == 'view':
            post['views'] += 1
            return None
        if operation in {'status', 'final', 'restore'}:
            require(master, 'QNA_FORBIDDEN')
        else:
            require(master or owner, 'QNA_FORBIDDEN')
        if operation == 'status':
            require(data.get('status') in STATUSES)
            post['status'] = data['status']
            if post['status'] != 'completed':
                for m in post['messages']:
                    m['isFinal'] = False
        elif operation == 'final':
            require(any(m['messageId'] == data.get('messageId') and not m.get('hidden') for m in post['messages']), 'QNA_NOT_FOUND')
            for m in post['messages']:
                m['isFinal'] = m['messageId'] == data['messageId']
            post['status'] = 'completed'
        elif operation == 'hide':
            require(master or not any(not m.get('hidden') for m in post['messages']), 'QNA_FORBIDDEN')
            post.update(hidden=True, hiddenAt=stamp, hiddenBy=actor['displayName'])
        elif operation == 'restore':
            post.update(hidden=False, hiddenAt=None, hiddenBy=None)
        else:
            require(operation == 'edit')
            post['title'] = text(data.get('title'), 255)
            post['content'], plain = body(data.get('bodyHtml'))
            post['excerpt'] = plain[:100]
        label = 'edited' if operation == 'edit' else operation
    post['updatedAt'] = stamp
    return label


def execute(connection, payload):
    action, actor = payload['action'], payload['actor']
    data = payload.get('input') or {}
    require(actor.get('role') in {'master','general'}, 'QNA_FORBIDDEN')
    with connection.cursor() as cursor:
        if action == 'list':
            cursor.execute('SELECT summary FROM spider_voe_posts ' + ('' if actor['role'] == 'master' else 'WHERE hidden=0 ') + 'ORDER BY question_id DESC')
            return {'posts': [serialized(json.loads(r['summary']), actor, True) for r in cursor.fetchall()], **events(cursor, actor)}
        if action == 'notifications':
            if data.get('all') is True:
                cursor.execute('UPDATE spider_voe_events SET read_at=UTC_TIMESTAMP(3) WHERE recipient_id=%s AND read_at IS NULL', (actor['userId'],))
            else:
                notification_id = str(data.get('notificationId', ''))
                require(notification_id.isdigit())
                cursor.execute('UPDATE spider_voe_events SET read_at=UTC_TIMESTAMP(3) WHERE recipient_id=%s AND event_id=%s', (actor['userId'], notification_id))
            return events(cursor, actor)
        if action == 'create':
            title = text(data.get('title'), 255)
            html, plain = body(data.get('bodyHtml'))
            cursor.execute("INSERT INTO spider_voe_posts (document,summary,updated_at) VALUES ('{}','{}',UTC_TIMESTAMP(3))")
            qid = cursor.lastrowid
            stamp = now()
            post = {'id': f'VOE-{qid:05d}', 'questionId': qid, 'title': title, 'content': html, 'excerpt': plain[:100],
                    'status': 'waiting', 'author': actor['displayName'],
                    'authorUserId': actor['userId'], 'createdAt': stamp, 'updatedAt': stamp, 'views': 0, 'messages': [], 'attachments': [], 'hidden': False, 'detailLoaded': True}
            save(cursor, post)
            event(cursor, post, actor, 'created')
        else:
            cursor.execute('SELECT document FROM spider_voe_posts WHERE question_id=%s FOR UPDATE', (payload['questionId'],))
            row = cursor.fetchone()
            require(row is not None, 'QNA_NOT_FOUND')
            post = json.loads(row['document'])
            if action == 'detail':
                require(not post.get('hidden') or actor['role'] == 'master', 'QNA_NOT_FOUND')
                return {'post': serialized(post, actor)}
            label = apply_change(post, action, data, actor, payload.get('messageId'))
            save(cursor, post)
            if label:
                event(cursor, post, actor, label, data.get('status', ''))
        return {'post': serialized(post, actor), **events(cursor, actor)}


def main():
    try:
        payload = json.load(sys.stdin)
        with connect() as connection:
            try:
                result = execute(connection, payload)
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        print(json.dumps({'ok': True, **result}, ensure_ascii=False))
    except BoardError as error:
        print(json.dumps({'ok': False, 'code': error.code}))
    except Exception:
        print(json.dumps({'ok': False, 'code': 'DB_FAILED'}))


if __name__ == '__main__':
    main()
