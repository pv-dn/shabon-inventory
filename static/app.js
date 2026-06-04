const TYPE_LABELS = { in: "入庫", out: "出庫", adjust: "棚卸" };
const APP_VERSION = "20260604b";

let currentProductId = null;
let editingProductId = null;
let searchTimers = {};

const EDIT_DIALOG_HTML = `
<dialog id="dialog-edit" class="dialog dialog-wide">
  <form id="form-edit" onsubmit="return false">
    <h2 id="edit-title">品目編集</h2>
    <div class="form-grid">
      <label>商品コード <span class="required">*</span><input type="text" id="edit-code" required></label>
      <label>商品名 <span class="required">*</span><input type="text" id="edit-name" required></label>
      <label>規格<input type="text" id="edit-spec"></label>
      <label>ケース入数<input type="text" id="edit-case-qty" placeholder="例: 12 / 10×12"></label>
      <label>一般価格（税込）<input type="number" id="edit-retail" min="0" placeholder="未設定"></label>
      <label>会員価格<input type="number" id="edit-member" min="0" placeholder="未設定"></label>
      <label>補充下限<input type="number" id="edit-min" min="0" value="0"></label>
      <label class="full">メモ<input type="text" id="edit-note"></label>
    </div>
    <p class="edit-meta" id="edit-meta" hidden></p>
    <div class="dialog-actions spread">
      <button type="button" class="btn danger" id="edit-delete" hidden>品目を削除</button>
      <div class="dialog-actions">
        <button type="button" class="btn secondary" id="edit-cancel">キャンセル</button>
        <button type="button" class="btn primary" id="edit-save">保存</button>
      </div>
    </div>
  </form>
</dialog>`;

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (!el) throw new Error(`画面の部品が見つかりません: ${id}。Ctrl+F5 で再読み込みしてください`);
  el.textContent = text;
}

function setValue(id, value) {
  const el = $(id);
  if (!el) throw new Error(`画面の部品が見つかりません: ${id}。Ctrl+F5 で再読み込みしてください`);
  el.value = value;
}

function ensureRequiredDom() {
  if (!$("dialog-edit")) {
    document.body.insertAdjacentHTML("beforeend", EDIT_DIALOG_HTML);
  }
  if (!$("panel-products")) {
    const nav = document.querySelector(".tabs");
    if (nav && !nav.querySelector('[data-tab="products"]')) {
      nav.insertAdjacentHTML(
        "beforeend",
        '<button class="tab" data-tab="products" role="tab">品目編集</button>'
      );
    }
    const main = document.querySelector(".main");
    if (main) {
      main.insertAdjacentHTML(
        "beforeend",
        `<section id="panel-products" class="panel">
          <div class="toolbar">
            <input type="search" id="search-products" placeholder="品目を検索" class="search">
            <button type="button" id="btn-new-product" class="btn primary">新規品目を追加</button>
          </div>
          <div class="table-wrap">
            <table class="data-table" id="table-products">
              <thead><tr>
                <th>コード</th><th>商品名</th><th>規格</th><th>ケース入数</th>
                <th class="num">一般価格</th><th class="num">会員価格</th><th class="num">在庫</th><th>操作</th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </section>`
      );
    }
  }
}

let editHandlersBound = false;

function bindEditDialogHandlers() {
  if (editHandlersBound) return;
  editHandlersBound = true;
  onClick("edit-cancel", () => closeDialog("dialog-edit"));
  onClick("edit-save", saveProduct);
  onClick("edit-delete", deleteProduct);
  onClick("btn-new-product", () => openEditDialog(null));
  onInput("search-products", "products", loadProducts);
}

function initApp() {
  ensureRequiredDom();
  bindEditDialogHandlers();

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const panel = $(`panel-${btn.dataset.tab}`);
      if (panel) panel.classList.add("active");
      refreshCurrentTab();
    });
  });

  onInput("search-stock", "stock", loadStock);
  onInput("search-active", "active", loadActive);
  onInput("search-history", "history", loadHistory);
  onClick("btn-refresh", refreshAll);
  onClick("btn-import", importExcel);
  onClick("move-cancel", () => closeDialog("dialog-move"));
  onClick("detail-close", () => closeDialog("dialog-detail"));

  onChange("move-type", updateMoveLabels);
  onSubmit("form-move", submitMovement);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || btn.disabled) return;

    const action = btn.dataset.action;
    if (action === "open-edit") {
      const id = parseInt(btn.dataset.id, 10);
      closeDialog("dialog-detail");
      openEditDialog(id);
      return;
    }

    const id = parseInt(btn.dataset.id, 10);
    if (!Number.isFinite(id)) return;

    if (action === "move") openMoveDialog(id);
    else if (action === "edit") openEditDialog(id);
    else if (action === "detail") openDetailDialog(id);
  });

  const ver = $("app-version");
  if (ver) ver.textContent = `v${APP_VERSION}`;

  refreshAll();
}

function onClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

function onChange(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", handler);
}

function onSubmit(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("submit", handler);
}

function onInput(id, key, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", (e) => {
    clearTimeout(searchTimers[key]);
    searchTimers[key] = setTimeout(handler, 280);
  });
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && typeof dialog.close === "function") dialog.close();
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog) throw new Error("ダイアログを開けません");
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }
  throw new Error("このブラウザは dialog 非対応です。Edge または Chrome をお使いください");
}

async function submitMovement(e) {
  e.preventDefault();
  const type = document.getElementById("move-type").value;
  const quantity = parseInt(document.getElementById("move-quantity").value, 10);
  const memo = document.getElementById("move-memo").value;
  try {
    const data = await requestJson("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: currentProductId, type, quantity, memo }),
    });
    closeDialog("dialog-move");
    toast("登録しました");
    refreshAll();
    return data;
  } catch (err) {
    toast(err.message, true);
  }
}

function updateMoveLabels() {
  const type = $("move-type")?.value;
  const label = $("move-qty-label");
  const input = $("move-quantity");
  if (!label || !input) return;
  if (type === "adjust") {
    label.textContent = "棚卸後の在庫数";
    input.min = 0;
  } else {
    label.textContent = "数量";
    input.min = 1;
  }
}

function toast(msg, isError = false) {
  const el = $("toast");
  if (!el) {
    alert(msg);
    return;
  }
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    el.hidden = true;
  }, 3200);
}

async function requestJson(url, options) {
  const res = await fetch(url, options);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("サーバーからの応答を読み取れません");
  }
  if (!res.ok) {
    throw new Error(data.error || `エラー (${res.status})`);
  }
  return data;
}

async function fetchJson(url) {
  return requestJson(url);
}

async function loadSummary() {
  try {
    const s = await fetchJson("/api/summary");
    document.getElementById("summary").innerHTML = `
      <span class="chip">登録品目 ${s.total}</span>
      <span class="chip">動きあり ${s.with_movements}</span>
      <span class="chip">在庫ゼロ ${s.zero_stock}</span>
      <span class="chip">要補充 ${s.low_stock}</span>
    `;
  } catch (err) {
    toast(err.message, true);
  }
}

function rowClass(p) {
  if (p.quantity === 0) return "row-zero";
  if (p.min_stock > 0 && p.quantity <= p.min_stock) return "row-low";
  return "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString()}円`;
}

function actionButtons(p, { showMove = false, detailLabel = "詳細" } = {}) {
  const moveBtn = showMove
    ? `<button type="button" class="btn small primary" data-action="move" data-id="${p.id}">入出庫</button>`
    : "";
  return `
    ${moveBtn}
    <button type="button" class="btn small secondary" data-action="edit" data-id="${p.id}">編集</button>
    <button type="button" class="btn small secondary" data-action="detail" data-id="${p.id}">${detailLabel}</button>
  `;
}

async function loadProducts() {
  try {
    const q = document.getElementById("search-products")?.value.trim() || "";
    const items = await fetchJson(`/api/products?q=${encodeURIComponent(q)}`);
    const tbody = document.querySelector("#table-products tbody");
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">該当する品目がありません</td></tr>`;
      return;
    }
    tbody.innerHTML = items
      .map(
        (p) => `
      <tr>
        <td>${escapeHtml(p.code)}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.spec)}</td>
        <td>${escapeHtml(p.case_qty)}</td>
        <td class="num">${formatPrice(p.retail_price)}</td>
        <td class="num">${formatPrice(p.member_price)}</td>
        <td class="num">${p.quantity}</td>
        <td class="action-cell">${actionButtons(p, { detailLabel: "履歴" })}</td>
      </tr>`
      )
      .join("");
  } catch (err) {
    toast(err.message, true);
  }
}

async function loadStock() {
  try {
    const q = document.getElementById("search-stock")?.value.trim() || "";
    const items = await fetchJson(`/api/products?q=${encodeURIComponent(q)}`);
    const tbody = document.querySelector("#table-stock tbody");
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">該当する品目がありません</td></tr>`;
      return;
    }
    tbody.innerHTML = items
      .map(
        (p) => `
      <tr class="${rowClass(p)}">
        <td>${escapeHtml(p.code)}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.spec)}</td>
        <td>${escapeHtml(p.case_qty)}</td>
        <td class="num"><strong>${p.quantity}</strong></td>
        <td class="num">${p.min_stock || "—"}</td>
        <td class="action-cell">${actionButtons(p, { showMove: true })}</td>
      </tr>`
      )
      .join("");
  } catch (err) {
    toast(err.message, true);
  }
}

