from datetime import datetime

from flask import Flask, jsonify, make_response, redirect, render_template, request, session, url_for

from config import APP_PASSWORD, SECRET_KEY
from database import get_connection, init_db, sync_products_from_json
from db_compat import insert_returning_id

app = Flask(__name__)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
app.secret_key = SECRET_KEY


@app.after_request
def disable_static_cache(response):
    if request.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    return response


@app.before_request
def ensure_db():
    if not getattr(app, "_db_ready", False):
        init_db()
        sync_products_from_json()
        app._db_ready = True


@app.before_request
def require_login():
    if not APP_PASSWORD:
        return
    if request.path.startswith("/static/"):
        return
    if request.path in ("/login", "/api/health"):
        return
    if session.get("authenticated"):
        return
    if request.path.startswith("/api/"):
        return jsonify({"error": "ログインが必要です"}), 401
    return redirect(url_for("login_page", next=request.path))


@app.route("/login", methods=["GET", "POST"])
def login_page():
    if not APP_PASSWORD:
        return redirect("/")
    error = None
    if request.method == "POST":
        if request.form.get("password") == APP_PASSWORD:
            session["authenticated"] = True
            return redirect(request.args.get("next") or "/")
        error = "パスワードが違います"
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login_page"))


def row_to_product(row):
    return {
        "id": row["id"],
        "code": row["code"],
        "name": row["name"],
        "spec": row["spec"] or "",
        "case_qty": row["case_qty"] or "",
        "retail_price": row["retail_price"],
        "member_price": row["member_price"],
        "quantity": row["quantity"],
        "min_stock": row["min_stock"] or 0,
        "note": row["note"] or "",
        "updated_at": row["updated_at"],
        "movement_count": row["movement_count"] if "movement_count" in row.keys() else 0,
        "last_movement_at": row["last_movement_at"] if "last_movement_at" in row.keys() else None,
    }


def parse_optional_price(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValueError("価格は整数で入力してください")


def parse_product_payload(data, *, require_all=False):
    fields = {}
    errors = []

    def require_text(key, label):
        if key not in data:
            if require_all:
                errors.append(f"{label}は必須です")
            return
        value = str(data.get(key) or "").strip()
        if not value:
            errors.append(f"{label}は必須です")
        else:
            fields[key] = value

    require_text("code", "商品コード")
    require_text("name", "商品名")

    if "spec" in data or require_all:
        fields["spec"] = str(data.get("spec") or "").strip()
    if "case_qty" in data or require_all:
        fields["case_qty"] = str(data.get("case_qty") or "").strip()
    if "note" in data or require_all:
        fields["note"] = str(data.get("note") or "").strip()

    if "min_stock" in data or require_all:
        try:
            fields["min_stock"] = max(0, int(data.get("min_stock") or 0))
        except (TypeError, ValueError):
            errors.append("補充下限は0以上の整数です")

    for key, label in (("retail_price", "一般価格"), ("member_price", "会員価格")):
        if key in data or require_all:
            try:
                fields[key] = parse_optional_price(data.get(key))
            except ValueError:
                errors.append(f"{label}は整数で入力してください")

    if errors:
        raise ValueError(errors[0])
    return fields


def code_exists(conn, code, exclude_id=None):
    sql = "SELECT id FROM products WHERE code = ?"
    params = [code]
    if exclude_id is not None:
        sql += " AND id != ?"
        params.append(exclude_id)
    return conn.execute(sql, params).fetchone() is not None


@app.route("/")
def index():
    resp = make_response(render_template("index.html", show_logout=bool(APP_PASSWORD)))
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp


@app.route("/api/products")
def api_products():
    q = request.args.get("q", "").strip()
    active_only = request.args.get("active_only") == "1"
    conn = get_connection()
    sql = """
        SELECT p.*,
               COUNT(m.id) AS movement_count,
               MAX(m.created_at) AS last_movement_at
        FROM products p
        LEFT JOIN movements m ON m.product_id = p.id
    """
    params = []
    if active_only:
        sql += " WHERE EXISTS (SELECT 1 FROM movements m2 WHERE m2.product_id = p.id)"
    else:
        sql += " WHERE 1=1"
    if q:
        sql += " AND (p.code LIKE ? OR p.name LIKE ? OR p.spec LIKE ?)"
        like = f"%{q}%"
        params.extend([like, like, like])
    sql += " GROUP BY p.id ORDER BY p.code"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return jsonify([row_to_product(r) for r in rows])


@app.route("/api/products/<int:product_id>")
def api_product(product_id):
    conn = get_connection()
    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "商品が見つかりません"}), 404
    return jsonify(row_to_product(row))


