# しゃぼん玉せっけん在庫 — Supabase + GitHub Pages（Render不要）

他アプリ（プゥルヴー在庫・価格参照など）とは **別の Supabase プロジェクト** を作ります。  
キーやテーブルを共有しないでください。

画面・操作はそのまま。データだけクラウドに置きます。

---

## 完成イメージ

- URL例: `https://pv-dn.github.io/shabon-inventory/`
- ログインパスワード: `haizi812`（変更可）
- PCの電源不要・Renderの起動待ちなし

---

## ステップ1: Supabase（しゃぼん玉専用）

1. https://supabase.com でログイン
2. **New project**（名前例: `shabon-inventory`）※他アプリと混ぜない
3. **SQL Editor** → [`supabase/schema.sql`](./supabase/schema.sql) の内容を貼って **Run**
4. **Project Settings → API** で次を控える
   - Project URL
   - `anon` `public` key

---

## ステップ2: 品目の初回投入

PowerShell:

```powershell
cd "C:\Users\e--yo\Apps\シャボン玉石けん"
$env:VITE_SUPABASE_URL = "https://（あなたのプロジェクト）.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = "（anon key）"
powershell -File scripts\seed_supabase.ps1
```

---

## ステップ3: フロントの環境変数

`frontend/.env.local` を作成（`.env.example` をコピー）:

```
VITE_SUPABASE_URL=https://（あなたのプロジェクト）.supabase.co
VITE_SUPABASE_ANON_KEY=（anon key）
VITE_APP_PASSWORD=haizi812
```

ローカル確認:

```powershell
cd frontend
npm install
npm run dev
```

ブラウザでログインできればOK。

---

## ステップ4: GitHub Pages で公開

1. リポジトリ `shabon-inventory` の **Settings → Secrets and variables → Actions** に登録:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon key |
| `VITE_APP_PASSWORD` | `haizi812` |

2. `main` に push（または Actions で `Deploy GitHub Pages` を手動実行）
3. GitHub の Pages 設定で `/docs` を公開（ワークフローが `docs/` を更新）

公開URL: **https://pv-dn.github.io/shabon-inventory/**

---

## 店舗への伝え方

- URL: GitHub Pages のURL
- パスワード: `haizi812`

## 無料プランの注意（一時停止）

Supabase 無料枠は **約1週間アクセスがないと一時停止**します。データは消えません。

### 自動対策（推奨）

GitHub Actions（`keep-supabase-alive.yml`）が **毎日** ping します。  
停止を検知すると Management API で **自動 Resume** します（要: 下記トークン）。

### 手動再開（アプリからも）

アプリ接続エラー時に **「再開する（GitHub）」** が出ます。

1. ボタンで Actions を開く  
2. 右の **Run workflow** → 緑の **Run workflow**  
3. 数分待ってアプリで **再試行**

ダッシュボードで Resume しても同じです。

### 初回だけ: Access Token を GitHub に登録

自動 Resume / 手動 Resume の両方に必要です。

1. https://supabase.com/dashboard/account/tokens でトークン作成（名前例: `shabon-resume`）
2. リポジトリ `shabon-inventory` → **Settings → Secrets and variables → Actions**
3. New secret:
   - Name: `SUPABASE_ACCESS_TOKEN`
   - Value: 作成したトークン

※ トークンはアプリ本体には埋め込みません（GitHub Actions 内だけ）。

手動で今すぐ起こす: Actions → **Resume Supabase** または **Keep Supabase awake** → Run workflow

---

## ローカル（Flask）との関係

| 用途 | 方法 |
|------|------|
| 店舗・本番 | GitHub Pages + Supabase |
| このPCだけで試す（Supabaseなし） | `起動.bat`（従来どおり・Flask） |

`frontend/.env.local` があると画面は Supabase を使います。  
一時的にFlaskだけ使うときは `.env.local` をリネームしてください。

---

## 他アプリと混在させないチェック

- [ ] Supabase プロジェクト名が `shabon-inventory` など専用
- [ ] プゥルヴー在庫の URL / anon key を貼っていない
- [ ] SQL は `シャボン玉石けん/supabase/schema.sql` だけを実行

---

## クラウド版でできないこと（ローカル限定）

- Excel一括取込  

公式HPからの画像取得はクラウド版でも使えます（「公式HPから画像取得」ボタン）。
