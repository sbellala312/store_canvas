import type { FloorPlan, Kit } from "../types/model";

const PLANS_KEY = "storeCanvas.plans";
const ACTIVE_KEY = "storeCanvas.activePlanId";
const KITS_KEY = "storeCanvas.kits";
const FOLDERS_KEY = "storeCanvas.folders";

export function loadPlans(): FloorPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate zones that predate the rect/polygon discriminator.
    for (const plan of parsed) {
      if (!plan?.zones) continue;
      for (const z of plan.zones) {
        if (!z.kind) z.kind = "rect";
      }
      // Migrate nonUsable regions that predate the rect/polygon discriminator.
      for (const n of plan.nonUsable ?? []) {
        if (!n.kind) n.kind = "rect";
      }
      if (!plan.doors) plan.doors = [];
      if (!plan.windows) plan.windows = [];
      for (const d of plan.doors) {
        if (!d.kind) d.kind = "single";
      }
    }
    return parsed;
  } catch {
    return [];
  }
}

export function savePlans(plans: FloorPlan[]): void {
  try {
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  } catch (e) {
    // Quota exceeded (e.g. a legacy ref image still occupying localStorage until it
    // migrates to IndexedDB). Never crash the app — keep plans in memory. Once the ref
    // image migrates out of localStorage, a later save persists them.
    console.warn("[persistence] savePlans failed (storage quota); plans kept in memory only.", e);
  }
}

export function loadActivePlanId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActivePlanId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function loadKits(): Kit[] {
  try {
    const raw = localStorage.getItem(KITS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveKits(kits: Kit[]): void {
  localStorage.setItem(KITS_KEY, JSON.stringify(kits));
}

export function loadFolders(): string[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((f) => typeof f === "string") : [];
  } catch {
    return [];
  }
}

export function saveFolders(folders: string[]): void {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch {
    /* ignore quota errors */
  }
}

const SCALE_KEY = "storeCanvas.scaleRatio";

export function loadScaleRatio(): number {
  try {
    const v = localStorage.getItem(SCALE_KEY);
    return v ? parseFloat(v) : 48;
  } catch {
    return 48;
  }
}

export function saveScaleRatio(n: number): void {
  localStorage.setItem(SCALE_KEY, String(n));
}

const REF_IMAGES_KEY = "storeCanvas.refImages";

export function loadRefImages(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(REF_IMAGES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveRefImages(images: Record<string, unknown>): void {
  try {
    localStorage.setItem(REF_IMAGES_KEY, JSON.stringify(images));
  } catch {
    // Quota exceeded (large image data URLs) — skip silently
  }
}

// Ref images now live in IndexedDB (see refImageStorage.ts). This removes the old
// localStorage copy after migration to reclaim the quota it was consuming.
export function clearLegacyRefImages(): void {
  try {
    localStorage.removeItem(REF_IMAGES_KEY);
  } catch {
    /* ignore */
  }
}
