"""products.json に category を付与"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from categories import guess_category  # noqa: E402

path = ROOT / "data" / "products.json"
items = json.loads(path.read_text(encoding="utf-8"))
for item in items:
    item["category"] = guess_category(item.get("name", ""), item.get("code", ""))
path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Tagged {len(items)} products")
