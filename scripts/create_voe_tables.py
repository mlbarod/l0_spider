"""VOE 테이블 2개를 생성합니다. 미리보기: 기본 실행, 실제 생성: --apply."""
import argparse
import sys

SCHEMA = (
    """CREATE TABLE IF NOT EXISTS spider_voe_posts (
        question_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        document LONGTEXT NOT NULL,
        summary MEDIUMTEXT NOT NULL,
        hidden TINYINT(1) NOT NULL DEFAULT 0,
        updated_at DATETIME(3) NOT NULL,
        INDEX idx_voe_posts_list (hidden, question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    """CREATE TABLE IF NOT EXISTS spider_voe_events (
        event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        question_id BIGINT UNSIGNED NOT NULL,
        actor_id VARCHAR(100) NOT NULL,
        actor_name VARCHAR(200) NOT NULL,
        action VARCHAR(40) NOT NULL,
        detail VARCHAR(255) NOT NULL DEFAULT '',
        recipient_id VARCHAR(100) NULL,
        read_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL,
        INDEX idx_voe_events_recipient (recipient_id, event_id),
        INDEX idx_voe_events_post (question_id),
        CONSTRAINT fk_voe_events_post FOREIGN KEY (question_id)
            REFERENCES spider_voe_posts (question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
)

EXPECTED_COLUMNS = {
    'spider_voe_posts': {'question_id': 'bigint', 'document': 'longtext', 'summary': 'mediumtext',
                         'hidden': 'tinyint', 'updated_at': 'datetime'},
    'spider_voe_events': {'event_id': 'bigint', 'question_id': 'bigint', 'actor_id': 'varchar',
                          'actor_name': 'varchar', 'action': 'varchar', 'detail': 'varchar',
                          'recipient_id': 'varchar', 'read_at': 'datetime', 'created_at': 'datetime'},
}


def create_tables(connection):
    with connection.cursor() as cursor:
        # 재실행은 허용하되, 같은 이름의 다른 테이블을 정상으로 간주하지 않습니다.
        for table, expected in EXPECTED_COLUMNS.items():
            cursor.execute('SELECT ENGINE AS engine FROM information_schema.TABLES '
                           'WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s', (table,))
            existing = cursor.fetchone()
            if existing is None:
                continue
            if str(existing['engine']).lower() != 'innodb':
                raise ValueError('Incompatible VOE table engine')
            cursor.execute('SELECT COLUMN_NAME AS name, DATA_TYPE AS type FROM information_schema.COLUMNS '
                           'WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s', (table,))
            actual = {row['name']: row['type'].lower() for row in cursor.fetchall()}
            if actual != expected:
                raise ValueError('Incompatible VOE table columns')
        for statement in SCHEMA:
            cursor.execute(statement)
    connection.commit()


def connect():
    import pymysql
    from notices import load_db_info
    config = load_db_info()
    return pymysql.connect(host=config['DB_HOST'], port=config['DB_PORT'],
                           user=config['DB_USER'], password=config['DB_PASSWORD'],
                           database=config['DB_NAME'], charset='utf8mb4',
                           cursorclass=pymysql.cursors.DictCursor,
                           connect_timeout=5, read_timeout=30, write_timeout=30)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='DB_INFO_PATH의 DB에 테이블을 생성합니다.')
    args = parser.parse_args()
    if not args.apply:
        print('-- 미리보기: DB에 접속하지 않습니다. 실제 생성은 --apply 옵션을 사용하세요.\n')
        print(';\n\n'.join(SCHEMA) + ';')
        return 0
    try:
        with connect() as connection:
            create_tables(connection)
        print('VOE 테이블 2개 생성 완료 (이미 존재하는 테이블과 데이터는 유지됩니다).')
        return 0
    except Exception:
        # DB 예외에는 호스트·계정 정보가 포함될 수 있으므로 출력하지 않습니다.
        print('테이블 생성 실패: DB 설정, 드라이버, 권한 및 기존 테이블 구조를 확인하세요. 일부 테이블이 생성되었을 수 있으며 재실행할 수 있습니다.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