async function loadActive() {
  try {
    const q = document.getElementById("search-active")?.value.trim() || "";
    const items = await fetchJson(`/api/products?active_only=1&q=${encodeURIComponent(q)}`);
    const tbody = document.querySelector("#table-active tbody");
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">まだ入出庫の記録がある品目はありません</td></tr>`;
      return;
    }
    tbody.innerHTML = items
      .map(
        (p) => `
      <tr class="${rowClass(p)}">
        <td>${escapeHtml(p.code)}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.spec)}</td>
        <td class="num"><strong>${p.quantity}</strong></td>
        <td class="num">${p.movement_count}</td>
        <td>${formatDate(p.last_movement_at)}</td>
        <td class="action-cell">${actionButtons(p, { showMove: true, detailLabel: "履歴" })}</td>
      </tr>`
      )
      .join("");
  } catch (err) {
    toast(err.message, true);
  }
}

async function loadHistory() {
  try {
    const q = document.getElementById("search-history")?.value.trim() || "";
    const items = await fetchJson(`/api/movements?q=${encodeURIComponent(q)}`);
    const tbody = document.querySelector("#table-history tbody");
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty">履歴がありません</td></tr>`;
      return;
    }
    tbody.innerHTML = items
      .map(
        (m) => `
      <tr>
        <td>${formatDate(m.created_at)}</td>
        <td>${escapeHtml(m.code)}</td>
        <td>${escapeHtml(m.name)}</td>
        <td><span class="badge badge-${m.type}">${TYPE_LABELS[m.type] || m.type}</span></td>
        <td class="num">${m.quantity}</td>
        <td class="num">${m.before_qty}</td>
        <td class="num">${m.after_qty}</td>
        <td>${escapeHtml(m.memo || "")}</td>
      </tr>`
      )
      .join("");
  } catch (err) {
    toast(err.message, true);
  }
}

async function openMoveDialog(id) {
  try {
    ensureRequiredDom();
    const p = await fetchJson(`/api/products/${id}`);
    currentProductId = id;
    setText("move-title", "入出庫登録");
    setText("move-product", `${p.code} ${p.name}（${p.spec || "—"}）`);
    setText("move-current", String(p.quantity));
    setValue("move-type", "in");
    setValue("move-quantity", "1");
    setValue("move-memo", "");
    updateMoveLabels();
    openDialog("dialog-move");
  } catch (err) {
    toast(err.message, true);
  }
}

async function openEditDialog(id) {
  try {
    ensureRequiredDom();

    editingProductId = id;
    const isNew = id === null;
    let p = {
      code: "",
      name: "",
      spec: "",
      case_qty: "",
      retail_price: "",
      member_price: "",
      min_stock: 0,
      note: "",
      quantity: 0,
      movement_count: 0,
    };

    if (!isNew) {
      p = await fetchJson(`/api/products/${id}`);
      const movements = await fetchJson(`/api/products/${id}/movements`);
      p.movement_count = movements.length;
    }

    setText("edit-title", isNew ? "新規品目を追加" : "品目を編集");
    setValue("edit-code", p.code || "");
    setValue("edit-name", p.name || "");
    setValue("edit-spec", p.spec || "");
    setValue("edit-case-qty", p.case_qty || "");
    setValue("edit-retail", p.retail_price ?? "");
    setValue("edit-member", p.member_price ?? "");
    setValue("edit-min", String(p.min_stock || 0));
    setValue("edit-note", p.note || "");

    const meta = $("edit-meta");
    const deleteBtn = $("edit-delete");
    if (isNew) {
      if (meta) meta.hidden = true;
      if (deleteBtn) deleteBtn.hidden = true;
    } else {
      if (meta) {
        meta.hidden = false;
        meta.textContent = `現在庫 ${p.quantity} / 入出庫履歴 ${p.movement_count} 件`;
      }
      if (deleteBtn) deleteBtn.hidden = false;
    }

    openDialog("dialog-edit");
  } catch (err) {
    toast(err.message, true);
  }
}

