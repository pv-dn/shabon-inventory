/** しゃぼん玉在庫専用のジャンル定義（他アプリと共有しない） */
export const CATEGORIES = [
  { id: "laundry", label: "洗濯" },
  { id: "face", label: "洗顔" },
  { id: "bath", label: "お風呂" },
  { id: "haircare", label: "ヘアケア" },
  { id: "kitchen", label: "台所" },
  { id: "hand", label: "手洗い" },
  { id: "tooth", label: "歯磨き" },
  { id: "other", label: "その他" },
];

const LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const VALID = new Set(CATEGORIES.map((c) => c.id));
const DEFAULT = "other";

export function normalizeCategories(cats) {
  const seen = [];
  const list = Array.isArray(cats) ? cats : [cats];
  for (const raw of list) {
    const cat = String(raw || "").trim();
    if (cat && VALID.has(cat) && !seen.includes(cat)) seen.push(cat);
  }
  return seen.length ? seen : [DEFAULT];
}

export function parseCategories(raw) {
  if (raw == null) return [DEFAULT];
  if (Array.isArray(raw)) return normalizeCategories(raw);
  const text = String(raw).trim();
  if (!text) return [DEFAULT];
  if (text.startsWith("[")) {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data)) return normalizeCategories(data);
    } catch {
      /* ignore */
    }
  }
  if (VALID.has(text)) return [text];
  return [DEFAULT];
}

export function serializeCategories(cats) {
  return JSON.stringify(normalizeCategories(cats));
}

export function categoriesLabel(cats) {
  return normalizeCategories(cats)
    .map((id) => LABELS[id] || id)
    .join("・");
}
