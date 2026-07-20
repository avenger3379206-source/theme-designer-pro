// Theme is split into two independent axes:
//   • color  — palette only (6 dark gamer palettes)
//   • layout — physical shape / motion of the dashboard cards
//
// Both are applied via <html data-theme="..." data-layout="..."> and stored
// separately in localStorage.

export type ThemeId =
  | "neon-cyber"
  | "glass-aurora"
  | "blood-crimson"
  | "emerald-matrix"
  | "amber-retro"
  | "purple-void";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  fa: string;
  swatch: string[];
  desc: string;
}

export const THEMES: ThemeMeta[] = [
  { id: "neon-cyber",     name: "Neon Cyber",     fa: "نئون سایبر", swatch: ["#0b1226", "#1a2647", "#22d3ee", "#e879f9"], desc: "The original — deep navy with cyan/magenta neon." },
  { id: "glass-aurora",   name: "Glass Aurora",   fa: "شیشه‌ای",     swatch: ["#0b1226", "#1e2b52", "#7dd3fc", "#c084fc"], desc: "Same vibe, heavier glass blur, softer glows." },
  { id: "blood-crimson",  name: "Blood Crimson",  fa: "خون",         swatch: ["#140606", "#2a0e0e", "#ff3b3b", "#ffb347"], desc: "Dark red war-room feel." },
  { id: "emerald-matrix", name: "Emerald Matrix", fa: "ماتریکس",     swatch: ["#03130a", "#0a2818", "#22c55e", "#a3e635"], desc: "Green terminal / hacker vibe." },
  { id: "amber-retro",    name: "Amber Retro",    fa: "کهربایی",     swatch: ["#0f0a04", "#241705", "#f59e0b", "#fde047"], desc: "CRT amber phosphor look." },
  { id: "purple-void",    name: "Purple Void",    fa: "بنفش تاریک",  swatch: ["#0a041a", "#1a0b3d", "#a855f7", "#22d3ee"], desc: "Deep purple with electric accents." },
];

// ── Layouts — reshape the entire dashboard, not just colors ──────────────
export type LayoutId = "grid" | "honeycomb" | "orbit" | "strip";

export interface LayoutMeta {
  id: LayoutId;
  name: string;
  fa: string;
  desc: string;
}

export const LAYOUTS: LayoutMeta[] = [
  { id: "grid",      name: "Classic Grid",   fa: "کلاسیک",     desc: "چیدمان فعلی — کارت‌های مستطیلی منظم." },
  { id: "honeycomb", name: "Honeycomb",      fa: "کندوی زنبوری", desc: "ردیف‌های آجری آفست، کارت‌ها با برش شش‌ضلعی." },
  { id: "orbit",     name: "Orbit Cells",    fa: "مداری",       desc: "کارت‌ها گرد و شناور، با حلقه‌ی نئون در حال چرخش دور هر کدوم." },
  { id: "strip",     name: "Command Strip",  fa: "نوار فرمان",  desc: "لیست فشرده تک‌ستونی — همه‌ی متریک‌ها در یک نوار افقی." },
];

const KEY = "exir:theme";
const LKEY = "exir:layout";
export const DEFAULT_THEME: ThemeId = "neon-cyber";
export const DEFAULT_LAYOUT: LayoutId = "grid";

export function loadTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const v = localStorage.getItem(KEY) as ThemeId | null;
  return v && THEMES.some((t) => t.id === v) ? v : DEFAULT_THEME;
}
export function saveTheme(id: ThemeId) {
  localStorage.setItem(KEY, id);
  applyTheme(id);
  window.dispatchEvent(new Event("exir:theme"));
}
export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
}

export function loadLayout(): LayoutId {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  const v = localStorage.getItem(LKEY) as LayoutId | null;
  return v && LAYOUTS.some((l) => l.id === v) ? v : DEFAULT_LAYOUT;
}
export function saveLayout(id: LayoutId) {
  localStorage.setItem(LKEY, id);
  applyLayout(id);
  window.dispatchEvent(new Event("exir:layout"));
}
export function applyLayout(id: LayoutId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-layout", id);
}
