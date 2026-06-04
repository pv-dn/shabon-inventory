export async function request(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("サーバーからの応答を読み取れません");
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
  products: (q = "", activeOnly = false) =>
    request(
      `/api/products?${new URLSearchParams({
        q,
        ...(activeOnly ? { active_only: "1" } : {}),
      })}`
    ),
  product: (id) => request(`/api/products/${id}`),
  productMovements: (id) => request(`/api/products/${id}/movements`),
  movements: (q = "") => request(`/api/movements?${new URLSearchParams({ q })}`),
  createMovement: (body) =>
    request("/api/movements", { method: "POST", body: JSON.stringify(body) }),
  createProduct: (body) =>
    request("/api/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id, body) =>
    request(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: "DELETE" }),
  importExcel: () => request("/api/import", { method: "POST" }),
};
