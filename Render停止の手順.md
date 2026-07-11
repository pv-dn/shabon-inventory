# Render サービス停止手順（移行後）

Fly.io（`https://shabon-inventory.fly.dev`）でログイン・在庫確認ができてから実行してください。

1. https://dashboard.render.com を開く
2. サービス **shabon-inventory** を選択
3. **Suspend**（または Delete）
4. 店舗には旧URL `https://shabon-inventory.onrender.com` を案内しない

GitHub の Keep-alive（Render向け）ワークフローは削除済みです。
