import json
from datetime import datetime
from pathlib import Path

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
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at);
"""


def init_db():
    conn = get_connection()
    schema = POSTGRES_SCHEMA if USE_POSTGRES else SQLITE_SCHEMA
    for stmt in schema.strip().split(";"):
        stmt = stmt.strip()
        if stmt:
            conn.execute(stmt)
    conn.commit()
    conn.close()


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
            conn.execute(
                """
                UPDATE products
                SET name = ?, spec = ?, case_qty = ?,
                    retail_price = ?, member_price = ?, updated_at = ?
                WHERE code = ?
                """,
                (
                    item["name"],
                    item.get("spec", ""),
                    item.get("case_qty", ""),
                    retail_price,
                    member_price,
                    now,
                    item["code"],
                ),
            )
        else:
            conn.execute(
                """
                INSERT INTO products (code, name, spec, case_qty, retail_price, member_price, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["code"],
                    item["name"],
                    item.get("spec", ""),
                    item.get("case_qty", ""),
                    item.get("retail_price"),
                    item.get("member_price"),
                    now,
                ),
            )
            added += 1
    conn.commit()
    conn.close()
    return added
