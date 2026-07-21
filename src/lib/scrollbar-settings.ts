// User-customizable scrollbar appearance (thumb color, track color, width).
// Persisted in localStorage and applied as inline CSS custom properties on
// <html>, so it overrides the per-theme neon-cyan default in styles.css and
// survives theme switches.

export interface ScrollbarSettings {
  thumbColor: string; // hex, e.g. "#22d3ee"
  trackColor: string; // hex or "transparent"
  width: number; // px, 4..16
  glow: boolean; // neon glow around the thumb
}

const STORAGE_KEY = "exir.scrollbar.settings.v1";

export const DEFAULT_SCROLLBAR_SETTINGS: ScrollbarSettings = {
  thumbColor: "#22d3ee",
  trackColor: "transparent",
  width: 7,
  glow: true,
};

export function loadScrollbarSettings(): ScrollbarSettings {
  if (typeof window === "undefined") return DEFAULT_SCROLLBAR_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SCROLLBAR_SETTINGS, ...(JSON.parse(raw) as Partial<ScrollbarSettings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SCROLLBAR_SETTINGS;
}

export function saveScrollbarSettings(s: ScrollbarSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  applyScrollbarSettings(s);
  window.dispatchEvent(new Event("exir:scrollbar"));
}

export function applyScrollbarSettings(s: ScrollbarSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--scrollbar-thumb", s.thumbColor);
  root.setProperty("--scrollbar-track", s.trackColor || "transparent");
  root.setProperty("--scrollbar-width", `${s.width}px`);
  root.setProperty(
    "--scrollbar-shadow",
    s.glow ? `0 0 6px ${s.thumbColor}99` : "none",
  );
  root.setProperty(
    "--scrollbar-shadow-hover",
    s.glow ? `0 0 12px ${s.thumbColor}cc` : "none",
  );
}
