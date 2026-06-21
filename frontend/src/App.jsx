import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { compressImageFile } from "./imageUtils";

const TYPE_LABELS = { in: "入庫", out: "出庫", adjust: "棚卸" };
const TABS = [
  { id: "stock", label: "在庫一覧" },
  { id: "active", label: "動きのある品目" },
  { id: "ledger", label: "増減履歴" },
  { id: "products", label: "品目編集" },
  { id: "history", label: "入出庫履歴" },
];

const FALLBACK_CATEGORIES = [
  { id: "laundry", label: "洗濯" },
  { id: "face", label: "洗顔" },
  { id: "bath", label: "お風呂" },
  { id: "haircare", label: "ヘアケア" },
  { id: "kitchen", label: "台所" },
  { id: "hand", label: "手洗い" },
  { id: "tooth", label: "歯磨き" },
  { id: "other", label: "その他" },
];

const ALL_CATEGORY = { id: "all", label: "すべて" };

function categoryFilters(categories) {
  return [ALL_CATEGORY, ...categories];
}

function formatDate(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

function formatDateInMonth(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(5, 16);
}

function monthKey(iso) {
  return (iso || "").slice(0, 7);
}

function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  return `${year}年${Number(month)}月`;
}

function groupMovementsByMonth(movements) {
  const map = new Map();
  for (const movement of movements) {
    const key = monthKey(movement.created_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(movement);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({ key, label: formatMonthLabel(key), items }));
}

function movementsCollapseKey(movements) {
  if (!movements.length) return "";
  return movements.map((m) => m.id).join(",");
}

function formatPrice(v) {
  if (v == null || v === "") return "—";
  return `${Number(v).toLocaleString()}円`;
}

function movementDelta(m) {
  return m.after_qty - m.before_qty;
}

function formatDelta(delta) {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return String(delta);
  return "±0";
}

function stockClass(p) {
  if (p.quantity === 0) return "zero";
  if (p.min_stock > 0 && p.quantity <= p.min_stock) return "low";
  return "";
}

function categoryClass(category, categories) {
  const id = category || "other";
  return categories.some((c) => c.id === id) ? `cat-${id}` : "cat-other";
}

function categoryChipClass(categoryId, categories) {
  if (categoryId === "all") return "cat-all";
  return categoryClass(categoryId, categories);
}

function productCategories(product) {
  if (Array.isArray(product?.categories) && product.categories.length) {
    return product.categories;
  }
  return [product?.category || "other"];
}

function categoryLabelFor(id, categories) {
  return categories.find((c) => c.id === id)?.label || id;
}

function CategoryTags({ product, categories, inline = false, block = false }) {
  const ids = productCategories(product);
  if (!ids.length) return null;
  return (
    <span className={`category-tags${inline ? " inline" : ""}${block ? " block" : ""}`}>
      {ids.map((id) => (
        <span key={id} className="category-tag">
          {categoryLabelFor(id, categories)}
        </span>
      ))}
    </span>
  );
}

function Toast({ message, error, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!message) return null;
  return <div className={`toast ${error ? "error" : ""}`}>{message}</div>;
}

function ConfirmDialog({ open, message, confirmLabel = "OK", cancelLabel = "キャンセル", danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop confirm-backdrop" onClick={onCancel}>
      <div
        className="modal confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-message"
      >
        <p id="confirm-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? "danger" : "primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.login(password);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="brand-title">シャボン玉石けん</h1>
        <p>在庫管理にログイン</p>
        {error && <p className="login-error">{error}</p>}
        <form onSubmit={submit}>
          <label>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </label>
          <button type="submit" className="btn primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "ログイン中…" : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CompactDetailPanel({ product, imageUrl, categories, onClose, onMove, onEdit, onDetail, toast, onSaved }) {
  const [busy, setBusy] = useState(false);

  async function adjust(delta) {
    if (busy) return;
    if (delta < 0 && product.quantity <= 0) return;
    setBusy(true);
    try {
      await api.createMovement({
        product_id: product.id,
        type: delta > 0 ? "in" : "out",
        quantity: 1,
        memo: "",
      });
      toast(delta > 0 ? "入庫しました" : "出庫しました");
      onSaved();
    } catch (err) {
      toast(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`toolbar-detail ${stockClass(product)}`}>
      <button type="button" className="toolbar-detail-close" onClick={onClose} aria-label="閉じる">
        ×
      </button>
      <div className="toolbar-detail-inner">
        {imageUrl && (
          <div className="toolbar-detail-image-wrap">
            <img src={imageUrl} alt="" className="toolbar-detail-image" />
          </div>
        )}
        <div className="toolbar-detail-info">
          <span className="toolbar-detail-code">
            {product.code}
            <CategoryTags product={product} categories={categories} inline />
          </span>
          <strong className="toolbar-detail-name">{product.name}</strong>
          <span className="toolbar-detail-meta">
            {product.spec || "—"}
            {product.case_qty ? ` / ケース ${product.case_qty}` : ""}
          </span>
        </div>
        <div className="toolbar-detail-stock stepper">
          <button
            type="button"
            className="stepper-btn"
            onClick={() => adjust(-1)}
            disabled={busy || product.quantity <= 0}
            aria-label="1個減らす"
          >
            −
          </button>
          <span className="stepper-qty">
            {product.quantity}
            <small>個</small>
          </span>
          <button
            type="button"
            className="stepper-btn"
            onClick={() => adjust(1)}
            disabled={busy}
            aria-label="1個増やす"
          >
            +
          </button>
        </div>
        <div className="toolbar-detail-actions">
          <button type="button" className="btn small primary" onClick={() => onMove(product)}>
            入出庫
          </button>
          <button type="button" className="btn small secondary" onClick={() => onEdit(product)}>
            編集
          </button>
          <button type="button" className="btn small secondary" onClick={() => onDetail(product)}>
            詳細
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, compact, selected, categories, onSelect, onMove, onEdit, onDetail }) {
  const primaryCategory = productCategories(product)[0];
  if (compact) {
    return (
      <article
        className={`product-card compact ${categoryClass(primaryCategory, categories)} ${stockClass(product)} ${selected ? "selected" : ""}`}
        onClick={() => onSelect(product.id)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(product.id)}
        role="button"
        tabIndex={0}
        title="クリックで上に詳細表示"
      >
        <div className="compact-name">
          <CategoryTags product={product} categories={categories} block />
          {product.name}
        </div>
        <div className="compact-qty">
          {product.quantity}
          <small>個</small>
        </div>
      </article>
    );
  }

  return (
    <article className={`product-card ${categoryClass(primaryCategory, categories)} ${stockClass(product)}`}>
      <div className="card-code">
        {product.code}
        <CategoryTags product={product} categories={categories} inline />
      </div>
      <div className="card-name">{product.name}</div>
      <div className="card-meta">
        {product.spec || "—"} {product.case_qty ? ` / ケース ${product.case_qty}` : ""}
      </div>
      <div className="stock-badge">
        {product.quantity}
        <small>個</small>
      </div>
      <div className="card-actions">
        <button type="button" className="btn small primary" onClick={() => onMove(product)}>
          入出庫
        </button>
        <button type="button" className="btn small secondary" onClick={() => onEdit(product)}>
          編集
        </button>
        <button type="button" className="btn small secondary" onClick={() => onDetail(product)}>
          詳細
        </button>
      </div>
    </article>
  );
}

function MoveModal({ product, onClose, onSaved, toast }) {
  const [type, setType] = useState("in");
  const [quantity, setQuantity] = useState(1);
  const [memo, setMemo] = useState("");

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createMovement({
        product_id: product.id,
        type,
        quantity: parseInt(quantity, 10),
        memo,
      });
      toast("登録しました");
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, true);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>入出庫</h2>
        <p>
          <strong>{product.code}</strong> {product.name}
        </p>
        <p style={{ color: "var(--muted)" }}>現在庫: {product.quantity}</p>
        <form onSubmit={submit}>
          <label>
            種別
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="in">入庫</option>
              <option value="out">出庫</option>
              <option value="adjust">棚卸（在庫を直接指定）</option>
            </select>
          </label>
          <label>
            {type === "adjust" ? "棚卸後の在庫数" : "数量"}
            <input
              type="number"
              min={type === "adjust" ? 0 : 1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
          <label>
            メモ
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="例: 入荷、販売" />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="btn primary">
              登録
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditModal({ product, onClose, onSaved, toast, categories, askConfirm }) {
  const isNew = !product?.id;
  const [form, setForm] = useState({
    code: product?.code || "",
    name: product?.name || "",
    spec: product?.spec || "",
    case_qty: product?.case_qty || "",
    retail_price: product?.retail_price ?? "",
    member_price: product?.member_price ?? "",
    min_stock: product?.min_stock || 0,
    note: product?.note || "",
    categories: productCategories(product),
    image_url: product?.image_url || "",
  });
  const [imagePreview, setImagePreview] = useState(product?.image_url || "");
  const [imageLoading, setImageLoading] = useState(false);
  const [meta, setMeta] = useState("");
  const [movementCount, setMovementCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew && product?.id) {
      api.productMovements(product.id).then((m) => {
        setMovementCount(m.length);
        setMeta(`現在庫 ${product.quantity} / 履歴 ${m.length} 件`);
      });
      if (product.has_image && !product.image_url) {
        api.product(product.id).then((full) => {
          const url = full.image_url || "";
          setImagePreview(url);
          setForm((f) => ({ ...f, image_url: url }));
        });
      }
    }
  }, [isNew, product]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleCategory(id) {
    setForm((f) => {
      const cur = f.categories || [];
      const next = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id];
      return { ...f, categories: next };
    });
  }

  async function onImageFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageLoading(true);
    try {
      const dataUrl = await compressImageFile(file);
      setImagePreview(dataUrl);
      setForm((f) => ({ ...f, image_url: dataUrl }));
    } catch (err) {
      toast(err.message, true);
    } finally {
      setImageLoading(false);
    }
  }

  function clearImage() {
    setImagePreview("");
    setForm((f) => ({ ...f, image_url: "" }));
  }

  async function save(e) {
    e.preventDefault();
    if (!form.categories?.length) {
      toast("ジャンルを1つ以上選択してください", true);
      return;
    }
    setSaving(true);
    try {
      if (isNew) await api.createProduct(form);
      else await api.updateProduct(product.id, form);
      toast(isNew ? "品目を追加しました" : "保存しました");
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, true);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const msg =
      movementCount > 0
        ? "品目と入出庫履歴を削除します。よろしいですか？"
        : "この品目を削除します。よろしいですか？";
    if (!(await askConfirm({ message: msg, confirmLabel: "削除", danger: true }))) return;
    setDeleting(true);
    try {
      await api.deleteProduct(product.id);
      toast("削除しました");
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, true);
    } finally {
      setDeleting(false);
    }
  }

  const busy = deleting || saving || imageLoading;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? "新規品目" : "品目編集"}</h2>
        {meta && <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{meta}</p>}
        <form id="edit-product-form" onSubmit={save}>
          <div className="form-grid">
            <label className="full product-image-field">
              品目画像
              <div className="product-image-upload">
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="product-image-preview" />
                ) : (
                  <div className="product-image-placeholder">画像なし</div>
                )}
                <div className="product-image-actions">
                  <label className="btn secondary small product-image-pick">
                    {imageLoading ? "処理中…" : imagePreview ? "画像を変更" : "画像を選ぶ"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onImageFile}
                      disabled={busy}
                      hidden
                    />
                  </label>
                  {imagePreview && (
                    <button type="button" className="btn secondary small" onClick={clearImage} disabled={busy}>
                      画像を削除
                    </button>
                  )}
                </div>
              </div>
            </label>
            <label>
              商品コード *
              <input value={form.code} onChange={(e) => set("code", e.target.value)} required disabled={busy} />
            </label>
            <label>
              商品名 *
              <input value={form.name} onChange={(e) => set("name", e.target.value)} required disabled={busy} />
            </label>
            <label className="full">
              ジャンル *（複数選択可）
              <div className="category-checkboxes">
                {categories.map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={form.categories.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                      disabled={busy}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </label>
            <label>
              規格
              <input value={form.spec} onChange={(e) => set("spec", e.target.value)} disabled={busy} />
            </label>
            <label>
              ケース入数
              <input value={form.case_qty} onChange={(e) => set("case_qty", e.target.value)} disabled={busy} />
            </label>
            <label>
              一般価格
              <input type="number" min={0} value={form.retail_price} onChange={(e) => set("retail_price", e.target.value)} disabled={busy} />
            </label>
            <label>
              会員価格
              <input type="number" min={0} value={form.member_price} onChange={(e) => set("member_price", e.target.value)} disabled={busy} />
            </label>
            <label>
              補充下限
              <input type="number" min={0} value={form.min_stock} onChange={(e) => set("min_stock", e.target.value)} disabled={busy} />
            </label>
            <label className="full">
              メモ
              <input value={form.note} onChange={(e) => set("note", e.target.value)} disabled={busy} />
            </label>
          </div>
          {isNew ? (
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>
                キャンセル
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          ) : null}
        </form>
        {!isNew && (
          <div className="modal-footer">
            <button type="button" className="btn danger" onClick={remove} disabled={busy}>
              {deleting ? "削除中…" : "削除"}
            </button>
            <div className="modal-footer-actions">
              <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>
                キャンセル
              </button>
              <button type="submit" form="edit-product-form" className="btn primary" disabled={busy}>
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MovementHistoryRow({
  movement,
  showMemo,
  showProduct,
  groupedByMonth,
  selectable,
  selected,
  onToggleSelect,
  onCancel,
  cancellingId,
}) {
  const delta = movementDelta(movement);
  const cancelled = Boolean(movement.cancelled_at);

  return (
    <tr className={cancelled ? "movement-cancelled" : ""}>
      {selectable && (
        <td className="history-select-cell">
          {!cancelled && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(movement.id)}
              aria-label={`${movement.name || movement.code || "履歴"}を選択`}
            />
          )}
        </td>
      )}
      <td>{groupedByMonth ? formatDateInMonth(movement.created_at) : formatDate(movement.created_at)}</td>
      {showProduct && (
        <>
          <td>{movement.code}</td>
          <td>{movement.name}</td>
        </>
      )}
      <td>
        {cancelled ? (
          <span className="badge badge-cancelled">取り消し済</span>
        ) : (
          <span className={`badge badge-${movement.type}`}>{TYPE_LABELS[movement.type]}</span>
        )}
      </td>
      <td className={`num delta ${delta > 0 ? "plus" : delta < 0 ? "minus" : "zero"}`}>
        {formatDelta(delta)}
      </td>
      <td className="num">{movement.quantity}</td>
      <td className="num">
        {movement.before_qty} → {movement.after_qty}
      </td>
      {showMemo && <td>{movement.memo || ""}</td>}
      {onCancel && (
        <td>
          {!cancelled && (
            <button
              type="button"
              className="btn small danger"
              disabled={cancellingId === movement.id}
              onClick={() => onCancel(movement)}
            >
              {cancellingId === movement.id ? "処理中…" : "取り消し"}
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

function historyColumnCount({ selectable, showProduct, showMemo, onCancel }) {
  let count = 1;
  if (selectable) count += 1;
  if (showProduct) count += 2;
  count += 4;
  if (showMemo) count += 1;
  if (onCancel) count += 1;
  return count;
}

function MovementHistoryTable({
  movements,
  showMemo = true,
  showProduct = false,
  selectable = false,
  onCancel,
  onBulkDelete,
  cancellingId,
  bulkDeleting = false,
  emptyMessage = "この品目の増減履歴はまだありません",
}) {
  const monthGroups = useMemo(() => groupMovementsByMonth(movements), [movements]);
  const collapseKey = movementsCollapseKey(movements);
  const [collapsedMonths, setCollapsedMonths] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    const keys = monthGroups.map((group) => group.key);
    setCollapsedMonths(new Set(keys.slice(1)));
  }, [collapseKey, monthGroups]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [collapseKey]);

  const allIds = useMemo(() => movements.map((m) => m.id), [movements]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  function toggleMonth(key) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  }

  async function deleteSelected() {
    if (!selectedIds.size || !onBulkDelete) return;
    await onBulkDelete([...selectedIds]);
    setSelectedIds(new Set());
  }

  if (movements.length === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  const columnCount = historyColumnCount({ selectable, showProduct, showMemo, onCancel });

  return (
    <div className="history-month-groups">
      {selectable && onBulkDelete && (
        <div className="history-bulk-actions">
          <label className="history-select-all">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            すべて選択
          </label>
          <button
            type="button"
            className="btn small danger"
            disabled={selectedIds.size === 0 || bulkDeleting}
            onClick={deleteSelected}
          >
            {bulkDeleting ? "削除中…" : `選択を削除（${selectedIds.size}件）`}
          </button>
        </div>
      )}
      <div className="table-wrap history-table-wrap">
        <table className="data-table data-table-sticky-head">
          <thead>
            <tr>
              {selectable && <th className="history-select-cell" aria-label="選択" />}
              <th>日時</th>
              {showProduct && (
                <>
                  <th>コード</th>
                  <th>商品名</th>
                </>
              )}
              <th>種別</th>
              <th className="num">増減</th>
              <th className="num">操作数</th>
              <th className="num">在庫（前→後）</th>
              {showMemo && <th>メモ</th>}
              {onCancel && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {monthGroups.map((group) => {
              const isCollapsed = collapsedMonths.has(group.key);
              return (
                <Fragment key={group.key}>
                  <tr className="history-month-row">
                    <td colSpan={columnCount}>
                      <button
                        type="button"
                        className={`history-month-toggle ${isCollapsed ? "collapsed" : ""}`}
                        onClick={() => toggleMonth(group.key)}
                        aria-expanded={!isCollapsed}
                      >
                        <span className="history-month-chevron" aria-hidden="true">
                          {isCollapsed ? "▸" : "▾"}
                        </span>
                        <span className="history-month-label">{group.label}</span>
                        <span className="history-month-count">{group.items.length}件</span>
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed &&
                    group.items.map((movement) => (
                      <MovementHistoryRow
                        key={movement.id}
                        movement={movement}
                        showMemo={showMemo}
                        showProduct={showProduct}
                        groupedByMonth
                        selectable={selectable}
                        selected={selectedIds.has(movement.id)}
                        onToggleSelect={toggleSelect}
                        onCancel={onCancel}
                        cancellingId={cancellingId}
                      />
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductHistoryCorner({
  products,
  selectedId,
  onSelect,
  movements,
  loadingMovements,
  onMove,
  onDetail,
  onCancel,
  onBulkDelete,
  cancellingId,
  bulkDeleting,
}) {
  const selected = products.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="ledger-corner">
      <aside className="ledger-list">
        <p className="ledger-list-title">品目を選択</p>
        {products.length === 0 ? (
          <p className="empty ledger-list-empty">入出庫の記録がある品目がありません</p>
        ) : (
          <ul className="ledger-product-list">
            {products.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`ledger-product-item ${selectedId === p.id ? "active" : ""}`}
                  onClick={() => onSelect(p.id)}
                >
                  <span className="ledger-product-code">{p.code}</span>
                  <span className="ledger-product-name">{p.name}</span>
                  <span className="ledger-product-meta">
                    在庫 {p.quantity} ／ 履歴 {p.movement_count} 件
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="ledger-detail">
        {!selected ? (
          <p className="empty">左の一覧から品目を選ぶと、増減履歴が表示されます</p>
        ) : (
          <>
            <header className="ledger-detail-header">
              <div>
                <span className="ledger-detail-code">{selected.code}</span>
                <h2 className="ledger-detail-name">{selected.name}</h2>
                <p className="ledger-detail-spec">
                  {selected.spec || "—"}
                  {selected.case_qty ? ` ／ ケース ${selected.case_qty}` : ""}
                </p>
              </div>
              <div className="ledger-detail-stock">
                <span className="ledger-detail-stock-label">現在庫</span>
                <strong>{selected.quantity}</strong>
                <small>個</small>
              </div>
              <div className="ledger-detail-actions">
                <button type="button" className="btn small primary" onClick={() => onMove(selected)}>
                  入出庫
                </button>
                <button type="button" className="btn small secondary" onClick={() => onDetail(selected)}>
                  詳細
                </button>
              </div>
            </header>
            <h3 className="ledger-history-title">増減履歴（月別・新しい順）</h3>
            {loadingMovements ? (
              <p className="panel-loading">履歴を読み込み中…</p>
            ) : (
              <MovementHistoryTable
                movements={movements}
                selectable
                onCancel={onCancel}
                onBulkDelete={onBulkDelete}
                cancellingId={cancellingId}
                bulkDeleting={bulkDeleting}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

function DetailModal({ product, categories, onClose, onEdit, onCancel, cancellingId }) {
  const [movements, setMovements] = useState([]);
  const [imageUrl, setImageUrl] = useState(product.image_url || "");

  useEffect(() => {
    api.productMovements(product.id).then(setMovements);
    if (product.has_image && !product.image_url) {
      api.product(product.id).then((full) => setImageUrl(full.image_url || ""));
    } else {
      setImageUrl(product.image_url || "");
    }
  }, [product.id, product.has_image, product.image_url]);

  async function handleCancel(m) {
    if (!onCancel) return;
    const ok = await onCancel(m);
    if (ok) setMovements(await api.productMovements(product.id));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>
          {product.code} {product.name}
        </h2>
        {imageUrl && (
          <div className="detail-image-wrap">
            <img src={imageUrl} alt="" className="detail-image" />
          </div>
        )}
        <dl className="detail-grid">
          <dt>ジャンル</dt>
          <dd>
            <CategoryTags product={product} categories={categories} />
            {!productCategories(product).length && "—"}
          </dd>
          <dt>規格</dt>
          <dd>{product.spec || "—"}</dd>
          <dt>ケース入数</dt>
          <dd>{product.case_qty || "—"}</dd>
          <dt>在庫</dt>
          <dd>
            <strong>{product.quantity}</strong>
          </dd>
          <dt>補充下限</dt>
          <dd>{product.min_stock || "—"}</dd>
          <dt>一般価格</dt>
          <dd>{formatPrice(product.retail_price)}</dd>
          <dt>会員価格</dt>
          <dd>{formatPrice(product.member_price)}</dd>
          <dt>メモ</dt>
          <dd>{product.note || "—"}</dd>
        </dl>
        <button type="button" className="btn secondary" onClick={() => onEdit(product)}>
          品目を編集
        </button>
        <h3 style={{ marginTop: "1.25rem" }}>増減履歴</h3>
        <div style={{ maxHeight: "280px" }}>
          <MovementHistoryTable
            movements={movements}
            showMemo={false}
            onCancel={onCancel ? handleCancel : undefined}
            cancellingId={cancellingId}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [tab, setTab] = useState("stock");
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [ledgerMovements, setLedgerMovements] = useState([]);
  const [ledgerProductId, setLedgerProductId] = useState(null);
  const [ledgerMovementsLoading, setLedgerMovementsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ msg: "", error: false });
  const [modal, setModal] = useState(null);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [confirmState, setConfirmState] = useState(null);
  const [compactCards, setCompactCards] = useState(
    () => localStorage.getItem("shabon-compact-cards") !== "0"
  );
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProductImage, setSelectedProductImage] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [fetchingImages, setFetchingImages] = useState(false);

  const selectedProduct =
    compactCards && selectedProductId
      ? products.find((p) => p.id === selectedProductId) ?? null
      : null;

  useEffect(() => {
    if (!selectedProductId) {
      setSelectedProductImage("");
      return;
    }
    const p = products.find((item) => item.id === selectedProductId);
    if (!p?.has_image) {
      setSelectedProductImage("");
      return;
    }
    let cancelled = false;
    api.product(selectedProductId).then((full) => {
      if (!cancelled) setSelectedProductImage(full.image_url || "");
    }).catch(() => {
      if (!cancelled) setSelectedProductImage("");
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProductId, products]);

  function toggleCompactCards() {
    setCompactCards((v) => {
      const next = !v;
      localStorage.setItem("shabon-compact-cards", next ? "1" : "0");
      return next;
    });
    setSelectedProductId(null);
  }

  function toggleProductSelect(id) {
    setSelectedProductId((cur) => (cur === id ? null : id));
  }

  const showToast = useCallback((msg, error = false) => {
    setToast({ msg, error });
  }, []);

  const askConfirm = useCallback(({ message, confirmLabel = "OK", danger = false }) => {
    return new Promise((resolve) => {
      setConfirmState({ message, confirmLabel, danger, resolve });
    });
  }, []);

  const closeConfirm = useCallback((result) => {
    setConfirmState((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const checkAuth = useCallback(async () => {
    const me = await api.me();
    if (me.password_required && !me.authenticated) {
      setAuth(false);
    } else {
      setAuth(true);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummary(await api.summary());
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "history") {
        setMovements(await api.movements(search));
      } else {
        const activeOnly = tab === "active" || tab === "ledger";
        const items = await api.products(search, activeOnly, categoryFilter);
        setProducts(items);
        if (tab === "ledger") {
          const nextId =
            ledgerProductId && items.some((p) => p.id === ledgerProductId)
              ? ledgerProductId
              : items[0]?.id ?? null;
          setLedgerProductId(nextId);
          if (nextId) {
            setLedgerMovements(await api.productMovements(nextId));
          } else {
            setLedgerMovements([]);
          }
        }
      }
      await loadSummary();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setLoading(false);
    }
  }, [tab, search, categoryFilter, ledgerProductId, loadSummary, showToast]);

  const handleCancelMovement = useCallback(
    async (m) => {
      const label = TYPE_LABELS[m.type];
      const msg = [
        `この${label}記録（${formatDelta(movementDelta(m))}）を取り消しますか？`,
        `在庫数が ${m.after_qty} 個 → ${m.before_qty} 個に戻ります。`,
      ].join("\n");
      if (!(await askConfirm({ message: msg, confirmLabel: "取り消す", danger: true }))) return false;
      setCancellingId(m.id);
      try {
        await api.cancelMovement(m.id);
        showToast("履歴を取り消して削除しました");
        await loadData();
        return true;
      } catch (err) {
        showToast(err.message, true);
        return false;
      } finally {
        setCancellingId(null);
      }
    },
    [askConfirm, loadData, showToast]
  );

  const handleBulkCancelMovements = useCallback(
    async (ids) => {
      const msg = [
        `${ids.length}件の履歴を取り消して削除しますか？`,
        "在庫数がそれぞれ元に戻ります。",
      ].join("\n");
      if (!(await askConfirm({ message: msg, confirmLabel: "削除", danger: true }))) return;
      setBulkDeleting(true);
      try {
        const result = await api.bulkCancelMovements(ids);
        showToast(`${result.deleted}件の履歴を削除しました`);
        await loadData();
      } catch (err) {
        showToast(err.message, true);
      } finally {
        setBulkDeleting(false);
      }
    },
    [askConfirm, loadData, showToast]
  );

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!auth) return;
    api
      .categories()
      .then((rows) => {
        if (rows?.length) setCategories(rows);
      })
      .catch(() => {});
  }, [auth]);

  useEffect(() => {
    if (auth) loadData();
  }, [auth, loadData]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (auth) loadData();
    }, 280);
    return () => clearTimeout(t);
  }, [search, auth, loadData]);

  useEffect(() => {
    if (!auth || tab !== "ledger" || !ledgerProductId) {
      setLedgerMovements([]);
      return;
    }
    let cancelled = false;
    setLedgerMovementsLoading(true);
    api
      .productMovements(ledgerProductId)
      .then((rows) => {
        if (!cancelled) setLedgerMovements(rows);
      })
      .catch((err) => {
        if (!cancelled) showToast(err.message, true);
      })
      .finally(() => {
        if (!cancelled) setLedgerMovementsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, tab, ledgerProductId, showToast]);

  async function doImport() {
    if (
      !(await askConfirm({
        message: "デスクトップの価格一覧 Excel から再取込しますか？\n在庫・履歴は保持されます。",
        confirmLabel: "再取込",
      }))
    ) {
      return;
    }
    try {
      const r = await api.importExcel();
      showToast(`${r.count} 品目を取込（新規 ${r.added}）`);
      loadData();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function fetchOfficialImages() {
    if (
      !(await askConfirm({
        message:
          "公式通販（shabon.com）から商品写真を取得します。\nロゴ画像など既存の画像も、正しい商品写真に差し替えます。",
        confirmLabel: "開始",
      }))
    ) {
      return;
    }
    setFetchingImages(true);
    let totalUpdated = 0;
    let totalSkipped = 0;
    let prevRemaining = null;
    try {
      for (;;) {
        const r = await api.fetchOfficialImages(12, true);
        totalUpdated += r.updated;
        totalSkipped += r.skipped;
        if (r.done) {
          showToast(`画像取得完了：${totalUpdated}件登録（${totalSkipped}件スキップ）`);
          break;
        }
        if (prevRemaining !== null && r.remaining === prevRemaining && r.updated === 0) {
          showToast(`画像取得を終了：${totalUpdated}件登録（${totalSkipped}件スキップ）`, true);
          break;
        }
        prevRemaining = r.remaining;
        showToast(`取得中… ${totalUpdated}件完了（残り ${r.remaining} 件）`);
      }
      await loadData();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setFetchingImages(false);
    }
  }

  async function logout() {
    await api.logout();
    setAuth(false);
  }

  if (auth === null) {
    return <div className="login-page" style={{ color: "#fff" }}>読み込み中…</div>;
  }

  if (auth === false) {
    return <LoginScreen onLogin={() => setAuth(true)} />;
  }

  return (
    <>
      <div className="app-shell">
      <header className="header">
        <div className="header-inner">
          <h1 className="brand-title">シャボン玉石けん 在庫管理</h1>
          {summary && (
            <div className="chips">
              <span className="chip">登録 {summary.total}</span>
              <span className="chip">動きあり {summary.with_movements}</span>
              <span className="chip">在庫ゼロ {summary.zero_stock}</span>
              <span className="chip">要補充 {summary.low_stock}</span>
            </div>
          )}
          <button type="button" className="btn ghost small" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>

      <div className="layout">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => {
                setTab(t.id);
                setSearch("");
                setCategoryFilter("all");
                setSelectedProductId(null);
                setLedgerProductId(null);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="panel">
          <div className="panel-fixed">
          <div className="toolbar">
            <div className="toolbar-left">
              <input
                type="search"
                className="search"
                placeholder={
                  tab === "history"
                    ? "履歴を検索"
                    : tab === "ledger"
                      ? "増減履歴のある品目を検索"
                      : "コード・商品名・規格で検索"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {(tab === "stock" || tab === "active") && (
                <button
                  type="button"
                  className={`btn secondary ${compactCards ? "active-toggle" : ""}`}
                  onClick={toggleCompactCards}
                >
                  {compactCards ? "簡易表示 ON" : "簡易表示 OFF"}
                </button>
              )}
              {tab === "stock" && (
                <>
                  <button type="button" className="btn secondary" onClick={doImport}>
                    Excel再取込
                  </button>
                  <button type="button" className="btn secondary" onClick={loadData}>
                    更新
                  </button>
                </>
              )}
              {tab === "products" && (
                <>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={fetchOfficialImages}
                    disabled={fetchingImages}
                  >
                    {fetchingImages ? "画像取得中…" : "公式HPから画像取得"}
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => setModal({ type: "edit", product: null })}
                  >
                    新規品目
                  </button>
                </>
              )}
              {tab === "active" && (
                <span className="hint">入出庫の記録がある品目のみ</span>
              )}
              {tab === "ledger" && (
                <span className="hint">品目を選ぶと増減（＋／−）の履歴を表示します</span>
              )}
            </div>
            {compactCards && (tab === "stock" || tab === "active") && selectedProduct && (
              <CompactDetailPanel
                product={selectedProduct}
                imageUrl={selectedProductImage}
                categories={categories}
                onClose={() => setSelectedProductId(null)}
                onMove={(pr) => setModal({ type: "move", product: pr })}
                onEdit={(pr) => setModal({ type: "edit", product: pr })}
                onDetail={(pr) => setModal({ type: "detail", product: pr })}
                toast={showToast}
                onSaved={loadData}
              />
            )}
          </div>

          {(tab === "stock" || tab === "active" || tab === "products" || tab === "ledger") && (
            <div className="category-filters">
              {categoryFilters(categories).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`category-chip ${categoryChipClass(c.id, categories)} ${categoryFilter === c.id ? "active" : ""}`}
                  onClick={() => {
                    setCategoryFilter(c.id);
                    setSelectedProductId(null);
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {loading && <p className="panel-loading">読み込み中…</p>}
          </div>

          <div className="panel-scroll">
          {!loading && tab === "ledger" && (
            <ProductHistoryCorner
              products={products}
              selectedId={ledgerProductId}
              onSelect={setLedgerProductId}
              movements={ledgerMovements}
              loadingMovements={ledgerMovementsLoading}
              onMove={(pr) => setModal({ type: "move", product: pr })}
              onDetail={(pr) => setModal({ type: "detail", product: pr })}
              onCancel={handleCancelMovement}
              onBulkDelete={handleBulkCancelMovements}
              cancellingId={cancellingId}
              bulkDeleting={bulkDeleting}
            />
          )}

          {!loading && tab === "history" && (
            <MovementHistoryTable
              movements={movements}
              showProduct
              selectable
              emptyMessage="履歴がありません"
              onCancel={handleCancelMovement}
              onBulkDelete={handleBulkCancelMovements}
              cancellingId={cancellingId}
              bulkDeleting={bulkDeleting}
            />
          )}

          {!loading && tab === "products" && (
            <div className="table-wrap">
              {products.length === 0 ? (
                <p className="empty">品目がありません</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>コード</th>
                      <th>ジャンル</th>
                      <th>商品名</th>
                      <th>規格</th>
                      <th>ケース</th>
                      <th className="num">在庫</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>{p.code}</td>
                        <td>{p.category_label}</td>
                        <td>{p.name}</td>
                        <td>{p.spec}</td>
                        <td>{p.case_qty}</td>
                        <td className="num">{p.quantity}</td>
                        <td>
                          <button type="button" className="btn small secondary" onClick={() => setModal({ type: "edit", product: p })}>
                            編集
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {!loading && (tab === "stock" || tab === "active") && (
            <>
              {products.length === 0 ? (
                <p className="empty">該当する品目がありません</p>
              ) : (
                <div className={`card-grid ${compactCards ? "card-grid-compact" : ""}`}>
                  {products.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      compact={compactCards}
                      selected={selectedProductId === p.id}
                      categories={categories}
                      onSelect={toggleProductSelect}
                      onMove={(pr) => setModal({ type: "move", product: pr })}
                      onEdit={(pr) => setModal({ type: "edit", product: pr })}
                      onDetail={(pr) => setModal({ type: "detail", product: pr })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>
      </div>

      {modal?.type === "move" && (
        <MoveModal
          product={modal.product}
          onClose={() => setModal(null)}
          onSaved={loadData}
          toast={showToast}
        />
      )}
      {modal?.type === "edit" && (
        <EditModal
          key={modal.product?.id ?? "new"}
          product={modal.product}
          categories={categories}
          askConfirm={askConfirm}
          onClose={() => setModal(null)}
          onSaved={loadData}
          toast={showToast}
        />
      )}
      {modal?.type === "detail" && (
        <DetailModal
          product={modal.product}
          categories={categories}
          onClose={() => setModal(null)}
          onEdit={(p) => setModal({ type: "edit", product: p })}
          onCancel={handleCancelMovement}
          cancellingId={cancellingId}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        message={confirmState?.message ?? ""}
        confirmLabel={confirmState?.confirmLabel ?? "OK"}
        danger={confirmState?.danger ?? false}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />

      <Toast
        message={toast.msg}
        error={toast.error}
        onDone={() => setToast({ msg: "", error: false })}
      />
    </>
  );
}
