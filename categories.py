"""品目ジャンル（洗濯・洗顔・お風呂・手洗い・歯磨き）"""

CATEGORIES = [
    ("laundry", "洗濯"),
    ("face", "洗顔"),
    ("bath", "お風呂"),
    ("hand", "手洗い"),
    ("tooth", "歯磨き"),
]

CATEGORY_IDS = {c[0] for c in CATEGORIES}
CATEGORY_LABELS = {c[0]: c[1] for c in CATEGORIES}
DEFAULT_CATEGORY = "bath"


def category_label(category_id: str) -> str:
    return CATEGORY_LABELS.get(category_id, category_id or CATEGORY_LABELS[DEFAULT_CATEGORY])


def is_valid_category(value: str) -> bool:
    return value in CATEGORY_IDS


def guess_category(name: str, code: str = "") -> str:
    n = (name or "").strip()
    c = (code or "").strip()

    if not n or n in ("商品名", "商品コード 商品名"):
        return DEFAULT_CATEGORY

    if "ハミガキ" in n or "はみがき" in n:
        return "tooth"
    if "洗顔" in n or "フェイシャル" in n:
        return "face"
    if "洗濯ギフト" in n or ("洗濯" in n and "ギフト" in n):
        return "laundry"
    if "台所ギフト" in n or "台所" in n or "食器" in n or "ふきふき" in n:
        return "hand"
    if "浴用" in n or "ボデイ" in n or "ビューティー" in n or "バブルガード" in n or "全身ケア" in n:
        return "bath"
    if "ギフト" in n:
        if "洗濯" in n:
            return "laundry"
        if "台所" in n:
            return "hand"
        return "bath"
    if "シャンプー" in n or "リンス" in n:
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
    if any(k in n for k in ("クレンサー", "重曹", "クエン酸", "台所用", "野菜")):
        return "hand"
    if any(k in n for k in ("タオル", "スタイ", "ミニボトル", "N-33")):
        return "bath"
    if "ベビー" in n:
        return "bath"
    if "EM化粧" in n or "化粧せつけん" in n:
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
            return "hand"
        if c == "2103":
            return "laundry"
        if c in ("2080", "2180", "2130", "1779"):
            return "hand"
        if c in ("2223", "2230", "2245", "2250", "2260", "2270", "2271", "2272"):
            return "laundry" if c in ("2223", "2230") else "hand"
        if prefix2 == "24":
            return "bath"
        if prefix2 == "40":
            if "洗濯" in n:
                return "laundry"
            if "台所" in n:
                return "hand"
            return "bath"
        if prefix2 == "72":
            return "bath"

    return DEFAULT_CATEGORY