function collectProductForm() {
  return {
    code: ($("edit-code")?.value || "").trim(),
    name: ($("edit-name")?.value || "").trim(),
    spec: ($("edit-spec")?.value || "").trim(),
    case_qty: ($("edit-case-qty")?.value || "").trim(),
    retail_price: $("edit-retail")?.value ?? "",
    member_price: $("edit-member")?.value ?? "",
    min_stock: $("edit-min")?.value ?? 0,
    note: ($("edit-note")?.value || "").trim(),
  };
}

async function saveProduct() {
  const body = collectProductForm();
  if (!body.code || !body.name) {
    toast("商品コードと商品名は必須です", true);
    return;
  }

  const isNew = editingProductId === null;
  const saveBtn = $("edit-save");
  if (saveBtn) saveBtn.disabled = true;

  try {
    await requestJson(isNew ? "/api/products" : `/api/products/${editingProductId}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    closeDialog("dialog-edit");
    toast(isNew ? "品目を追加しました" : "保存しました");
    refreshAll();
  } catch (err) {
    toast(err.message, true);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function deleteProduct() {
  if (!editingProductId) return;
  const meta = $("edit-meta")?.textContent || "";
  const msg = meta.includes("履歴")
    ? "この品目と入出庫履歴を削除します。よろしいですか？"
    : "この品目を削除します。よろしいですか？";
  if (!confirm(msg)) return;

  try {
    await requestJson(`/api/products/${editingProductId}`, { method: "DELETE" });
    closeDialog("dialog-edit");
    toast("削除しました");
    refreshAll();
  } catch (err) {
    toast(err.message, true);
  }
}

async function openDetailDialog(id) {
  try {
    const [p, movements] = await Promise.all([
      fetchJson(`/api/products/${id}`),
      fetchJson(`/api/products/${id}/movements`),
    ]);
    const hist =
      movements.length === 0
        ? "<p>履歴なし</p>"
        : `<table class="history-mini"><thead><tr><th>日時</th><th>種別</th><th>数量</th><th>前→後</th><th>メモ</th></tr></thead><tbody>${movements
            .map(
              (m) => `<tr>
            <td>${formatDate(m.created_at)}</td>
            <td><span class="badge badge-${m.type}">${TYPE_LABELS[m.type]}</span></td>
            <td class="num">${m.quantity}</td>
            <td class="num">${m.before_qty} → ${m.after_qty}</td>
            <td>${escapeHtml(m.memo || "")}</td>
          </tr>`
            )
            .join("")}</tbody></table>`;

    document.getElementById("detail-content").innerHTML = `
      <h2>${escapeHtml(p.code)} ${escapeHtml(p.name)}</h2>
      <dl class="detail-grid">
        <dt>規格</dt><dd>${escapeHtml(p.spec) || "—"}</dd>
        <dt>ケース入数</dt><dd>${escapeHtml(p.case_qty) || "—"}</dd>
        <dt>在庫</dt><dd><strong>${p.quantity}</strong></dd>
        <dt>補充下限</dt><dd>${p.min_stock || "—"}</dd>
        <dt>一般価格</dt><dd>${formatPrice(p.retail_price)}</dd>
        <dt>会員価格</dt><dd>${formatPrice(p.member_price)}</dd>
        <dt>メモ</dt><dd>${escapeHtml(p.note) || "—"}</dd>
      </dl>
      <div class="dialog-actions" style="justify-content:flex-start;margin-bottom:1rem">
        <button type="button" class="btn secondary" data-action="open-edit" data-id="${p.id}">品目を編集</button>
      </div>
      <h3>この品目の履歴</h3>
      ${hist}
    `;
    openDialog("dialog-detail");
  } catch (err) {
    toast(err.message, true);
  }
}

async function importExcel() {
  if (!confirm("デスクトップの価格一覧 Excel から品目を再取込します。\n在庫数・履歴はそのまま残ります。よろしいですか？")) return;
  try {
    const data = await requestJson("/api/import", { method: "POST" });
    toast(`${data.count} 品目を取込しました（新規 ${data.added}）`);
    refreshAll();
  } catch (err) {
    toast(err.message, true);
  }
}

function refreshCurrentTab() {
  const active = document.querySelector(".tab.active")?.dataset.tab;
  if (active === "stock") loadStock();
  else if (active === "active") loadActive();
  else if (active === "products") loadProducts();
  else loadHistory();
}

function refreshAll() {
  loadSummary();
  refreshCurrentTab();
}

window.addEventListener("error", (e) => {
  toast(`エラー: ${e.message}`, true);
});

window.addEventListener("unhandledrejection", (e) => {
  toast(`エラー: ${e.reason?.message || e.reason || "不明なエラー"}`, true);
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
