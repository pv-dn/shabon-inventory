import { isSupabaseMode } from "./supabaseClient.js";
import { supabaseApi } from "./apiSupabase.js";

const DEFAULT_TIMEOUT_MS = 90_000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

function isRetryableError(err) {
  if (!err) return false;
  if (err.name === "AbortError") return true;
  if (err.name === "TypeError") return true;
  return RETRYABLE_STATUSES.has(err.status);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      credentials: "same-origin",
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function request(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? 1;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      const text = await res.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          const err = new Error(
            res.ok
              ? "サーバーからの応答を読み取れません"
              : `サーバーエラー (${res.status})。しばらく待って再試行してください。`
          );
          err.status = res.status;
          throw err;
        }
      }
      if (!res.ok) {
        const err = new Error(data.error || `エラー (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (err) {
      lastError = err;
      if (attempt < retries && isRetryableError(err)) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  if (lastError?.name === "AbortError") {
    throw new Error(
      "サーバー応答がタイムアウトしました。起動中の場合は少し待って再試行してください。"
    );
  }
  throw lastError;
}

const flaskApi = {
  me: () => request("/api/me", { timeoutMs: 120_000, retries: 2 }),
  login: (password) =>
    request("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
      timeoutMs: 120_000,
      retries: 2,
    }),
  logout: () => request("/api/logout", { method: "POST" }),
  summary: () => request("/api/summary"),
  categories: () => request("/api/categories"),
  products: (q = "", activeOnly = false, category = "all") =>
    request(
      `/api/products?${new URLSearchParams({
        q,
        ...(activeOnly ? { active_only: "1" } : {}),
        ...(category && category !== "all" ? { category } : {}),
      })}`
    ),
  product: (id) => request(`/api/products/${id}`),
  productMovements: (id) => request(`/api/products/${id}/movements`),
  movements: (q = "") => request(`/api/movements?${new URLSearchParams({ q })}`),
  createMovement: (body) =>
    request("/api/movements", { method: "POST", body: JSON.stringify(body) }),
  cancelMovement: (id) =>
    request(`/api/movements/${id}/cancel`, { method: "POST" }),
  bulkCancelMovements: (ids) =>
    request("/api/movements/bulk-cancel", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  createProduct: (body) =>
    request("/api/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id, body) =>
    request(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: "DELETE" }),
  importExcel: () => request("/api/import", { method: "POST" }),
  fetchOfficialImages: (limit = 15, overwrite = false) =>
    request("/api/products/fetch-official-images", {
      method: "POST",
      body: JSON.stringify({ limit, overwrite }),
      timeoutMs: 120_000,
      retries: 1,
    }),
  orderRequests: (q = "", status = "all") =>
    request(
      `/api/order-requests?${new URLSearchParams({
        status,
        ...(q ? { q } : {}),
      })}`
    ),
  createOrderRequest: (body) =>
    request("/api/order-requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  completeOrderRequest: (id) =>
    request(`/api/order-requests/${id}/complete`, { method: "POST" }),
};

/** Supabase設定があればクラウド、なければ従来のFlaskローカル */
export const api = isSupabaseMode ? supabaseApi : flaskApi;
