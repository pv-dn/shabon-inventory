import {
  CATEGORIES,
  categoriesLabel,
  normalizeCategories,
  parseCategories,
  serializeCategories,
} from "./categories.js";
import {
  APP_PASSWORD,
  isAuthenticated,
  sb,
  setAuthenticated,
} from "./supabaseClient.js";

function stripImagePrefix(url) {
  if (!url) return "";
  return String(url).replace(/^(manual:|official:)/, "");
}

function hasImage(url) {
  if (!url) return false;
  if (String(url).startsWith("unavailable:")) return false;
  return true;
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function productImageCandidates(code) {
  const c = String(code || "").trim();
  if (!c) return [];
  return [
    `https://www.shabon.com/shop/f/resources/images/Product/${c}/main.jpg`,
    `https://www.shabon.com/shop/resources/images/Product/${c}/main.jpg`,
  ];
}

function probeImageUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(false);
    }, 8000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img.naturalWidth > 8 && img.naturalHeight > 8);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.referrerPolicy = "no-referrer";
    img.src = url;
  });
}

async function findOfficialImageUrl(code) {
  for (const url of productImageCandidates(code)) {
    if (await probeImageUrl(url)) return url;
  }
  return null;
}

function needsOfficialFetch(imageUrl, overwrite) {
  const u = String(imageUrl || "");
  if (!u) return true;
  if (u.startsWith("unavailable:")) return false;
  if (u.startsWith("official:")) return false;
  return Boolean(overwrite);
}

function mapProduct(row, { includeImage = false } = {}) {
  if (!row) return null;
  const cats = parseCategories(row.category);
  const out = {
    id: row.id,
    code: row.code,
    name: row.name,
    spec: row.spec || "",
    case_qty: row.case_qty || "",
    retail_price: row.retail_price,
    member_price: row.member_price,
    quantity: row.quantity ?? 0,
    min_stock: row.min_stock ?? 0,
    note: row.note || "",
    categories: cats,
    category: cats[0],
    category_label: categoriesLabel(cats),
    has_image: hasImage(row.image_url),
    updated_at: row.updated_at || null,
    movement_count: row.movement_count ?? 0,
    last_movement_at: row.last_movement_at ?? null,
  };
  if (includeImage) {
    out.image_url = stripImagePrefix(row.image_url || "");
  }
  return out;
}

function mapMovement(row) {
  return {
    id: row.id,
    product_id: row.product_id,
    type: row.type,
    quantity: row.quantity,
    before_qty: row.before_qty,
    after_qty: row.after_qty,
    memo: row.memo || "",
    created_at: row.created_at,
    cancelled_at: row.cancelled_at || null,
    code: row.code,
    name: row.name,
    spec: row.spec || "",
  };
}

function mapOrder(row) {
  const cats = parseCategories(row.category);
  return {
    id: row.id,
    product_id: row.product_id,
    quantity: row.quantity,
    memo: row.memo || "",
    status: row.status,
    created_at: row.created_at,
    completed_at: row.completed_at || null,
    code: row.code,
    name: row.name,
    spec: row.spec || "",
    categories: cats,
    category_label: categoriesLabel(cats),
  };
}

async function attachMovementMeta(products) {
  if (!products.length) return products;
  const ids = products.map((p) => p.id);
  const rows = await sb.rest(
    `movements?select=product_id,created_at&cancelled_at=is.null&product_id=in.(${ids.join(",")})&order=created_at.desc`
  );
  const count = new Map();
  const last = new Map();
  for (const r of rows || []) {
    count.set(r.product_id, (count.get(r.product_id) || 0) + 1);
    if (!last.has(r.product_id)) last.set(r.product_id, r.created_at);
  }
  return products.map((p) => ({
    ...p,
    movement_count: count.get(p.id) || 0,
    last_movement_at: last.get(p.id) || null,
  }));
}

