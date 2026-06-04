"""本番用起動エントリ（Waitress）"""
import webbrowser

from waitress import serve

from app import app
from config import HOST, OPEN_BROWSER, PORT
from database import init_db, sync_products_from_json


def main():
    init_db()
    sync_products_from_json()

    display_host = "127.0.0.1" if HOST in ("0.0.0.0", "::") else HOST
    url = f"http://{display_host}:{PORT}"

    print("=" * 50)
    print("  しゃぼん玉せっけん 在庫管理")
    print(f"  起動中: {url}")
    if HOST == "0.0.0.0":
        print("  同一ネットワーク内の他PCからもアクセス可能です")
    print("  終了するにはこの窓を閉じるか、停止.bat を実行")
    print("=" * 50)

    if OPEN_BROWSER:
        webbrowser.open(url)

    serve(app, host=HOST, port=PORT, threads=4)


if __name__ == "__main__":
    main()
