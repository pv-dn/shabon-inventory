"""SQLite / PostgreSQL 共通ラッパー"""
import os
import sqlite3
from typing import Any

USE_POSTGRES = bool(os.environ.get("DATABASE_URL"))


class CompatCursor:
    def __init__(self, cursor, is_postgres: bool):
        self._cursor = cursor
        self._pg = is_postgres

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()


class CompatConnection:
    def __init__(self, conn, is_postgres: bool):
        self._conn = conn
        self._pg = is_postgres

    def execute(self, sql: str, params: tuple | list = ()):
        if self._pg:
            sql = sql.replace("?", "%s")
        cur = self._conn.cursor()
        cur.execute(sql, params)
        return CompatCursor(cur, self._pg)

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_raw_connection():
    if USE_POSTGRES:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(os.environ["DATABASE_URL"], cursor_factory=RealDictCursor)
        return conn, True
    from pathlib import Path

    data_dir = Path(__file__).parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(data_dir / "inventory.db")
    conn.row_factory = sqlite3.Row
    return conn, False


def get_connection() -> CompatConnection:
    conn, is_pg = get_raw_connection()
    return CompatConnection(conn, is_pg)


def insert_returning_id(conn: CompatConnection, sql: str, params: tuple) -> int:
    if USE_POSTGRES:
        sql_pg = sql.replace("?", "%s").rstrip().rstrip(";") + " RETURNING id"
        row = conn.execute(sql_pg, params).fetchone()
        return int(row["id"])
    conn.execute(sql, params)
    return int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
