"""公式通販 (shabon.com) から商品画像を取得する。"""
from __future__ import annotations

import base64
import io
import re
import time
import urllib.error
import urllib.request
from typing import Callable

from PIL import Image

SHABON_ITEM_URL = "https://www.shabon.com/shop/item/{code}"
USER_AGENT = "ShabonInventory/1.0 (+internal store tool)"
MAX_IMAGE_URL_LEN = 300_000
FETCH_DELAY_SEC = 0.6
UNAVAILABLE_PREFIX = "unavailable:"


def _fetch_html(url: str) -> str | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            if res.status != 200:
                return None
            return res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    except urllib.error.URLError:
        return None


def extract_image_url(html: str) -> str | None:
    m = re.search(r'property="og:image"\s+content="([^"]+)"', html)
    if m:
        return m.group(1).strip()
    m = re.search(r'content="([^"]+)"\s+property="og:image"', html)
    if m:
        return m.group(1).strip()
    for src in re.findall(r'<img[^>]+src="([^"]+)"', html, re.I):
        if "item" in src.lower() or "product" in src.lower():
            if src.startswith("//"):
                return "https:" + src
            if src.startswith("/"):
                return "https://www.shabon.com" + src
            if src.startswith("http"):
                return src
    return None


def download_image_bytes(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            data = res.read()
            if len(data) < 100:
                return None
            return data
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return None


def compress_to_data_url(raw: bytes, *, max_bytes: int = 200_000) -> str | None:
    try:
        img = Image.open(io.BytesIO(raw))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        elif img.mode == "L":
            img = img.convert("RGB")

        max_width = 480
        w, h = img.size
        if max(w, h) > max_width:
            scale = max_width / max(w, h)
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)

        quality = 82
        while quality >= 40:
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            if buf.tell() <= max_bytes:
                break
            quality -= 8

        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        data_url = f"data:image/jpeg;base64,{b64}"
        if len(data_url) > MAX_IMAGE_URL_LEN:
            return None
        return data_url
    except Exception:
        return None


def fetch_official_image_for_code(code: str) -> tuple[str | None, str | None]:
    """Returns (data_url, error_message). error_message is set when skipped/failed."""
    code = str(code or "").strip()
    if not code:
        return None, "商品コードなし"

    page_url = SHABON_ITEM_URL.format(code=code)
    html = _fetch_html(page_url)
    if not html:
        return None, "公式HPにページなし"

    img_url = extract_image_url(html)
    if not img_url:
        return None, "画像URLが見つかりません"

    raw = download_image_bytes(img_url)
    if not raw:
        return None, "画像の取得に失敗"

    data_url = compress_to_data_url(raw)
    if not data_url:
        return None, "画像の圧縮に失敗"

    return data_url, None


def fill_missing_product_images_batch(
    conn,
    *,
    limit: int = 15,
    delay_sec: float = FETCH_DELAY_SEC,
) -> dict:
    """image_url が空の品目から limit 件だけ取得（タイムアウト回避用）。"""
    limit = max(1, min(int(limit), 30))
    rows = conn.execute(
        """
        SELECT id, code, name
        FROM products
        WHERE image_url IS NULL OR image_url = ''
        ORDER BY code
        LIMIT ?
        """,
        (limit,),
    ).fetchall()

    remaining_row = conn.execute(
        """
        SELECT COUNT(*) AS c FROM products
        WHERE image_url IS NULL OR image_url = ''
        """
    ).fetchone()
    remaining_before = remaining_row["c"]

    from datetime import datetime

    now = datetime.now().isoformat(timespec="seconds")
    stats = {
        "batch_size": len(rows),
        "updated": 0,
        "skipped": 0,
        "remaining_before": remaining_before,
        "failed": [],
    }

    for row in rows:
        product_id = row["id"]
        code = row["code"]
        name = row["name"]

        data_url, err = fetch_official_image_for_code(code)
        if data_url:
            conn.execute(
                "UPDATE products SET image_url = ?, updated_at = ? WHERE id = ?",
                (data_url, now, product_id),
            )
            stats["updated"] += 1
        else:
            stats["skipped"] += 1
            stats["failed"].append({"code": code, "name": name, "reason": err or "不明"})
            if err == "公式HPにページなし":
                conn.execute(
                    "UPDATE products SET image_url = ?, updated_at = ? WHERE id = ?",
                    (f"{UNAVAILABLE_PREFIX}{code}", now, product_id),
                )

        if delay_sec > 0:
            time.sleep(delay_sec)

    conn.commit()

    remaining_after_row = conn.execute(
        """
        SELECT COUNT(*) AS c FROM products
        WHERE image_url IS NULL OR image_url = ''
        """
    ).fetchone()
    stats["remaining"] = remaining_after_row["c"]
    stats["done"] = stats["remaining"] == 0
    return stats


def fill_missing_product_images(
    conn,
    *,
    delay_sec: float = FETCH_DELAY_SEC,
    on_progress: Callable[[dict], None] | None = None,
) -> dict:
    """image_url が空の品目だけ公式HPから画像を取得して保存。"""
    rows = conn.execute(
        """
        SELECT id, code, name
        FROM products
        WHERE image_url IS NULL OR image_url = ''
        ORDER BY code
        """
    ).fetchall()

    from datetime import datetime

    now = datetime.now().isoformat(timespec="seconds")
    stats = {"total": len(rows), "updated": 0, "skipped": 0, "failed": []}

    for row in rows:
        product_id = row["id"]
        code = row["code"]
        name = row["name"]

        data_url, err = fetch_official_image_for_code(code)
        if data_url:
            conn.execute(
                "UPDATE products SET image_url = ?, updated_at = ? WHERE id = ?",
                (data_url, now, product_id),
            )
            stats["updated"] += 1
            item = {"code": code, "name": name, "status": "ok"}
        else:
            stats["skipped"] += 1
            stats["failed"].append({"code": code, "name": name, "reason": err or "不明"})
            item = {"code": code, "name": name, "status": "skip", "reason": err}

        if on_progress:
            on_progress(item)

        if delay_sec > 0:
            time.sleep(delay_sec)

    conn.commit()
    return stats
