"""価格一覧 Excel から products.json を再生成するスクリプト"""
import json
import sys
from pathlib import Path

import pandas as pd

from categories import guess_category

APP_DIR = Path(__file__).parent
DATA_DIR = APP_DIR / "data"
PRODUCTS_JSON = DATA_DIR / "products.json"
DEFAULT_DESKTOP = Path.home() / "OneDrive" / "Desktop"


def norm(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip().replace("\n", " ")


def normalize_product_name(name: str) -> str:
    return (name or "").replace("せつけん", "石けん").replace("せっけん", "石けん")


def to_price(value):
    if pd.isna(value):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def is_product_code(code) -> bool:
    if pd.isna(code):
        return False
    text = str(int(code)) if isinstance(code, float) and code == int(code) else str(code).strip()
    return text.isdigit()


def find_excel(path: Path | None) -> Path:
    if path and path.exists():
        return path

    preferred = DEFAULT_DESKTOP / "しゃぼん玉せっけん　一覧.xlsx"
    if preferred.exists():
        return preferred

    patterns = [
        "しゃぼん玉せっけん　一覧.xlsx",
        "しゃぼん玉せっけん一覧.xlsx",
        "*しゃぼん*せっけん*一覧*.xlsx",
        "202505*価格一覧*.xlsx",
    ]
    candidates: list[Path] = []
    for pattern in patterns:
        for candidate in DEFAULT_DESKTOP.glob(pattern):
            if candidate.suffix.lower() != ".xlsx":
                continue
            if "コピー" in candidate.name or "~$" in candidate.name:
                continue
            if candidate not in candidates:
                candidates.append(candidate)

    if candidates:
        return max(candidates, key=lambda p: p.stat().st_mtime)

    raise FileNotFoundError(
        "価格一覧の Excel が見つかりません。"
        "デスクトップに「しゃぼん玉せっけん　一覧.xlsx」または"
        "「202505しゃぼん玉せっけん　価格一覧.xlsx」を置くか、パスを指定してください。"
    )


def read_product_sheet(excel_path: Path) -> pd.DataFrame:
    xl = pd.ExcelFile(excel_path)
    sheet = "Table 1" if "Table 1" in xl.sheet_names else xl.sheet_names[0]
    for header in (2, 3):
        df = pd.read_excel(excel_path, sheet_name=sheet, header=header)
        if "商品コード" in df.columns:
            return df
    raise ValueError(f"商品コード列が見つかりません: {excel_path}（シート: {sheet}）")


def parse_excel(excel_path: Path) -> list[dict]:
    df = read_product_sheet(excel_path)
    products = []
    current_name = ""

    for _, row in df.iterrows():
        code = row.get("商品コード")
        if not is_product_code(code):
            continue
        code = str(int(code)) if isinstance(code, float) else str(code).strip()

        name = norm(row.get("商品名"))
        if name:
            current_name = name

        spec = norm(row.get("規格"))
        case_qty = row.get("ケース\n入数")
        if pd.isna(case_qty):
            case_qty = ""
        elif isinstance(case_qty, float) and case_qty == int(case_qty):
            case_qty = str(int(case_qty))
        else:
            case_qty = str(case_qty)

        display_name = current_name
        if name == "詰替え用" and current_name:
            display_name = f"{current_name}（詰替え用）"
        elif name and name != current_name and name not in ("詰替え用",):
            display_name = f"{current_name}（{name}）" if current_name else name

        display_name = normalize_product_name(display_name)

        products.append(
            {
                "code": code,
                "name": display_name,
                "spec": spec,
                "case_qty": case_qty,
                "retail_price": to_price(row.get("一般価格\n（税込）")),
                "member_price": to_price(row.get("会員価格")),
                "category": guess_category(display_name, code),
            }
        )
    return products


def main():
    excel_arg = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    excel_path = find_excel(excel_arg)
    products = parse_excel(excel_path)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with PRODUCTS_JSON.open("w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    print(f"取込完了: {len(products)} 品目 → {PRODUCTS_JSON}")
    print(f"元ファイル: {excel_path}")


if __name__ == "__main__":
    main()
