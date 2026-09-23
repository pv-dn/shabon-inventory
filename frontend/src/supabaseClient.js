/**
 * しゃぼん玉在庫専用 Supabase 接続。
 * プゥルヴー在庫など他アプリの URL / key は絶対に使わないこと。
 */
const url = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const isSupabaseMode = Boolean(url && key);
export const APP_PASSWORD = (import.meta.env.VITE_APP_PASSWORD || "").trim();

/** 例: ysosdljvkakjjhcogwbm（一時停止時のダッシュボードリンク用） */
export const SUPABASE_PROJECT_REF = (() => {
  try {
    if (!url) return "";
    const host = new URL(url).hostname;
    return host.replace(/\.supabase\.co$/i, "") || "";
  } catch {
    return "";
  }
})();

export const SUPABASE_DASHBOARD_URL = SUPABASE_PROJECT_REF
  ? `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}`
  : "https://supabase.com/dashboard";

/** GitHub Actions の Resume ワークフロー（Run workflow で再開） */
export const RESUME_ACTIONS_URL =
  "https://github.com/pv-dn/shabon-inventory/actions/workflows/resume-supabase.yml";

const AUTH_KEY = "shabon_inventory_auth";

export function isAuthenticated() {
  if (!APP_PASSWORD) return true;
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

export function setAuthenticated(ok) {
  if (ok) sessionStorage.setItem(AUTH_KEY, "1");
  else sessionStorage.removeItem(AUTH_KEY);
}

async function rest(path, { method = "GET", body, headers = {}, prefer } = {}) {
  const h = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...headers,
  };
  if (prefer) h.Prefer = prefer;
  if (body !== undefined) {
    h["Content-Type"] = "application/json";
    if (!h.Prefer) h.Prefer = "return=representation";
  }
  let res;
  try {
    res = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error(
      "データサーバーに接続できません。無料枠の一時停止の可能性があります。"
    );
    err.code = "SUPABASE_UNREACHABLE";
    throw err;
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    if (res.status === 521 || res.status === 503 || res.status === 546) {
      const err = new Error(
        "データサーバーが起動中または一時停止しています。少し待つか再開してください。"
      );
      err.status = res.status;
      err.code = "SUPABASE_PAUSED";
      throw err;
    }
    const msg =
      (data && (data.message || data.error || data.hint)) ||
      (typeof data === "string" ? data : `Supabaseエラー (${res.status})`);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function rpc(name, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.hint)) ||
      (typeof data === "string" ? data : `RPCエラー (${res.status})`);
    const err = new Error(String(msg).replace(/^ERROR:\s*/i, ""));
    err.status = res.status;
    throw err;
  }
  return data;
}

export const sb = { rest, rpc, url, key };
