import type { RefImage } from "../state/refImageStore";

// Reference (CAD) images are large base64 data URLs. Storing them in localStorage
// blew the ~5 MB quota and silently evicted the catalog cache, so placed items lost
// their specs and vanished on refresh. IndexedDB has a far larger quota, so ref
// images live here instead, keyed by plan id.

const DB_NAME = "storeCanvasMediaDB";
const STORE = "refImages";
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

/** Loads every stored ref image, keyed by plan id. Returns {} on any failure. */
export async function loadAllRefImagesIDB(): Promise<Record<string, RefImage>> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      const out: Record<string, RefImage> = {};
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          out[String(cursor.key)] = cursor.value as RefImage;
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[refImageStorage] load failed:", e);
    return {};
  }
}

export async function putRefImageIDB(planId: string, img: RefImage): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(img, planId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[refImageStorage] save failed:", e);
  }
}

export async function deleteRefImageIDB(planId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(planId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
