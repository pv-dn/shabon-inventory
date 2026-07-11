# しゃぼん玉せっけん 在庫管理（shabon-inventory）

| 項目 | 内容 |
|------|------|
| **ID** | `shabon-inventory` |
| **フォルダ** | `c:\dev\shabon-inventory-app` |
| **一覧** | [c:\dev\PROJECTS.md](c:\dev\PROJECTS.md) |

## 概要

しゃぼん玉せっけんの価格一覧 Excel をもとにした、PC 向け在庫管理アプリ。PWA として Chrome からも利用可能。

## 技術スタック

- バックエンド: Python 3.10+, Flask
- DB: SQLite（`database.py`）
- フロント: React (Vite), `frontend/src/App.jsx`
- デプロイ: Docker / Fly.io（任意・Neon DB）

## 主要ファイル

| パス | 内容 |
|------|------|
| `app.py` | Flask API・静的配信 |
| `database.py` | DB スキーマ・接続 |
| `categories.py` | 品目ジャンル（複数選択対応） |
| `frontend/src/App.jsx` | メイン UI |
| `data/products.json` | 商品データ |
| `起動.bat` / `停止.bat` | 日常操作 |

## 起動

1. 初回: `インストール.bat`
2. 日常: `起動.bat` またはデスクトップ「しゃぼん玉在庫管理」ショートカット
3. ブラウザ: http://127.0.0.1:5050

## 他アプリとの関係

**共有コードなし。** プゥル・ヴー在庫管理（pourvous）とは別クライアント・別データ。

## 変更履歴メモ

| 日付 | 内容 |
|------|------|
| 2026-06-11 | デスクトップから `c:\dev\shabon-inventory-app` へ移動 |
| | 品目ジャンル複数選択対応済み |
