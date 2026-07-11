import json
import os
from pathlib import Path

APP_DIR = Path(__file__).parent
CONFIG_PATH = APP_DIR / "config.json"

DEFAULTS = {
    "host": "127.0.0.1",
    "port": 5050,
    "open_browser": True,
}


def load_config() -> dict:
    if CONFIG_PATH.exists():
        with CONFIG_PATH.open(encoding="utf-8") as f:
            data = json.load(f)
        return {**DEFAULTS, **data}
    return dict(DEFAULTS)


CONFIG = load_config()

# クラウド（Fly.io / Render 等）では環境変数が優先
HOST = os.environ.get("HOST", CONFIG["host"])
PORT = int(os.environ.get("PORT", CONFIG["port"]))
OPEN_BROWSER = os.environ.get("OPEN_BROWSER", str(CONFIG.get("open_browser", True))).lower() in (
    "1",
    "true",
    "yes",
)


def is_cloud() -> bool:
    """Render / Fly.io / DATABASE_URL がある環境をクラウド扱いにする。"""
    return bool(
        os.environ.get("FLY_APP_NAME")
        or os.environ.get("RENDER")
        or os.environ.get("DATABASE_URL")
    )


IS_CLOUD = is_cloud()

# クラウド公開時は自動設定
if IS_CLOUD:
    HOST = os.environ.get("HOST", "0.0.0.0")
    OPEN_BROWSER = False

APP_PASSWORD = os.environ.get("APP_PASSWORD", "").strip()
SECRET_KEY = os.environ.get("SECRET_KEY", "shabon-local-dev-key-change-in-cloud")
