// Full-app backup/restore. Everything in this app lives only in this
// browser's storage (localStorage + a couple of IndexedDB databases for
// files), so clearing the browser's data or moving to a new PC loses it
// all. This dumps every setting + stored file into one downloadable JSON
// file, and can restore from it later — on this browser or a fresh one.

interface BlobPayload {
  __blob: true;
  data: string; // base64
  type: string;
}

interface BackupData {
  version: 1;
  app: "exir-gamenet-monitor";
  exportedAt: string;
  localStorage: Record<string, string>;
  branding: { name: string; type: string; size: number; blob?: BlobPayload } | null;
  marketCategories: Record<string, unknown>[];
  marketProducts: (Record<string, unknown> & { image: BlobPayload | null })[];
  alertSound: { name: string; type: string; size: number; blob?: BlobPayload } | null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(((r.result as string) || "").split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, type: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function packBlob(blob: Blob | null | undefined, type: string): Promise<BlobPayload | undefined> {
  if (!blob) return undefined;
  return { __blob: true, data: await blobToBase64(blob), type };
}

// ── IndexedDB helpers (schemas mirrored from branding.ts / market.ts /
// alert-settings.ts so a restore works even on a brand-new browser). ──

function openExirMonitorDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("exir-monitor", 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("handles")) db.createObjectStore("handles");
      if (!db.objectStoreNames.contains("branding")) db.createObjectStore("branding");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openExirMarketDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("exir-market", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "id" });
      if (!db.objectStoreNames.contains("products")) db.createObjectStore("products", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openExirAlertsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("exir-alerts", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("sound")) db.createObjectStore("sound");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    if (key !== undefined) tx.objectStore(store).put(value, key);
    else tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbClear(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Export ───────────────────────────────────────────────────────────

export async function exportBackup(): Promise<Blob> {
  const localStorageDump: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const v = localStorage.getItem(k);
    if (v !== null) localStorageDump[k] = v;
  }

  let branding: BackupData["branding"] = null;
  try {
    const db = await openExirMonitorDB();
    const logo = await idbGet<{ blob: Blob; name: string; type: string; size: number }>(
      db,
      "branding",
      "logo",
    );
    if (logo) {
      branding = { name: logo.name, type: logo.type, size: logo.size, blob: await packBlob(logo.blob, logo.type) };
    }
  } catch {
    /* ignore — nothing stored yet */
  }

  let marketCategories: Record<string, unknown>[] = [];
  let marketProducts: BackupData["marketProducts"] = [];
  try {
    const db = await openExirMarketDB();
    marketCategories = await idbGetAll(db, "categories");
    const products = await idbGetAll<{
      id: string;
      name: string;
      price: number;
      categoryId: string | null;
      order: number;
      createdAt: number;
      image: { blob: Blob; type: string } | null;
    }>(db, "products");
    marketProducts = await Promise.all(
      products.map(async (p) => ({
        ...p,
        image: p.image ? { __blob: true as const, data: await blobToBase64(p.image.blob), type: p.image.type } : null,
      })),
    );
  } catch {
    /* ignore */
  }

  let alertSound: BackupData["alertSound"] = null;
  try {
    const db = await openExirAlertsDB();
    const snd = await idbGet<{ blob: Blob; name: string; type: string; size: number }>(db, "sound", "custom");
    if (snd) {
      alertSound = { name: snd.name, type: snd.type, size: snd.size, blob: await packBlob(snd.blob, snd.type) };
    }
  } catch {
    /* ignore */
  }

  const data: BackupData = {
    version: 1,
    app: "exir-gamenet-monitor",
    exportedAt: new Date().toISOString(),
    localStorage: localStorageDump,
    branding,
    marketCategories,
    marketProducts,
    alertSound,
  };

  return new Blob([JSON.stringify(data)], { type: "application/json" });
}

export function downloadBackup(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `exir-gamenet-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Import ───────────────────────────────────────────────────────────

export async function importBackup(file: File): Promise<{ ok: boolean; error?: string }> {
  let data: BackupData;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as BackupData;
    if (parsed.app !== "exir-gamenet-monitor") throw new Error("این فایل، فایل بکاپ این داشبورد نیست");
    data = parsed;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "فایل بکاپ نامعتبره یا خراب شده" };
  }

  try {
    for (const [k, v] of Object.entries(data.localStorage || {})) {
      localStorage.setItem(k, v);
    }
  } catch {
    /* storage quota — best effort, keep going */
  }

  try {
    if (data.branding?.blob) {
      const db = await openExirMonitorDB();
      const blob = base64ToBlob(data.branding.blob.data, data.branding.blob.type);
      await idbPut(
        db,
        "branding",
        { blob, name: data.branding.name, type: data.branding.type, size: data.branding.size },
        "logo",
      );
    }
  } catch {
    /* ignore */
  }

  try {
    const db = await openExirMarketDB();
    if (Array.isArray(data.marketCategories) && data.marketCategories.length) {
      await idbClear(db, "categories");
      for (const c of data.marketCategories) await idbPut(db, "categories", c);
    }
    if (Array.isArray(data.marketProducts) && data.marketProducts.length) {
      await idbClear(db, "products");
      for (const p of data.marketProducts) {
        const img = p.image as BlobPayload | null;
        const image = img?.__blob ? { blob: base64ToBlob(img.data, img.type), type: img.type } : null;
        await idbPut(db, "products", { ...p, image });
      }
    }
  } catch {
    /* ignore */
  }

  try {
    if (data.alertSound?.blob) {
      const db = await openExirAlertsDB();
      const blob = base64ToBlob(data.alertSound.blob.data, data.alertSound.blob.type);
      await idbPut(
        db,
        "sound",
        { blob, name: data.alertSound.name, type: data.alertSound.type, size: data.alertSound.size },
        "custom",
      );
    }
  } catch {
    /* ignore */
  }

  return { ok: true };
}
