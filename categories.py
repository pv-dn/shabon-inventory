"""品目ジャンル（洗濯・洗顔・お風呂・ヘアケア・台所・手洗い・歯磨き・その他）"""

import json

CATEGORIES = [
    ("laundry", "洗濯"),
    ("face", "洗顔"),
    ("bath", "お風呂"),
    ("haircare", "ヘアケア"),
    ("kitchen", "台所"),
    ("hand", "手洗い"),
    ("tooth", "歯磨き"),
    ("other", "その他"),
]

CATEGORY_IDS = {c[0] for c in CATEGORIES}
CATEGORY_LABELS = {c[0]: c[1] for c in CATEGORIES}
DEFAULT_CATEGORY = "other"


def category_label(category_id: str) -> str:
    return CATEGORY_LABELS.get(category_id, category_id or CATEGORY_LABELS[DEFAULT_CATEGORY])


def is_valid_category(value: str) -> bool:
    return value in CATEGORY_IDS


def normalize_categories(cats) -> list[str]:
    seen: list[str] = []
    if not isinstance(cats, list):
        cats = [cats]
    for raw in cats:
        cat = (raw or "").strip()
        if cat and is_valid_category(cat) and cat not in seen:
            seen.append(cat)
    return seen if seen else [DEFAULT_CATEGORY]


def parse_categories(raw) -> list[str]:
    if raw is None:
        return [DEFAULT_CATEGORY]
    if isinstance(raw, list):
        return normalize_categories(raw)
    text = str(raw).strip()
    if not text:
        return [DEFAULT_CATEGORY]
    if text.startswith("["):
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return normalize_categories(data)
        except json.JSONDecodeError:
            pass
    if is_valid_category(text):
        return [text]
    return [DEFAULT_CATEGORY]


def serialize_categories(cats) -> str:
    return json.dumps(normalize_categories(cats), ensure_ascii=False)


def categories_label(cats) -> str:
    return "・".join(category_label(cat) for cat in normalize_categories(cats))


def resolve_categories_from_item(item: dict) -> list[str]:
    if "categories" in item and item["categories"]:
        if isinstance(item["categories"], list):
            return normalize_categories(item["categories"])
    raw = item.get("category")
    if isinstance(raw, list):
        return normalize_categories(raw)
    if isinstance(raw, str) and raw.strip().startswith("["):
        return parse_categories(raw)
    if isinstance(raw, str) and is_valid_category(raw.strip()):
        return [raw.strip()]
    return [guess_category(item.get("name", ""), item.get("code", ""))]


def guess_category(name: str, code: str = "") -> str:
    n = (name or "").strip()
    c = (code or "").strip()

    if not n or n in ("商品名", "商品コード 商品名"):
        return "other"
    if any(k in n for k in ("タオル", "スタイ", "ミニボトル", "N-33")):
        return "other"
    if n in ("ささやかギフト", "温もりギフト") or (
        "ギフト" in n and "洗濯" not in n and "台所" not in n and "ベビー" not in n and "シャボン" not in n
    ):
        return "other"

    if "ハミガキ" in n or "はみがき" in n:
        return "tooth"
    if "洗顔" in n or "フェイシャル" in n:
        return "face"
    if "洗濯ギフト" in n or ("洗濯" in n and "ギフト" in n):
        return "laundry"
    if "台所ギフト" in n or "台所" in n or "食器" in n or "ふきふき" in n:
        return "kitchen"
    if "シャンプー" in n or "リンス" in n or "シャポン" in n or "ヘア" in n:
        return "haircare"
    if "浴用" in n or "ボデイ" in n or "ビューティー" in n or "バブルガード" in n or "全身ケア" in n:
        return "bath"
    if "ギフト" in n:
        if "洗濯" in n:
            return "laundry"
        if "台所" in n:
            return "kitchen"
        return "bath"
    if any(
        k in n
        for k in (
            "スノール",
            "漂白",
            "粉せ",
            "粉の無添加",
            "洗たく槽",
            "EM液体洗濯",
        )
    ):
        return "laundry"
    if any(k in n for k in ("クレンサー", "重曹", "クエン酸", "野菜")):
        return "hand"
    if "ベビー" in n:
        return "bath"
    if "EM化粧" in n or "化粧石けん" in n or "化粧せつけん" in n:
        return "bath"

    if c.isdigit():
        prefix2 = c[:2] if len(c) >= 2 else c
        if prefix2 == "28":
            return "tooth"
        if c in ("3153", "3154", "3190", "3191"):
            return "face"
        if prefix2 in ("31", "32", "34"):
            return "bath"
        if prefix2 in ("15", "16") or c in ("1008", "1200", "1215"):
            return "laundry"
        if c.startswith("150") or c.startswith("160"):
            return "laundry"
        if prefix2 in ("10", "11", "17"):
            return "kitchen"
        if c == "2103":
            return "laundry"
        if c in ("2080", "2180", "2130", "1779"):
            return "kitchen"
        if c in ("2223", "2230"):
            return "laundry"
        if c in ("2245", "2250", "2260", "2270", "2271", "2272"):
            return "hand"
        if prefix2 == "24":
            return "bath"
        if prefix2 == "40":
            if "洗濯" in n:
                return "laundry"
            if "台所" in n:
                return "kitchen"
            return "bath"
        if prefix2 == "72":
            return "other"

    return DEFAULT_CATEGORY
