/**
 * シャボン玉在庫管理 — Render スリープ防止（Google Apps Script・完全無料）
 *
 * 【初回セットアップ】
 * 1. https://script.google.com → 新しいプロジェクト
 * 2. このコードをすべて貼り付け（プロジェクト名例: シャボン玉在庫キープアライブ）
 * 3. 左の歯車「プロジェクトの設定」→ タイムゾーン「(GMT+09:00) 日本標準時」
 * 4. 関数を setupTrigger に変えて ▶ 実行 → 権限を承認
 * 5. 実行ログに「10分おきのトリガーを設定しました」と出れば完了
 *
 * 24時間 10 分おきにアクセスし、Render のスリープを防ぎます。
 * 1日あたり約 84 回（GAS 無料枠 2 万回/日 以内）なので完全無料で運用できます。
 */

const HEALTH_URL = "https://shabon-inventory.onrender.com/api/health";
const BUSINESS_HOURS_ONLY = false;
const OPEN_HOUR = 7; // この時刻から（含む）
const CLOSE_HOUR = 21; // この時刻まで（含まない）

/** 初回だけ実行: 10分おきのトリガーを自動登録 */
function setupTrigger() {
  removeTrigger_();
  ScriptApp.newTrigger("keepAlive")
    .timeBased()
    .everyMinutes(10)
    .create();
  Logger.log("10分おきのトリガーを設定しました");
}

/** トリガーを外すとき */
function removeTrigger() {
  removeTrigger_();
  Logger.log("トリガーを削除しました");
}

function removeTrigger_() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "keepAlive") {
      ScriptApp.deleteTrigger(t);
    }
  });
}

function keepAlive() {
  if (BUSINESS_HOURS_ONLY && !isBusinessHour()) {
    Logger.log("skip: outside business hours");
    return;
  }

  try {
    const res = UrlFetchApp.fetch(HEALTH_URL, {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true,
    });
    Logger.log("keepAlive: HTTP " + res.getResponseCode());
  } catch (e) {
    Logger.log("keepAlive error: " + e);
  }
}

function isBusinessHour() {
  const tz = Session.getScriptTimeZone();
  const hour = Number(Utilities.formatDate(new Date(), tz, "H"));
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

/** 手動テスト（エディタから実行） */
function testKeepAlive() {
  keepAlive();
}
