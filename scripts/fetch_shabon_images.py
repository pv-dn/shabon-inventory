"""公式通販から未設定品目の画像を一括取得（CLI）"""
from database import get_connection, init_db
from shabon_images import fill_missing_product_images_batch


def main():
    init_db()
    conn = get_connection()
    total_updated = 0
    total_skipped = 0
    batch = 0
    while True:
        batch += 1
        stats = fill_missing_product_images_batch(conn, limit=12)
        total_updated += stats["updated"]
        total_skipped += stats["skipped"]
        print(
            f"batch {batch}: +{stats['updated']} skip {stats['skipped']} "
            f"remaining {stats['remaining']}"
        )
        if stats["failed"]:
            for f in stats["failed"]:
                print(f"  skip {f['code']} {f['name']}: {f['reason']}")
        if stats["done"]:
            break
    conn.close()
    print(f"done: {total_updated} updated, {total_skipped} skipped")


if __name__ == "__main__":
    main()
