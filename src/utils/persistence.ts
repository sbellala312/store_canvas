import type { FloorPlan, Kit } from "../types/model";

const PLANS_KEY = "storeCanvas.plans";
const ACTIVE_KEY = "storeCanvas.activePlanId";
const KITS_KEY = "storeCanvas.kits";

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
    }
    return parsed;
  } catch {
    return [];
  }
}

export function savePlans(plans: FloorPlan[]): void {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
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