@app.route("/api/products/<int:product_id>/movements")
def api_product_movements(product_id):
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT m.*, p.code, p.name
        FROM movements m
        JOIN products p ON p.id = m.product_id
        WHERE m.product_id = ?
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 200
        """,
        (product_id,),
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/movements")
def api_movements():
    q = request.args.get("q", "").strip()
    conn = get_connection()
    sql = """
        SELECT m.*, p.code, p.name, p.spec
        FROM movements m
        JOIN products p ON p.id = m.product_id
        WHERE 1=1
    """
    params = []
    if q:
        sql += " AND (p.code LIKE ? OR p.name LIKE ? OR m.memo LIKE ?)"
        like = f"%{q}%"
        params.extend([like, like, like])
    sql += " ORDER BY m.created_at DESC, m.id DESC LIMIT 500"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/movements", methods=["POST"])
def api_create_movement():
    data = request.get_json(force=True)
    product_id = data.get("product_id")
    move_type = data.get("type", "").strip()
    quantity = data.get("quantity")
    memo = (data.get("memo") or "").strip()

    if move_type not in ("in", "out", "adjust"):
        return jsonify({"error": "種別は in / out / adjust のいずれかです"}), 400
    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        return jsonify({"error": "数量は整数で入力してください"}), 400
    if quantity <= 0 and move_type != "adjust":
        return jsonify({"error": "数量は1以上で入力してください"}), 400
    if move_type == "adjust" and quantity < 0:
        return jsonify({"error": "棚卸の在庫数は0以上です"}), 400

    conn = get_connection()
    product = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not product:
        conn.close()
        return jsonify({"error": "商品が見つかりません"}), 404

    before = product["quantity"]
    if move_type == "in":
        after = before + quantity
        delta = quantity
    elif move_type == "out":
        if before < quantity:
            conn.close()
            return jsonify({"error": f"在庫不足です（現在: {before}）"}), 400
        after = before - quantity
        delta = quantity
    else:
        after = quantity
        delta = abs(after - before)

    now = datetime.now().isoformat(timespec="seconds")
    conn.execute("UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?", (after, now, product_id))
    conn.execute(
        """
        INSERT INTO movements (product_id, type, quantity, before_qty, after_qty, memo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (product_id, move_type, delta, before, after, memo, now),
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    conn.close()
    return jsonify({"ok": True, "product": row_to_product(updated)})


@app.route("/api/products", methods=["POST"])
def api_create_product():
    data = request.get_json(force=True)
    try:
        fields = parse_product_payload(data, require_all=True)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    conn = get_connection()
    if code_exists(conn, fields["code"]):
        conn.close()
        return jsonify({"error": "同じ商品コードが既に登録されています"}), 400

    now = datetime.now().isoformat(timespec="seconds")
    product_id = insert_returning_id(
        conn,
        """
        INSERT INTO products (
            code, name, spec, case_qty, retail_price, member_price, min_stock, note, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            fields["code"],
            fields["name"],
            fields.get("spec", ""),
            fields.get("case_qty", ""),
            fields.get("retail_price"),
            fields.get("member_price"),
            fields.get("min_stock", 0),
            fields.get("note", ""),
            now,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    conn.close()
    return jsonify(row_to_product(row)), 201


@app.route("/api/products/<int:product_id>", methods=["PATCH"])
def api_update_product(product_id):
    data = request.get_json(force=True)
    conn = get_connection()
    product = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not product:
        conn.close()
        return jsonify({"error": "商品が見つかりません"}), 404

    try:
        fields = parse_product_payload(data, require_all=False)
    except ValueError as e:
        conn.close()
        return jsonify({"error": str(e)}), 400

    if "code" in fields and code_exists(conn, fields["code"], exclude_id=product_id):
        conn.close()
        return jsonify({"error": "同じ商品コードが既に登録されています"}), 400

    if not fields:
        conn.close()
        return jsonify(row_to_product(product))

    sets = ", ".join(f"{k} = ?" for k in fields)
    vals = list(fields.values()) + [datetime.now().isoformat(timespec="seconds"), product_id]
    conn.execute(f"UPDATE products SET {sets}, updated_at = ? WHERE id = ?", vals)
    conn.commit()
    updated = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    conn.close()
    return jsonify(row_to_product(updated))


@app.route("/api/products/<int:product_id>", methods=["DELETE"])
def api_delete_product(product_id):
    conn = get_connection()
    product = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not product:
        conn.close()
        return jsonify({"error": "商品が見つかりません"}), 404

    movement_count = conn.execute(
        "SELECT COUNT(*) AS c FROM movements WHERE product_id = ?", (product_id,)
    ).fetchone()["c"]
    conn.execute("DELETE FROM movements WHERE product_id = ?", (product_id,))
    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "deleted_movements": movement_count})


@app.route("/api/import", methods=["POST"])
def api_import():
    from import_excel import parse_excel, find_excel, PRODUCTS_JSON
    import json

    try:
        excel_path = find_excel(None)
        products = parse_excel(excel_path)
        PRODUCTS_JSON.parent.mkdir(parents=True, exist_ok=True)
        with PRODUCTS_JSON.open("w", encoding="utf-8") as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        added = sync_products_from_json()
        return jsonify({"ok": True, "count": len(products), "added": added, "file": str(excel_path)})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/health")
def api_health():
    return jsonify({"ok": True, "app": "shabon-inventory"})


@app.route("/api/summary")
def api_summary():
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) AS c FROM products").fetchone()["c"]
    low = conn.execute(
        "SELECT COUNT(*) AS c FROM products WHERE quantity <= min_stock AND min_stock > 0"
    ).fetchone()["c"]
    zero = conn.execute("SELECT COUNT(*) AS c FROM products WHERE quantity = 0").fetchone()["c"]
    active = conn.execute(
        "SELECT COUNT(DISTINCT product_id) AS c FROM movements"
    ).fetchone()["c"]
    conn.close()
    return jsonify({"total": total, "low_stock": low, "zero_stock": zero, "with_movements": active})


if __name__ == "__main__":
    from run import main

    main()
