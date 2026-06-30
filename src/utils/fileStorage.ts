import type { FloorPlan } from "../types/model";

// Session-only state — handle is never persisted to localStorage
let activeHandle: FileSystemFileHandle | null = null;

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

export function getActiveHandle(): FileSystemFileHandle | null {
  return activeHandle;
}

export function getConnectedFileName(): string | null {
  return activeHandle?.name ?? null;
}

export function clearActiveHandle(): void {
  activeHandle = null;
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
  activeHandle = handle;
}

/** Create (or overwrite) a plans JSON file with the current plans. */
export async function createPlansFile(plans: FloorPlan[]): Promise<FileSystemFileHandle | null> {
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: "store-canvas-plans.json",
      types: [{ description: "Plans JSON", accept: { "application/json": [".json"] } }],
    });
    await writePlans(handle, plans);
    activeHandle = handle;
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
