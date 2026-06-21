"""公式通販 (shabon.com) から商品画像を取得する。"""
from __future__ import annotations

import base64
import io
import os
import re
import time
import urllib.error
import urllib.request
from typing import Callable

from PIL import Image

SHABON_ITEM_URL = "https://www.shabon.com/shop/item/{code}"
PRODUCT_IMAGE_URLS = (
    "https://www.shabon.com/shop/f/resources/images/Product/{code}/main.jpg",
    "https://www.shabon.com/shop/resources/images/Product/{code}/main.jpg",
)
USER_AGENT = "ShabonInventory/1.0 (+internal store tool)"
MAX_IMAGE_URL_LEN = 300_000
FETCH_DELAY_SEC = 0.6 if not os.environ.get("RENDER") else 0.25
UNAVAILABLE_PREFIX = "unavailable:"
OFFICIAL_PREFIX = "official:"
MANUAL_PREFIX = "manual:"


def normalize_image_for_display(raw: str) -> str:
    if not raw:
        return ""
    if raw.startswith(UNAVAILABLE_PREFIX):
        return ""
    for prefix in (OFFICIAL_PREFIX, MANUAL_PREFIX):
        if raw.startswith(prefix):
            return raw[len(prefix) :]
    return raw


def mark_official_image(data_url: str) -> str:
    if data_url.startswith(OFFICIAL_PREFIX):
        return data_url
    return f"{OFFICIAL_PREFIX}{data_url}"


def mark_manual_image(data_url: str) -> str:
    if data_url.startswith(MANUAL_PREFIX):
        return data_url
    return f"{MANUAL_PREFIX}{data_url}"


def mark_unavailable(code: str) -> str:
    return f"{UNAVAILABLE_PREFIX}{code}"


def _needs_image_fetch_sql(overwrite: bool) -> str:
    if overwrite:
        return """
        WHERE image_url IS NULL
           OR image_url = ''
           OR (
             image_url NOT LIKE ?
             AND image_url NOT LIKE ?
             AND image_url NOT LIKE ?
           )
        """
    return """
        WHERE image_url IS NULL OR image_url = ''
        """


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


def _normalize_url(url: str) -> str:
    url = url.strip()
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return "https://www.shabon.com" + url
    return url


def _is_generic_image_url(url: str) -> bool:
    lower = url.lower()
    return any(
        token in lower
        for token in (
            "ogp.png",
            "/common/",
            "logo",
            "drawer_item",
            "img_fax",
            "side_cart",
            "globalsign",
        )
    )


def product_image_candidates(code: str) -> list[str]:
    code = str(code or "").strip()
    if not code:
        return []
    return [_normalize_url(t.format(code=code)) for t in PRODUCT_IMAGE_URLS]


def extract_image_url(html: str, code: str) -> str | None:
    code = str(code or "").strip()
    if code:
        m = re.search(
            rf'https?://[^"\']+/Product/{re.escape(code)}/main\.jpg',
            html,
            re.I,
        )
        if m:
            return m.group(0)

    for src in re.findall(r'<img[^>]+src="([^"]+)"', html, re.I):
        url = _normalize_url(src)
        if code and f"/product/{code.lower()}/" in url.lower() and "main.jpg" in url.lower():
            return url
        if code and f"/Product/{code}/" in url and not _is_generic_image_url(url):
            return url

    m = re.search(r'property="og:image"\s+content="([^"]+)"', html)
    if m:
        url = _normalize_url(m.group(1))
        if not _is_generic_image_url(url) and (not code or f"/Product/{code}/" in url):
            return url

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

    for url in product_image_candidates(code):
        raw = download_image_bytes(url)
        if raw:
            data_url = compress_to_data_url(raw)
            if data_url:
                return data_url, None

    page_url = SHABON_ITEM_URL.format(code=code)
    html = _fetch_html(page_url)
    if html:
        img_url = extract_image_url(html, code)
        if img_url:
            raw = download_image_bytes(img_url)
            if raw:
                data_url = compress_to_data_url(raw)
                if data_url:
                    return data_url, None
    else:
        return None, "公式HPにページなし"

    return None, "商品画像が見つかりません"


def _products_needing_images_sql(overwrite: bool) -> str:
    return f"""
        SELECT id, code, name
        FROM products
        {_needs_image_fetch_sql(overwrite)}
        ORDER BY code
        LIMIT ?
        """


def fill_missing_product_images_batch(
    conn,
    *,
    limit: int = 15,
    delay_sec: float = FETCH_DELAY_SEC,
    overwrite: bool = False,
) -> dict:
    """公式HPから商品画像を取得。overwrite=True ならロゴ等の既存画像も差し替え。"""
    limit = max(1, min(int(limit), 30))
    if overwrite:
        fetch_params = (
            f"{UNAVAILABLE_PREFIX}%",
            f"{OFFICIAL_PREFIX}%",
            f"{MANUAL_PREFIX}%",
        )
        rows = conn.execute(
            _products_needing_images_sql(True),
            (*fetch_params, limit),
        ).fetchall()
        remaining_row = conn.execute(
            f"""
            SELECT COUNT(*) AS c FROM products
            {_needs_image_fetch_sql(True)}
            """,
            fetch_params,
        ).fetchone()
    else:
        rows = conn.execute(
            _products_needing_images_sql(False),
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
        "overwrite": overwrite,
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
                (mark_official_image(data_url), now, product_id),
            )
            stats["updated"] += 1
        else:
            stats["skipped"] += 1
            stats["failed"].append({"code": code, "name": name, "reason": err or "不明"})
            if err in ("公式HPにページなし", "商品画像が見つかりません", "商品コードなし"):
                conn.execute(
                    "UPDATE products SET image_url = ?, updated_at = ? WHERE id = ?",
                    (mark_unavailable(code), now, product_id),
                )

        if delay_sec > 0:
            time.sleep(delay_sec)

    conn.commit()

    if overwrite:
        remaining_after_row = conn.execute(
            f"""
            SELECT COUNT(*) AS c FROM products
            {_needs_image_fetch_sql(True)}
            """,
            fetch_params,
        ).fetchone()
    else:
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
    overwrite: bool = False,
    on_progress: Callable[[dict], None] | None = None,
) -> dict:
    """image_url が空の品目（または overwrite 時は既存含む）を公式HPから取得。"""
    if overwrite:
        fetch_params = (
            f"{UNAVAILABLE_PREFIX}%",
            f"{OFFICIAL_PREFIX}%",
            f"{MANUAL_PREFIX}%",
        )
        rows = conn.execute(
            f"""
            SELECT id, code, name
            FROM products
            {_needs_image_fetch_sql(True)}
            ORDER BY code
            """,
            fetch_params,
        ).fetchall()
    else:
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
                (mark_official_image(data_url), now, product_id),
            )
            stats["updated"] += 1
            item = {"code": code, "name": name, "status": "ok"}
        else:
            stats["skipped"] += 1
            stats["failed"].append({"code": code, "name": name, "reason": err or "不明"})
            item = {"code": code, "name": name, "status": "skip", "reason": err}
            if err in ("公式HPにページなし", "商品画像が見つかりません", "商品コードなし"):
                conn.execute(
                    "UPDATE products SET image_url = ?, updated_at = ? WHERE id = ?",
                    (mark_unavailable(code), now, product_id),
                )

        if on_progress:
            on_progress(item)

        if delay_sec > 0:
            time.sleep(delay_sec)

    conn.commit()
    return stats
