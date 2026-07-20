// Market (in-house POS) data layer — categories & products, product photos
// stored as blobs in IndexedDB (same pattern as branding.ts logo storage;
// localStorage would blow past its quota fast with real product photos).

const DB_NAME = "exir-market";
const DB_VERSION = 1;
const CATEGORY_STORE = "categories";
const PRODUCT_STORE = "products";

export interface MarketCategory {
  id: string;
  name: string;
  order: number;
}

export interface StoredProductImage {
  blob: Blob;
  type: string;
}

export interface MarketProduct {
  id: string;
  name: string;
  price: number;
  categoryId: string | null;
  order: number;
  createdAt: number;
  image: StoredProductImage | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CATEGORY_STORE)) {
        db.createObjectStore(CATEGORY_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PRODUCT_STORE)) {
        db.createObjectStore(PRODUCT_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function newMarketId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ── categories ──────────────────────────────────────────────────────────

export async function loadCategories(): Promise<MarketCategory[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(CATEGORY_STORE, "readonly");
      const req = tx.objectStore(CATEGORY_STORE).getAll();
      req.onsuccess = () =>
        resolve((req.result as MarketCategory[]).sort((a, b) => a.order - b.order));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveCategory(cat: MarketCategory): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE, "readwrite");
    tx.objectStore(CATEGORY_STORE).put(cat);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE, "readwrite");
    tx.objectStore(CATEGORY_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── products ─────────────────────────────────────────────────────────────

export async function loadProducts(): Promise<MarketProduct[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PRODUCT_STORE, "readonly");
      const req = tx.objectStore(PRODUCT_STORE).getAll();
      req.onsuccess = () =>
        resolve((req.result as MarketProduct[]).sort((a, b) => a.order - b.order));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveProduct(p: MarketProduct): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCT_STORE, "readwrite");
    tx.objectStore(PRODUCT_STORE).put(p);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCT_STORE, "readwrite");
    tx.objectStore(PRODUCT_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Reassign every product in a deleted category to "no category".
export async function clearProductsCategory(categoryId: string): Promise<void> {
  const products = await loadProducts();
  const affected = products.filter((p) => p.categoryId === categoryId);
  for (const p of affected) {
    await saveProduct({ ...p, categoryId: null });
  }
}

export const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
