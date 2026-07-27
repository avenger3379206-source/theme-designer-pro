// Persistent history of fired alerts, backing the bell icon in the header.
// Separate from alert-settings.ts (which controls *whether* to alert) —
// this is the *log* of what already fired, kept until the user hits reset.

export interface AlertLogEntry {
  id: string;
  key: string; // same de-dupe key the alert engine used
  title: string;
  description: string;
  kind: "warning" | "error";
  createdAt: number; // epoch ms
  seen: boolean;
}

const KEY = "exir.alert.log.v1";
const MAX_ENTRIES = 100;

export function loadAlertLog(): AlertLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr as AlertLogEntry[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveAlertLog(entries: AlertLogEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* ignore quota errors */
  }
  window.dispatchEvent(new CustomEvent("exir:alert-log"));
}

export function pushAlertLog(entry: Omit<AlertLogEntry, "id" | "createdAt" | "seen">) {
  const list = loadAlertLog();
  const next: AlertLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    seen: false,
  };
  saveAlertLog([next, ...list]);
}

export function markAllAlertsSeen() {
  const list = loadAlertLog();
  if (list.length === 0 || list.every((e) => e.seen)) return;
  saveAlertLog(list.map((e) => ({ ...e, seen: true })));
}

export function clearAlertLog() {
  saveAlertLog([]);
}