export const supabaseApi = {
  async me() {
    return {
      authenticated: isAuthenticated(),
      password_required: Boolean(APP_PASSWORD),
    };
  },

  async login(password) {
    if (!APP_PASSWORD) {
      setAuthenticated(true);
      return { ok: true };
    }
    if (password === APP_PASSWORD) {
      setAuthenticated(true);
      return { ok: true };
    }
    const err = new Error("パスワードが違います");
    err.status = 401;
    throw err;
  },

  async logout() {
    setAuthenticated(false);
    return { ok: true };
  },

  async summary() {
    const products = await sb.rest("products?select=id,quantity,min_stock");
    const pending = await sb.rest("order_requests?select=id&status=eq.pending");
    const mov = await sb.rest("movements?select=product_id&cancelled_at=is.null");
    const withMov = new Set((mov || []).map((m) => m.product_id));
    let low = 0;
    let zero = 0;
    for (const p of products || []) {
      if ((p.quantity ?? 0) <= 0) zero += 1;
      else if ((p.min_stock ?? 0) > 0 && p.quantity <= p.min_stock) low += 1;
    }
    return {
      total: (products || []).length,
      low_stock: low,
      zero_stock: zero,
      with_movements: withMov.size,
      pending_order_requests: (pending || []).length,
    };
  },

  async categories() {
    return CATEGORIES;
  },

  async products(q = "", activeOnly = false, category = "all") {
    let rows = await sb.rest(
      "products?select=id,code,name,spec,case_qty,retail_price,member_price,quantity,min_stock,note,category,image_url,updated_at&order=code.asc"
    );
    rows = await attachMovementMeta(rows || []);
    let list = rows.map((r) => mapProduct(r));
    const qq = String(q || "").trim().toLowerCase();
    if (qq) {
      list = list.filter(
        (p) =>
          p.code.toLowerCase().includes(qq) ||
          p.name.toLowerCase().includes(qq) ||
          (p.spec || "").toLowerCase().includes(qq)
      );
    }
    if (activeOnly) {
      list = list.filter((p) => (p.movement_count || 0) > 0);
    }
    if (category && category !== "all") {
      list = list.filter((p) => (p.categories || []).includes(category));
    }
    return list;
  },

  async product(id) {
    const rows = await sb.rest(`products?id=eq.${id}&select=*`);
    if (!rows?.length) {
      const err = new Error("商品が見つかりません");
      err.status = 404;
      throw err;
    }
    const [withMeta] = await attachMovementMeta(rows);
    return mapProduct(withMeta, { includeImage: true });
  },

  async productMovements(id) {
    const rows = await sb.rest(
      `movements?product_id=eq.${id}&cancelled_at=is.null&order=created_at.desc&limit=200`
    );
    return (rows || []).map(mapMovement);
  },

  async movements(q = "") {
    const rows = await sb.rest(
      "movements?select=*,products(code,name,spec)&cancelled_at=is.null&order=created_at.desc&limit=500"
    );
    let list = (rows || []).map((r) =>
      mapMovement({
        ...r,
        code: r.products?.code,
        name: r.products?.name,
        spec: r.products?.spec,
      })
    );
    const qq = String(q || "").trim().toLowerCase();
    if (qq) {
      list = list.filter(
        (m) =>
          String(m.code || "").toLowerCase().includes(qq) ||
          String(m.name || "").toLowerCase().includes(qq) ||
          String(m.memo || "").toLowerCase().includes(qq)
      );
    }
    return list;
  },

  async createMovement(body) {
    const product = await sb.rpc("shabon_create_movement", {
      p_product_id: Number(body.product_id),
      p_type: body.type,
      p_quantity: Number(body.quantity),
      p_memo: body.memo || "",
    });
    return { ok: true, product: mapProduct(product) };
  },

  async cancelMovement(id) {
    const product = await sb.rpc("shabon_cancel_movement", {
      p_movement_id: Number(id),
    });
    return { ok: true, product: mapProduct(product) };
  },

  async bulkCancelMovements(ids) {
    const unique = [...new Set((ids || []).map(Number))];
    for (const id of unique.sort((a, b) => b - a)) {
      await sb.rpc("shabon_cancel_movement", { p_movement_id: id });
    }
    return { ok: true, deleted: unique.length };
  },

  async createProduct(body) {
    const cats = normalizeCategories(body.categories || body.category);
    const image =
      body.image_url && String(body.image_url).startsWith("data:")
        ? `manual:${body.image_url}`
        : body.image_url || null;
    const payload = {
      code: String(body.code || "").trim(),
      name: String(body.name || "").trim(),
      spec: body.spec || "",
      case_qty: body.case_qty || "",
      retail_price: body.retail_price ?? null,
      member_price: body.member_price ?? null,
      quantity: Number(body.quantity ?? 0),
      min_stock: Number(body.min_stock ?? 0),
      note: body.note || "",
      category: serializeCategories(cats),
      image_url: image,
      updated_at: nowIso(),
    };
    const rows = await sb.rest("products", {
      method: "POST",
      body: payload,
      prefer: "return=representation",
    });
    return mapProduct(Array.isArray(rows) ? rows[0] : rows, { includeImage: true });
  },

  async updateProduct(id, body) {
    const patch = { updated_at: nowIso() };
    for (const key of [
      "code",
      "name",
      "spec",
      "case_qty",
      "retail_price",
      "member_price",
      "quantity",
      "min_stock",
      "note",
    ]) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (body.categories !== undefined || body.category !== undefined) {
      patch.category = serializeCategories(body.categories || body.category);
    }
    if (body.image_url !== undefined) {
      const v = body.image_url;
      patch.image_url =
        v && String(v).startsWith("data:") ? `manual:${v}` : v || null;
    }
    const rows = await sb.rest(`products?id=eq.${id}`, {
      method: "PATCH",
      body: patch,
      prefer: "return=representation",
    });
    if (!rows?.length) {
      const err = new Error("商品が見つかりません");
      err.status = 404;
      throw err;
    }
    return mapProduct(rows[0], { includeImage: true });
  },

  async deleteProduct(id) {
    await sb.rest(`movements?product_id=eq.${id}`, { method: "DELETE" });
    await sb.rest(`order_requests?product_id=eq.${id}`, { method: "DELETE" });
    await sb.rest(`products?id=eq.${id}`, { method: "DELETE" });
    return { ok: true, deleted_movements: 0 };
  },

  async importExcel() {
    const err = new Error(
      "クラウド版ではExcel取込はできません。品目は画面から編集するか、初回シードを使ってください。"
    );
    err.status = 400;
    throw err;
  },

  async fetchOfficialImages(limit = 15, overwrite = false) {
    const rows = await sb.rest(
      "products?select=id,code,image_url&order=code.asc"
    );
    const targets = (rows || []).filter((r) =>
      needsOfficialFetch(r.image_url, Boolean(overwrite))
    );
    const batch = targets.slice(0, Math.max(1, Math.min(Number(limit) || 15, 10)));
    let updated = 0;
    let skipped = 0;

    for (const p of batch) {
      const found = await findOfficialImageUrl(p.code);
      if (found) {
        await sb.rest(`products?id=eq.${p.id}`, {
          method: "PATCH",
          body: {
            image_url: `official:${found}`,
            updated_at: nowIso(),
          },
        });
        updated += 1;
      } else {
        await sb.rest(`products?id=eq.${p.id}`, {
          method: "PATCH",
          body: {
            image_url: `unavailable:${p.code}`,
            updated_at: nowIso(),
          },
        });
        skipped += 1;
      }
      await new Promise((r) => setTimeout(r, 180));
    }

    const remaining = Math.max(0, targets.length - batch.length);
    return {
      ok: true,
      updated,
      skipped,
      remaining,
      done: remaining === 0,
    };
  },

  async orderRequests(q = "", status = "all") {
    let path =
      "order_requests?select=*,products(code,name,spec,category)&order=created_at.desc";
    if (status && status !== "all") path += `&status=eq.${status}`;
    const rows = await sb.rest(path);
    let list = (rows || []).map((r) =>
      mapOrder({
        ...r,
        code: r.products?.code,
        name: r.products?.name,
        spec: r.products?.spec,
        category: r.products?.category,
      })
    );
    const qq = String(q || "").trim().toLowerCase();
    if (qq) {
      list = list.filter(
        (o) =>
          String(o.code || "").toLowerCase().includes(qq) ||
          String(o.name || "").toLowerCase().includes(qq) ||
          String(o.memo || "").toLowerCase().includes(qq)
      );
    }
    return list;
  },

  async createOrderRequest(body) {
    const payload = {
      product_id: Number(body.product_id),
      quantity: Number(body.quantity ?? 1),
      memo: body.memo || "",
      status: "pending",
      created_at: nowIso(),
    };
    const rows = await sb.rest("order_requests", {
      method: "POST",
      body: payload,
      prefer: "return=representation",
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    const prod = await sb.rest(
      `products?id=eq.${row.product_id}&select=code,name,spec,category`
    );
    return mapOrder({
      ...row,
      code: prod?.[0]?.code,
      name: prod?.[0]?.name,
      spec: prod?.[0]?.spec,
      category: prod?.[0]?.category,
    });
  },

  async completeOrderRequest(id) {
    const rows = await sb.rest(`order_requests?id=eq.${id}`, {
      method: "PATCH",
      body: { status: "completed", completed_at: nowIso() },
      prefer: "return=representation",
    });
    if (!rows?.length) {
      const err = new Error("注文依頼が見つかりません");
      err.status = 404;
      throw err;
    }
    const row = rows[0];
    const prod = await sb.rest(
      `products?id=eq.${row.product_id}&select=code,name,spec,category`
    );
    return mapOrder({
      ...row,
      code: prod?.[0]?.code,
      name: prod?.[0]?.name,
      spec: prod?.[0]?.spec,
      category: prod?.[0]?.category,
    });
  },
};
