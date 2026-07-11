# 固定URLで公開する手順（PCをサーバーにしない）

本番は **Fly.io（クラウド）+ Neon（無料DB）** です。  
**あなたのPCは電源を切って大丈夫**です。

完成後のイメージ:

- 固定URL: `https://shabon-inventory.fly.dev`（ずっと同じ）
- データ: クラウド上のデータベース（Neon・無料）
- 店舗: URLとパスワードだけ共有

所要時間: 約30〜45分（初回のみ）

---

## 準備するもの

- GitHub アカウント（無料）… https://github.com
- Fly.io アカウント（無料）… https://fly.io（GitHubでログイン可）
- Neon アカウント（無料DB）… https://neon.tech
- Fly CLI（`flyctl`）… 下のステップでインストール

---

## ステップ1: flyctl を入れる

PowerShell で:

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

新しいターミナルを開き、`flyctl version` で確認。

---

## ステップ2: GitHub にプログラムを置く

### 方法A（自動・おすすめ）

`デプロイ.bat` → **1**（Auto deploy to Fly.io）

### 方法B（手動）

1. GitHub にログイン → リポジトリ `shabon-inventory`（既存ならそのまま）
2. このフォルダの変更を push

---

## ステップ3: Neon でデータベース（無料）

1. https://neon.tech でサインアップ
2. **New Project** → 名前は何でも可
3. **Connection string** をコピー（`postgresql://...` で始まる長い文字列）
4. メモ帳に貼り付けておく → これが `DATABASE_URL`

### Render からデータを移す場合

Render の旧DBに在庫が入っているときだけ:

```powershell
$env:RENDER_DATABASE_URL = "（Renderの接続文字列）"
$env:NEON_DATABASE_URL = "（Neonの接続文字列）"
powershell -File scripts\migrate_db_to_neon.ps1
```

初回で品目が空でも、`data/products.json` から自動取込されます。

---

## ステップ4: Fly.io で公開（固定URL）

1. `flyctl auth login`（ブラウザでログイン）
2. secrets を設定:

```powershell
powershell -File scripts\set_fly_secrets.ps1
```

（`APP_PASSWORD=haizi814` / `DATABASE_URL` / `SECRET_KEY` が登録されます）

3. デプロイ:

```powershell
flyctl deploy -a shabon-inventory --remote-only
```

または `デプロイ.bat` → **1**

4. 完了後のURL: **https://shabon-inventory.fly.dev**

これが **固定URL** です。店舗にこのURLとパスワードを伝えます。

---

## ステップ5: 動作確認

1. 固定URLをブラウザで開く
2. パスワード画面 → **`haizi814`** でログイン
3. 品目が表示されればOK

---

## 無料プランの注意（Fly.io）

| 項目 | 内容 |
|------|------|
| スリープ | 使わないと止まることがある。起動は Render の長い待機画面より軽いことが多い |
| PC | **不要**（クラウドだけで動く） |
| データ | Neon に保存（PCを消しても残る） |

---

## Render をやめる（移行後）

Fly でログイン・在庫確認ができたら:

1. https://dashboard.render.com を開く
2. サービス `shabon-inventory` を **Suspend** または削除
3. 旧URL `https://shabon-inventory.onrender.com` は使わない

店舗には **新しいURL（fly.dev）** だけ伝えてください。

---

## あなたのPCでは何をする？

| 用途 | 操作 |
|------|------|
| 日常の在庫管理 | **固定URL** をブラウザで開く（`起動.bat` 不要） |
| Excelから品目を更新 | PCで整える → GitHub に反映 → `flyctl deploy` |
| バックアップ | Neon の管理画面、またはアプリ内データ |

**PCをサーバーにする必要はありません。**

---

## 困ったとき

| 症状 | 対処 |
|------|------|
| 502 / 起動しない | `flyctl logs -a shabon-inventory` |
| ログインできない | `APP_PASSWORD` が `haizi814` か `flyctl secrets list -a shabon-inventory` で確認 |
| 品目が空 | Neon 接続と `data/products.json` を確認 → 再デプロイ |
| 旧 Render URL が遅い | Fly の新URLに切り替える |
