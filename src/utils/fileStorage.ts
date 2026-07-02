import type { FloorPlan } from "../types/model";

// ---------------------------------------------------------------------------
// In-memory handle (on globalThis so Vite HMR reloads don't wipe it)
// ---------------------------------------------------------------------------
const HANDLE_KEY = "__storeCanvasFileHandle__" as const;

function getHandleFromGlobal(): FileSystemFileHandle | null {
  return (globalThis as Record<string, unknown>)[HANDLE_KEY] as FileSystemFileHandle | null ?? null;
}

function setHandleInGlobal(handle: FileSystemFileHandle | null): void {
  (globalThis as Record<string, unknown>)[HANDLE_KEY] = handle;
}

// ---------------------------------------------------------------------------
// IndexedDB persistence — survives full page refreshes
// File System Access API handles are structured-cloneable, so IDB stores them.
// ---------------------------------------------------------------------------
const DB_NAME = "storeCanvasDB";
const STORE_NAME = "fileHandles";
const HANDLE_IDB_KEY = "activePlanFile";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

async function saveHandleToDB(handle: FileSystemFileHandle): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(handle, HANDLE_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[fileStorage] IDB save failed:", e);
  }
}

async function loadHandleFromDB(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDB();
    return await new Promise<FileSystemFileHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(HANDLE_IDB_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[fileStorage] IDB load failed:", e);
    return null;
  }
}

async function clearHandleFromDB(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(HANDLE_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

export function getActiveHandle(): FileSystemFileHandle | null {
  return getHandleFromGlobal();
}

export function getConnectedFileName(): string | null {
  return getHandleFromGlobal()?.name ?? null;
}

export function clearActiveHandle(): void {
  setHandleInGlobal(null);
  clearHandleFromDB();
}

/**
 * Called on app startup to restore the last-used file handle from IndexedDB.
 * - If the browser still has permission (same session), auto-restores silently.
 * - Otherwise returns the handle so the UI can show a "Reconnect?" prompt.
 * Returns null if no stored handle exists.
 */
export async function tryRestoreHandle(): Promise<
  { handle: FileSystemFileHandle; autoRestored: boolean } | null
> {
  const handle = await loadHandleFromDB();
  if (!handle) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perm = await (handle as any).queryPermission({ mode: "readwrite" });
    if (perm === "granted") {
      setHandleInGlobal(handle);
      return { handle, autoRestored: true };
    }
    return { handle, autoRestored: false };
  } catch {
    return { handle, autoRestored: false };
  }
}

/** Open an existing plans JSON file. Returns loaded plans or null if cancelled. */
export async function openPlansFile(): Promise<{
  handle: FileSystemFileHandle;
  plans: FloorPlan[];
} | null> {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{ description: "Plans JSON", accept: { "application/json": [".json"] } }],
      multiple: false,
    });
    const permission = await handle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") return null;

    const file = await handle.getFile();
    const text = await file.text();
    let plans: FloorPlan[] = [];
    try {
      const parsed = JSON.parse(text);
      plans = Array.isArray(parsed) ? parsed : [];
    } catch {
      plans = [];
    }
    // Caller decides whether to activate this handle after showing a confirmation dialog
    return { handle, plans };
  } catch {
    // User cancelled or permission denied
    return null;
  }
}

/** Activate a handle that was previously returned by openPlansFile. */
export function setActiveHandle(handle: FileSystemFileHandle): void {
  setHandleInGlobal(handle);
  saveHandleToDB(handle);
}

/** Create (or overwrite) a plans JSON file with the current plans. */
export async function createPlansFile(plans: FloorPlan[]): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: "store-canvas-plans.json",
      types: [{ description: "Plans JSON", accept: { "application/json": [".json"] } }],
    });
    await writePlans(handle, plans);
    setHandleInGlobal(handle);
    saveHandleToDB(handle);
    return handle;
  } catch {
    return null;
  }
}

/** Write plans to a file handle. */
export async function writePlans(
  handle: FileSystemFileHandle,
  plans: FloorPlan[],
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(plans, null, 2));
  await writable.close();
}
