import json
import sqlite3
from datetime import datetime
from pathlib import Path

from categories import (
    DEFAULT_CATEGORY,
    guess_category,
    parse_categories,
    resolve_categories_from_item,
    serialize_categories,
)
from db_compat import USE_POSTGRES, get_connection

APP_DIR = Path(__file__).parent
DATA_DIR = APP_DIR / "data"
DB_PATH = DATA_DIR / "inventory.db"
PRODUCTS_JSON = DATA_DIR / "products.json"

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    spec TEXT,
    case_qty TEXT,
    retail_price INTEGER,
    member_price INTEGER,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    note TEXT,
    category TEXT NOT NULL DEFAULT 'bath',
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    before_qty INTEGER NOT NULL,
    after_qty INTEGER NOT NULL,
    memo TEXT,
    created_at TEXT NOT NULL,
    cancelled_at TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at);
"""

POSTGRES_SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    spec TEXT,
    case_qty TEXT,
    retail_price INTEGER,
    member_price INTEGER,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    note TEXT,
    category TEXT NOT NULL DEFAULT 'bath',
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    before_qty INTEGER NOT NULL,
    after_qty INTEGER NOT NULL,
    memo TEXT,
    created_at TEXT NOT NULL,
    cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at);
"""


def backfill_categories(conn):
    rows = conn.execute("SELECT id, code, name FROM products").fetchall()
    for row in rows:
        cat = serialize_categories([guess_category(row["name"], row["code"])])
        conn.execute("UPDATE products SET category = ? WHERE id = ?", (cat, row["id"]))


def migrate_add_category(conn):
    added = False
    if USE_POSTGRES:
        cur = conn._conn.cursor()
        cur.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'products' AND column_name = 'category'
            """
        )
        if not cur.fetchone():
            conn.execute(
                "ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'bath'"
            )
            added = True
        cur.close()
    else:
        try:
            conn.execute(
                "ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'bath'"
            )
            added = True
        except sqlite3.OperationalError:
            pass
    if added:
        backfill_categories(conn)
    conn.commit()


def migrate_add_cancelled_at(conn):
    if USE_POSTGRES:
        cur = conn._conn.cursor()
        cur.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'movements' AND column_name = 'cancelled_at'
            """
        )
        if not cur.fetchone():
            conn.execute("ALTER TABLE movements ADD COLUMN cancelled_at TEXT")
        cur.close()
    else:
        try:
            conn.execute("ALTER TABLE movements ADD COLUMN cancelled_at TEXT")
        except sqlite3.OperationalError:
            pass
    conn.commit()


def migrate_add_image_url(conn):
    if USE_POSTGRES:
        cur = conn._conn.cursor()
        cur.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'products' AND column_name = 'image_url'
            """
        )
        if not cur.fetchone():
            conn.execute("ALTER TABLE products ADD COLUMN image_url TEXT")
        cur.close()
    else:
        try:
            conn.execute("ALTER TABLE products ADD COLUMN image_url TEXT")
        except sqlite3.OperationalError:
            pass
    conn.commit()


def migrate_categories_to_json(conn):
    rows = conn.execute("SELECT id, category FROM products").fetchall()
    changed = False
    for row in rows:
        raw = row["category"] or ""
        if not str(raw).strip().startswith("["):
            serialized = serialize_categories(parse_categories(raw))
            conn.execute("UPDATE products SET category = ? WHERE id = ?", (serialized, row["id"]))
            changed = True
    if changed:
        conn.commit()


def init_db():
    conn = get_connection()
    schema = POSTGRES_SCHEMA if USE_POSTGRES else SQLITE_SCHEMA
    for stmt in schema.strip().split(";"):
        stmt = stmt.strip()
        if stmt:
            conn.execute(stmt)
    migrate_add_category(conn)
    migrate_add_cancelled_at(conn)
    migrate_add_image_url(conn)
    migrate_categories_to_json(conn)
    conn.close()


def resolve_category(item: dict) -> str:
    return serialize_categories(resolve_categories_from_item(item))


def load_products_from_json():
    if not PRODUCTS_JSON.exists():
        return []
    with PRODUCTS_JSON.open(encoding="utf-8") as f:
        return json.load(f)


def sync_products_from_json():
    items = load_products_from_json()
    if not items:
        return 0
    conn = get_connection()
    now = datetime.now().isoformat(timespec="seconds")
    added = 0
    for item in items:
        existing = conn.execute(
            "SELECT id FROM products WHERE code = ?", (item["code"],)
        ).fetchone()
        if existing:
            row = conn.execute(
                "SELECT retail_price, member_price FROM products WHERE code = ?",
                (item["code"],),
            ).fetchone()
            retail_price = item.get("retail_price")
            member_price = item.get("member_price")
            if retail_price is None:
                retail_price = row["retail_price"]
            if member_price is None:
                member_price = row["member_price"]
            cat = resolve_category(item)
            conn.execute(
                """
                UPDATE products
                SET name = ?, spec = ?, case_qty = ?,
                    retail_price = ?, member_price = ?, category = ?, updated_at = ?
                WHERE code = ?
                """,
                (
                    item["name"],
                    item.get("spec", ""),
                    item.get("case_qty", ""),
                    retail_price,
                    member_price,
                    cat,
                    now,
                    item["code"],
                ),
            )
        else:
            cat = resolve_category(item)
            conn.execute(
                """
                INSERT INTO products (
                    code, name, spec, case_qty, retail_price, member_price, category, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["code"],
                    item["name"],
                    item.get("spec", ""),
                    item.get("case_qty", ""),
                    item.get("retail_price"),
                    item.get("member_price"),
                    cat,
                    now,
                ),
            )
            added += 1
    conn.commit()
    conn.close()
    return added
