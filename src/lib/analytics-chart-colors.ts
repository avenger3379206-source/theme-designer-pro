// User-customizable chart colors for the Analytics panel, with support for
// several saved profiles (create / rename / duplicate / delete / switch).
// Persisted in localStorage, same pattern as theme.ts / scrollbar-settings.ts.

export interface ChartColorPalette {
  hourBar: string;      // "ساعت‌های پرترافیک" bar color
  dayBar: string;       // "روند روزانه" bar color
  gameBarFrom: string;  // popular-games gradient start
  gameBarTo: string;    // popular-games gradient end
  gridLine: string;     // chart grid lines (rgba/hex/oklch — any valid CSS color)
  axisText: string;     // axis tick label color
}

export interface ChartColorProfile {
  id: string;
  name: string;
  colors: ChartColorPalette;
}

export const DEFAULT_CHART_COLORS: ChartColorPalette = {
  hourBar: "#22d3ee",     // var(--neon-cyan)
  dayBar: "#e879f9",      // var(--neon-magenta)
  gameBarFrom: "#22d3ee",
  gameBarTo: "#e879f9",
  gridLine: "rgba(255,255,255,0.06)",
  axisText: "#94a3b8",
};

const DEFAULT_PROFILE: ChartColorProfile = {
  id: "default",
  name: "پیش‌فرض",
  colors: DEFAULT_CHART_COLORS,
};

const PROFILES_KEY = "exir.analytics.chartProfiles.v1";
const ACTIVE_KEY = "exir.analytics.activeChartProfile.v1";
const EVENT = "exir:analytics-colors";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadChartProfiles(): ChartColorProfile[] {
  if (typeof window === "undefined") return [DEFAULT_PROFILE];
  const list = safeParse<ChartColorProfile[]>(localStorage.getItem(PROFILES_KEY), []);
  // Always guarantee the built-in default profile exists and is first.
  const withoutDefault = list.filter((p) => p.id !== "default");
  return [DEFAULT_PROFILE, ...withoutDefault];
}

function persistProfiles(profiles: ChartColorProfile[]) {
  // Never persist the built-in default profile itself — only user-created ones.
  const toSave = profiles.filter((p) => p.id !== "default");
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(toSave));
  } catch {
    /* ignore quota errors */
  }
}

export function loadActiveProfileId(): string {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem(ACTIVE_KEY) || "default";
}

export function setActiveProfileId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
  window.dispatchEvent(new Event(EVENT));
}

/** Resolves the palette that should actually be drawn right now. */
export function getActiveColors(): ChartColorPalette {
  const activeId = loadActiveProfileId();
  const profiles = loadChartProfiles();
  return profiles.find((p) => p.id === activeId)?.colors ?? DEFAULT_CHART_COLORS;
}

function genId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Creates a new profile (starting from the given colors) and makes it active. */
export function createProfile(name: string, colors: ChartColorPalette): ChartColorProfile {
  const profiles = loadChartProfiles();
  const profile: ChartColorProfile = { id: genId(), name: name.trim() || "بدون‌نام", colors };
  persistProfiles([...profiles, profile]);
  setActiveProfileId(profile.id);
  return profile;
}

/** Updates an existing (non-default) profile's colors and/or name in place. */
export function updateProfile(id: string, patch: Partial<Pick<ChartColorProfile, "name" | "colors">>) {
  if (id === "default") return; // built-in profile is read-only
  const profiles = loadChartProfiles().map((p) => (p.id === id ? { ...p, ...patch } : p));
  persistProfiles(profiles);
  window.dispatchEvent(new Event(EVENT));
}

/** Deletes a (non-default) profile. Falls back to "default" if it was active. */
export function deleteProfile(id: string) {
  if (id === "default") return;
  const profiles = loadChartProfiles().filter((p) => p.id !== id);
  persistProfiles(profiles);
  if (loadActiveProfileId() === id) setActiveProfileId("default");
  else window.dispatchEvent(new Event(EVENT));
}

export function duplicateProfile(id: string): ChartColorProfile | null {
  const source = loadChartProfiles().find((p) => p.id === id);
  if (!source) return null;
  return createProfile(`${source.name} (کپی)`, { ...source.colors });
}
