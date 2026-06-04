# 固定URLで公開する手順（PCをサーバーにしない）

Cloudflare の一時URLは **お試し用** です。  
本番は **Render.com（クラウド）** に置きます。**あなたのPCは電源を切って大丈夫**です。

完成後のイメージ:

- 固定URL: `https://shabon-inventory-xxxx.onrender.com`（ずっと同じ）
- データ: クラウド上のデータベース（Neon・無料）
- 店舗: URLとパスワードだけ共有

所要時間: 約30〜45分（初回のみ）

---

## 準備するもの

- GitHub アカウント（無料）… https://github.com
- Render アカウント（無料）… https://render.com（GitHubでログイン可）
- Neon アカウント（無料DB）… https://neon.tech

---

## ステップ1: GitHub にプログラムを置く

### 方法A（画面でアップロード・おすすめ）

1. GitHub にログイン → 右上 **+** → **New repository**
2. 名前: `shabon-inventory` → **Create repository**
3. 画面の **uploading an existing file** をクリック
4. エクスプローラーで `shabon-inventory-app` を開き、次を **すべて選択してドラッグ**  
   （`.venv` フォルダだけは入れない）
   - `app.py`, `run.py`, `config.py`, `database.py`, `db_compat.py`
   - `import_excel.py`, `requirements.txt`, `render.yaml`, `Dockerfile`
   - `data` フォルダ（`products.json` を含む）
   - `frontend` フォルダ（`src` と `package.json`。`node_modules` は不要）
   - `static`, `templates`, `assets`, `scripts`
5. 下の **Commit changes**

### 方法B（コマンド）

`デプロイ.bat` → **1** → GitHub ログイン後、自動でアップロード

---

## ステップ2: Neon でデータベース（無料）

1. https://neon.tech でサインアップ
2. **New Project** → 名前は何でも可
3. **Connection string** をコピー（`postgresql://...` で始まる長い文字列）
4. メモ帳に貼り付けておく → これが `DATABASE_URL`

---

## ステップ3: Render で公開（固定URL）

1. https://render.com にログイン（**Sign in with GitHub**）
2. **New +** → **Blueprint**
3. **Connect** して、さきほどの `shabon-inventory` リポジトリを選ぶ
4. **Apply** の前に、環境変数を設定:

| 名前 | 値 |
|------|-----|
| `APP_PASSWORD` | 店舗共有用パスワード（例: `Shabon2026!`） |
| `DATABASE_URL` | ステップ2でコピーした文字列 |

5. **Apply** → デプロイ開始（5〜15分）
6. 完了後、画面上部の URL をコピー（例: `https://shabon-inventory.onrender.com`）

これが **固定URL** です。店舗にこのURLとパスワードを伝えます。

---

## ステップ4: 動作確認

1. 固定URLをブラウザで開く
2. パスワード画面 → `APP_PASSWORD` でログイン
3. 品目が表示されればOK（`products.json` から自動取込）

---

## 無料プランの注意（Render）

| 項目 | 内容 |
|------|------|
| スリープ | 15分使わないと一時停止。最初のアクセスで20秒ほど待つ |
| PC | **不要**（クラウドだけで動く） |
| データ | Neon に保存（PCを消しても残る） |

常時すぐ開きたい場合のみ、Render の有料プランを検討。

---

## あなたのPCでは何をする？

| 用途 | 操作 |
|------|------|
| 日常の在庫管理 | **固定URL** をブラウザで開く（`起動.bat` 不要） |
| Excelから品目を更新 | PCで Excel 編集 → GitHub に `data/products.json` を更新 → Render が自動再デプロイ |
| バックアップ | Render / Neon の管理画面、またはアプリ内データ |

**PCをサーバーにする必要はありません。**

---

## 困ったとき

| 症状 | 対処 |
|------|------|
| 502 エラー | Render の **Logs** タブを確認 |
| ログインできない | `APP_PASSWORD` を Render の Environment で確認 |
| 品目が空 | GitHub に `data/products.json` があるか確認 → 再デプロイ |
| 一時URL（trycloudflare）を使っていた | 本番は Render の固定URLに切り替え。PC常時起動は不要 |
