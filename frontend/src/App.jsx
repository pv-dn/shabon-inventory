import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

const TYPE_LABELS = { in: "入庫", out: "出庫", adjust: "棚卸" };
const TABS = [
  { id: "stock", label: "在庫一覧" },
  { id: "active", label: "動きのある品目" },
  { id: "products", label: "品目編集" },
  { id: "history", label: "入出庫履歴" },
];

const CATEGORY_OPTIONS = [
  { id: "laundry", label: "洗濯" },
  { id: "face", label: "洗顔" },
  { id: "bath", label: "お風呂" },
  { id: "hand", label: "手洗い" },
  { id: "tooth", label: "歯磨き" },
  { id: "other", label: "その他" },
];

const CATEGORY_FILTERS = [{ id: "all", label: "すべて" }, ...CATEGORY_OPTIONS];

function formatDate(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

function formatPrice(v) {
  if (v == null || v === "") return "—";
  return `${Number(v).toLocaleString()}円`;
}

function stockClass(p) {
  if (p.quantity === 0) return "zero";
  if (p.min_stock > 0 && p.quantity <= p.min_stock) return "low";
  return "";
}

function Toast({ message, error, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!message) return null;
  return <div className={`toast ${error ? "error" : ""}`}>{message}</div>;
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
        <h1>シャボン玉石けん</h1>
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

function ProductCard({ product, compact, expanded, onToggleExpand, onMove, onEdit, onDetail }) {
  if (compact && !expanded) {
    return (
      <article
        className={`product-card compact ${stockClass(product)}`}
        onClick={() => onToggleExpand(product.id)}
        onKeyDown={(e) => e.key === "Enter" && onToggleExpand(product.id)}
        role="button"
        tabIndex={0}
        title="クリックで詳細を表示"
      >
        <div className="compact-name">
          {product.category_label && (
            <span className="category-tag">{product.category_label}</span>
          )}
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
    <article className={`product-card ${stockClass(product)} ${compact ? "expanded" : ""}`}>
      {compact && (
        <button
          type="button"
          className="card-fold"
          onClick={() => onToggleExpand(product.id)}
          aria-label="畳む"
        >
          −
        </button>
      )}
      <div className="card-code">
        {product.code}
        {product.category_label && (
          <span className="category-tag inline">{product.category_label}</span>
        )}
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

function EditModal({ product, onClose, onSaved, toast }) {
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
    category: product?.category || "other",
  });
  const [meta, setMeta] = useState("");

  useEffect(() => {
    if (!isNew && product?.id) {
      api.productMovements(product.id).then((m) => {
        setMeta(`現在庫 ${product.quantity} / 履歴 ${m.length} 件`);
      });
    }
  }, [isNew, product]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    try {
      if (isNew) await api.createProduct(form);
      else await api.updateProduct(product.id, form);
      toast(isNew ? "品目を追加しました" : "保存しました");
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function remove() {
    if (!confirm(meta.includes("履歴") ? "品目と履歴を削除しますか？" : "この品目を削除しますか？")) return;
    try {
      await api.deleteProduct(product.id);
      toast("削除しました");
      onSaved();
      onClose();
    } catch (err) {
      toast(err.message, true);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? "新規品目" : "品目編集"}</h2>
        {meta && <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{meta}</p>}
        <form onSubmit={save}>
          <div className="form-grid">
            <label>
              商品コード *
              <input value={form.code} onChange={(e) => set("code", e.target.value)} required />
            </label>
            <label>
              商品名 *
              <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </label>
            <label>
              ジャンル *
              <select value={form.category} onChange={(e) => set("category", e.target.value)} required>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              規格
              <input value={form.spec} onChange={(e) => set("spec", e.target.value)} />
            </label>
            <label>
              ケース入数
              <input value={form.case_qty} onChange={(e) => set("case_qty", e.target.value)} />
            </label>
            <label>
              一般価格
              <input type="number" min={0} value={form.retail_price} onChange={(e) => set("retail_price", e.target.value)} />
            </label>
            <label>
              会員価格
              <input type="number" min={0} value={form.member_price} onChange={(e) => set("member_price", e.target.value)} />
            </label>
            <label>
              補充下限
              <input type="number" min={0} value={form.min_stock} onChange={(e) => set("min_stock", e.target.value)} />
            </label>
            <label className="full">
              メモ
              <input value={form.note} onChange={(e) => set("note", e.target.value)} />
            </label>
          </div>
          <div className={`modal-actions ${!isNew ? "spread" : ""}`}>
            {!isNew && (
              <button type="button" className="btn danger" onClick={remove}>
                削除
              </button>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="btn secondary" onClick={onClose}>
                キャンセル
              </button>
              <button type="submit" className="btn primary">
                保存
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailModal({ product, onClose, onEdit }) {
  const [movements, setMovements] = useState([]);

  useEffect(() => {
    api.productMovements(product.id).then(setMovements);
  }, [product.id]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>
          {product.code} {product.name}
        </h2>
        <dl className="detail-grid">
          <dt>ジャンル</dt>
          <dd>{product.category_label || "—"}</dd>
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
        <h3 style={{ marginTop: "1.25rem" }}>入出庫履歴</h3>
        {movements.length === 0 ? (
          <p className="empty">履歴なし</p>
        ) : (
          <div className="table-wrap" style={{ maxHeight: "240px" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>種別</th>
                  <th className="num">数量</th>
                  <th className="num">前→後</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.created_at)}</td>
                    <td>
                      <span className={`badge badge-${m.type}`}>{TYPE_LABELS[m.type]}</span>
                    </td>
                    <td className="num">{m.quantity}</td>
                    <td className="num">
                      {m.before_qty} → {m.after_qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ msg: "", error: false });
  const [modal, setModal] = useState(null);
  const [compactCards, setCompactCards] = useState(
    () => localStorage.getItem("shabon-compact-cards") !== "0"
  );
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  function toggleCompactCards() {
    setCompactCards((v) => {
      const next = !v;
      localStorage.setItem("shabon-compact-cards", next ? "1" : "0");
      return next;
    });
    setExpandedCardId(null);
  }

  function toggleCardExpand(id) {
    setExpandedCardId((cur) => (cur === id ? null : id));
  }

  const showToast = useCallback((msg, error = false) => {
    setToast({ msg, error });
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
        const activeOnly = tab === "active";
        setProducts(await api.products(search, activeOnly, categoryFilter));
      }
      await loadSummary();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setLoading(false);
    }
  }, [tab, search, categoryFilter, loadSummary, showToast]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (auth) loadData();
  }, [auth, loadData]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (auth) loadData();
    }, 280);
    return () => clearTimeout(t);
  }, [search, auth, loadData]);

  async function doImport() {
    if (!confirm("デスクトップの価格一覧 Excel から再取込しますか？\n在庫・履歴は保持されます。")) return;
    try {
      const r = await api.importExcel();
      showToast(`${r.count} 品目を取込（新規 ${r.added}）`);
      loadData();
    } catch (err) {
      showToast(err.message, true);
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
      <header className="header">
        <div className="header-inner">
          <h1>シャボン玉石けん 在庫管理</h1>
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
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="panel">
          <div className="toolbar">
            <input
              type="search"
              className="search"
              placeholder={
                tab === "history" ? "履歴を検索" : "コード・商品名・規格で検索"
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
              <button
                type="button"
                className="btn primary"
                onClick={() => setModal({ type: "edit", product: null })}
              >
                新規品目
              </button>
            )}
            {tab === "active" && (
              <span className="hint">入出庫の記録がある品目のみ</span>
            )}
          </div>

          {(tab === "stock" || tab === "active" || tab === "products") && (
            <div className="category-filters">
              {CATEGORY_FILTERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`category-chip ${categoryFilter === c.id ? "active" : ""}`}
                  onClick={() => setCategoryFilter(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {loading && <p style={{ color: "var(--muted)" }}>読み込み中…</p>}

          {!loading && tab === "history" && (
            <div className="table-wrap">
              {movements.length === 0 ? (
                <p className="empty">履歴がありません</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>日時</th>
                      <th>コード</th>
                      <th>商品名</th>
                      <th>種別</th>
                      <th className="num">数量</th>
                      <th className="num">前</th>
                      <th className="num">後</th>
                      <th>メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td>{formatDate(m.created_at)}</td>
                        <td>{m.code}</td>
                        <td>{m.name}</td>
                        <td>
                          <span className={`badge badge-${m.type}`}>{TYPE_LABELS[m.type]}</span>
                        </td>
                        <td className="num">{m.quantity}</td>
                        <td className="num">{m.before_qty}</td>
                        <td className="num">{m.after_qty}</td>
                        <td>{m.memo || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
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
                      expanded={expandedCardId === p.id}
                      onToggleExpand={toggleCardExpand}
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
          product={modal.product}
          onClose={() => setModal(null)}
          onSaved={loadData}
          toast={showToast}
        />
      )}
      {modal?.type === "detail" && (
        <DetailModal
          product={modal.product}
          onClose={() => setModal(null)}
          onEdit={(p) => setModal({ type: "edit", product: p })}
        />
      )}

      <Toast
        message={toast.msg}
        error={toast.error}
        onDone={() => setToast({ msg: "", error: false })}
      />
    </>
  );
}
