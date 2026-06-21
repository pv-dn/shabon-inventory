export async function request(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("サーバーからの応答を読み取れません");
    }
  }
  if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
  return data;
}

export const api = {
  me: () => request("/api/me"),
  login: (password) =>
    request("/api/login", { method: "POST", body: JSON.stringify({ password }) }),
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
    request("/api/movements/bulk-cancel", { method: "POST", body: JSON.stringify({ ids }) }),
  createProduct: (body) =>
    request("/api/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id, body) =>
    request(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: "DELETE" }),
  importExcel: () => request("/api/import", { method: "POST" }),
  fetchOfficialImages: (limit = 15) =>
    request("/api/products/fetch-official-images", {
      method: "POST",
      body: JSON.stringify({ limit }),
    }),
};
