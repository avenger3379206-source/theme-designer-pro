// Global "text size" control — one slider for the whole app's base text
// (Persian + English both, since everything already reads --font-fa/--font-en
// off the same scale), and a second slider that adds EXTRA size on top of
// that for <header>/<footer> sections specifically (page title bars +
// bottom status strips), so headers/footers can sit "one size up" from the
// rest without touching a single component file.
//
// Implementation: applied as CSS `zoom` (see styles.css), not a root
// font-size/rem trick — most of this codebase uses fixed-px Tailwind
// classes (text-[9px], text-[11px], etc.) rather than rem units, so a
// font-size-based scale wouldn't reach them. `zoom` scales the *rendered*
// pixel size of everything inside the element (text, icons, gaps, borders)
// together, uniformly — the same mechanism as the browser's own page-zoom.
// zoom on a nested element compounds with the zoom on its ancestor, which
// is exactly how the header/footer "extra bump" stacks on top of the base
// scale below.

export interface UiScaleSettings {
  base: number; // 0.85–1.3 — overall scale for the whole app
  header: number; // 1–1.4 — EXTRA multiplier for <header>/<footer> only, on top of base
}

const STORAGE_KEY = "exir.ui-scale.v1";

export const DEFAULT_UI_SCALE: UiScaleSettings = { base: 1, header: 1.1 };

export const UI_SCALE_LIMITS = {
  base: { min: 0.85, max: 1.3, step: 0.01 },
  header: { min: 1, max: 1.4, step: 0.01 },
};

export function loadUiScale(): UiScaleSettings {
  if (typeof window === "undefined") return DEFAULT_UI_SCALE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_UI_SCALE, ...(JSON.parse(raw) as Partial<UiScaleSettings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_UI_SCALE;
}

export function saveUiScale(s: UiScaleSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota errors */
  }
  applyUiScale(s);
  window.dispatchEvent(new Event("exir:ui-scale"));
}

export function applyUiScale(s: UiScaleSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--ui-scale-base", String(s.base));
  root.setProperty("--ui-scale-header", String(s.header));
}
