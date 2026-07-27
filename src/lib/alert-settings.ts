// Alert/notification settings — when to warn, how loud, and with what sound.
// The volume + conditions live in localStorage (tiny). The optional custom
// sound file can be up to 100MB, so it's stored in IndexedDB, same pattern
// as branding.ts / market.ts.

import { NOTIFICATION_SOUND_BASE64 } from "./notification-sound";

export interface AlertConditions {
  overheat: boolean; // GPU/CPU critical temperature on a client
  offline: boolean; // a client goes offline unexpectedly
  wanDown: boolean; // a ping target (WAN/game) loses connectivity
  reservationEnding: boolean; // a seat reservation is about to run out
  reservationEndingMinutes: number; // "about to run out" = this many minutes left
  reservationStarting: boolean; // a scheduled reservation is about to begin
  reservationStartingMinutes: number; // "about to begin" = this many minutes left
  peripheralDisconnected: boolean; // a client's keyboard/mouse/monitor drops out
  diskHealth: boolean; // a client's disk reports unhealthy/worn/read errors
  cameraMotion: boolean; // a CCTV camera reports motion
}

export type AlertSoundMode = "default" | "custom";

export interface AlertSettings {
  enabled: boolean; // master switch
  volume: number; // 0..100
  soundMode: AlertSoundMode;
  conditions: AlertConditions;
}

const KEY = "exir.alert.settings.v1";

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: true,
  volume: 70,
  soundMode: "default",
  conditions: {
    overheat: true,
    offline: true,
    wanDown: true,
    reservationEnding: true,
    reservationEndingMinutes: 5,
    reservationStarting: true,
    reservationStartingMinutes: 10,
    peripheralDisconnected: true,
    diskHealth: true,
    cameraMotion: true,
  },
};

export function loadAlertSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AlertSettings>;
      return {
        enabled: typeof p.enabled === "boolean" ? p.enabled : DEFAULT_ALERT_SETTINGS.enabled,
        volume: typeof p.volume === "number" ? p.volume : DEFAULT_ALERT_SETTINGS.volume,
        soundMode: p.soundMode === "custom" ? "custom" : "default",
        conditions: { ...DEFAULT_ALERT_SETTINGS.conditions, ...(p.conditions || {}) },
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ALERT_SETTINGS;
}

export function saveAlertSettings(s: AlertSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("exir:alert-settings"));
  } catch {
    /* ignore quota errors */
  }
}

// ── Custom alert sound (IndexedDB, up to 100MB) ────────────────────────

const SOUND_DB = "exir-alerts";
const SOUND_STORE = "sound";
const SOUND_KEY = "custom";
const SOUND_DB_VERSION = 1;
export const MAX_ALERT_SOUND_BYTES = 100 * 1024 * 1024; // 100MB

export interface StoredAlertSound {
  blob: Blob;
  name: string;
  type: string;
  size: number;
}

function openSoundDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SOUND_DB, SOUND_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SOUND_STORE)) db.createObjectStore(SOUND_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomAlertSound(file: File): Promise<{ ok: boolean; error?: string }> {
  if (file.size > MAX_ALERT_SOUND_BYTES) {
    return {
      ok: false,
      error: `فایل باید کمتر از ۱۰۰ مگابایت باشه (حجم فعلی: ${(file.size / 1024 / 1024).toFixed(1)} مگابایت)`,
    };
  }
  try {
    const db = await openSoundDB();
    const payload: StoredAlertSound = {
      blob: file,
      name: file.name,
      type: file.type || "audio/mpeg",
      size: file.size,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SOUND_STORE, "readwrite");
      tx.objectStore(SOUND_STORE).put(payload, SOUND_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    window.dispatchEvent(new CustomEvent("exir:alert-sound-changed"));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ذخیره‌سازی فایل صدا شکست خورد" };
  }
}

export async function loadCustomAlertSound(): Promise<StoredAlertSound | null> {
  try {
    const db = await openSoundDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SOUND_STORE, "readonly");
      const req = tx.objectStore(SOUND_STORE).get(SOUND_KEY);
      req.onsuccess = () => resolve((req.result as StoredAlertSound | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearCustomAlertSound(): Promise<void> {
  try {
    const db = await openSoundDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SOUND_STORE, "readwrite");
      tx.objectStore(SOUND_STORE).delete(SOUND_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    window.dispatchEvent(new CustomEvent("exir:alert-sound-changed"));
  } catch {
    /* ignore */
  }
}

// ── Playback ─────────────────────────────────────────────────────────
// Keeps a cached object URL for the custom sound so playAlertSound() can
// fire instantly without an async IndexedDB round-trip on every alert.

let cachedCustomUrl: string | null = null;
let cachedCustomLoaded = false;

async function ensureCustomSoundLoaded() {
  if (cachedCustomLoaded) return;
  cachedCustomLoaded = true;
  const s = await loadCustomAlertSound();
  if (s) cachedCustomUrl = URL.createObjectURL(s.blob);
}

if (typeof window !== "undefined") {
  ensureCustomSoundLoaded();
  window.addEventListener("exir:alert-sound-changed", () => {
    cachedCustomLoaded = false;
    if (cachedCustomUrl) {
      URL.revokeObjectURL(cachedCustomUrl);
      cachedCustomUrl = null;
    }
    ensureCustomSoundLoaded();
  });
}

/** Plays the configured alert sound at the configured volume. Safe to call
 * even if the browser hasn't allowed audio autoplay yet (fails silently). */
export function playAlertSound(settings: AlertSettings) {
  try {
    const useCustom = settings.soundMode === "custom" && cachedCustomUrl;
    const src = useCustom ? cachedCustomUrl! : `data:audio/wav;base64,${NOTIFICATION_SOUND_BASE64}`;
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, settings.volume / 100));
    void audio.play().catch(() => {
      /* autoplay can be blocked until the user interacts with the page once */
    });
  } catch {
    /* ignore */
  }
}
