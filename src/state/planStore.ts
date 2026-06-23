import { create } from "zustand";
import { v4 as uuid } from "uuid";
import type {
  FloorPlan,
  PlacedItem,
  Zone,
  ZoneRect,
  ZonePolygon,
  NonUsableRegion,
  NonUsableRect,
  NonUsablePolygon,
  Wall,
  Kit,
  Tool,
  Point,
  FloorShape,
} from "../types/model";
import {
  loadPlans,
  savePlans,
  loadActivePlanId,
  saveActivePlanId,
  loadKits,
  saveKits,
} from "../utils/persistence";
import { CATALOG_BY_ID } from "../data/catalog";
import { clampRectToFloor, clampPointToFloor, floorBBox } from "../utils/geometry";

const MAX_HISTORY = 50;

interface History {
  past: FloorPlan[];
  future: FloorPlan[];
}

interface State {
  plans: FloorPlan[];
  activePlanId: string | null;
  kits: Kit[];

  tool: Tool;
  selectionIds: string[];
  zoneEditMode: "view" | "move" | "resize";
  nonUsableEditMode: "view" | "move" | "resize";
  pixelsPerInch: number;
  zoom: number;
  pan: { x: number; y: number };

  history: Record<string, History>;
}

interface Actions {
  // Plan management
  createPlan: (name: string, floor: FloorShape) => string;
  duplicatePlan: (id: string, newName?: string) => string | null;
  renamePlan: (id: string, newName: string) => void;
  updatePlanFloor: (id: string, name: string, floor: FloorShape) => void;
  deletePlan: (id: string) => void;
  setActivePlan: (id: string) => void;
  getActivePlan: () => FloorPlan | null;

  // Mutations on active plan
  updateActive: (fn: (plan: FloorPlan) => void, opts?: { skipHistory?: boolean }) => void;

  addPlacedItem: (item: Omit<PlacedItem, "id">) => string;
  updatePlacedItem: (id: string, patch: Partial<PlacedItem>) => void;
  deletePlacedItems: (ids: string[]) => void;
  duplicatePlacedItems: (ids: string[]) => string[];

  addZone: (zone: Omit<ZoneRect, "id"> | Omit<ZonePolygon, "id">) => void;
  updateZone: (id: string, patch: Partial<ZoneRect> & Partial<ZonePolygon>) => void;
  moveZoneBy: (id: string, dx: number, dy: number) => void;
  deleteZone: (id: string) => void;

  addNonUsable: (r: Omit<NonUsableRect, "id"> | Omit<NonUsablePolygon, "id">) => void;
  updateNonUsable: (id: string, patch: Partial<Omit<NonUsableRect, "id" | "kind">> & Partial<Omit<NonUsablePolygon, "id" | "kind">>) => void;
  moveNonUsableBy: (id: string, dx: number, dy: number) => void;
  deleteNonUsable: (id: string) => void;

  addWall: (w: Omit<Wall, "id">) => void;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  deleteWall: (id: string) => void;

  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleLabels: () => void;
  setGridSize: (size: number) => void;

  // Kits
  saveKit: (name: string, ids: string[]) => void;
  deleteKit: (id: string) => void;
  stampKit: (kitId: string, dropX: number, dropY: number) => void;

  // UI state
  setTool: (tool: Tool) => void;
  setSelection: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  clearSelection: () => void;
  setZoneEditMode: (mode: "view" | "move" | "resize") => void;
  setNonUsableEditMode: (mode: "view" | "move" | "resize") => void;
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const initialPlans = loadPlans();
const initialActive = loadActivePlanId();
const initialActiveValid =
  initialActive && initialPlans.some((p) => p.id === initialActive)
    ? initialActive
    : initialPlans[0]?.id ?? null;

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function findMatchingKit(
  selectionIds: string[],
  placedItems: PlacedItem[],
  kits: Kit[],
): Kit | null {
  if (selectionIds.length === 0 || kits.length === 0) return null;
  const selectedItems = selectionIds
    .map((id) => placedItems.find((i) => i.id === id))
    .filter((i): i is PlacedItem => i !== null && i !== undefined);
  if (selectedItems.length !== selectionIds.length) return null;
  const selectedCatalogIds = selectedItems.map((i) => i.catalogId).sort();
  for (const kit of kits) {
    const kitCatalogIds = kit.items.map((i) => i.catalogId).sort();
    if (
      kitCatalogIds.length === selectedCatalogIds.length &&
      kitCatalogIds.every((id, idx) => id === selectedCatalogIds[idx])
    ) {
      return kit;
    }
  }
  return null;
}

function persistAllPlans(plans: FloorPlan[]): void {
  savePlans(plans);
}

export const usePlanStore = create<State & Actions>((set, get) => ({
  plans: initialPlans,
  activePlanId: initialActiveValid,
  kits: loadKits(),

  tool: "select",
  selectionIds: [],
  zoneEditMode: "view",
  nonUsableEditMode: "view",
  pixelsPerInch: 2,
  zoom: 1,
  pan: { x: 0, y: 0 },

  history: {},

  createPlan: (name, floor) => {
    const id = uuid();
    const now = Date.now();
    const plan: FloorPlan = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      floor,
      gridSize: 6,
      snapEnabled: false,
      showGrid: true,
      showLabels: true,
      zones: [],
      nonUsable: [],
      walls: [],
      placedItems: [],
    };
    set((s) => {
      const plans = [...s.plans, plan];
      persistAllPlans(plans);
      saveActivePlanId(id);
      return { plans, activePlanId: id, selectionIds: [], tool: "select" };
    });
    return id;
  },

  duplicatePlan: (id, newName) => {
    const src = get().plans.find((p) => p.id === id);
    if (!src) return null;
    const copy: FloorPlan = clone(src);
    copy.id = uuid();
    copy.name = newName ?? `${src.name} (copy)`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    set((s) => {
      const plans = [...s.plans, copy];
      persistAllPlans(plans);
      saveActivePlanId(copy.id);
      return { plans, activePlanId: copy.id, selectionIds: [] };
    });
    return copy.id;
  },

  renamePlan: (id, newName) => {
    set((s) => {
      const plans = s.plans.map((p) =>
        p.id === id ? { ...p, name: newName, updatedAt: Date.now() } : p,
      );
      persistAllPlans(plans);
      return { plans };
    });
  },

  updatePlanFloor: (id, name, floor) => {
    set((s) => {
      const target = s.plans.find((p) => p.id === id);
      if (!target) return {};
      const before = clone(target);
      const next = clone(target);
      next.name = name;
      next.floor = floor;
      next.updatedAt = Date.now();
      const plans = s.plans.map((p) => (p.id === id ? next : p));
      persistAllPlans(plans);
      const history = { ...s.history };
      const h = history[id] ?? { past: [], future: [] };
      history[id] = {
        past: [...h.past, before].slice(-MAX_HISTORY),
        future: [],
      };
      return { plans, history };
    });
  },

  deletePlan: (id) => {
    set((s) => {
      const plans = s.plans.filter((p) => p.id !== id);
      persistAllPlans(plans);
      let activePlanId = s.activePlanId;
      if (activePlanId === id) {
        activePlanId = plans[0]?.id ?? null;
        saveActivePlanId(activePlanId);
      }
      const history = { ...s.history };
      delete history[id];
      return { plans, activePlanId, history, selectionIds: [] };
    });
  },

  setActivePlan: (id) => {
    set({ activePlanId: id, selectionIds: [] });
    saveActivePlanId(id);
  },

  getActivePlan: () => {
    const s = get();
    return s.plans.find((p) => p.id === s.activePlanId) ?? null;
  },

  updateActive: (fn, opts) => {
    set((s) => {
      const plan = s.plans.find((p) => p.id === s.activePlanId);
      if (!plan) return {};
      const before = clone(plan);
      const next = clone(plan);
      fn(next);
      next.updatedAt = Date.now();
      const plans = s.plans.map((p) => (p.id === plan.id ? next : p));
      persistAllPlans(plans);
      const history = { ...s.history };
      if (!opts?.skipHistory) {
        const h = history[plan.id] ?? { past: [], future: [] };
        const past = [...h.past, before].slice(-MAX_HISTORY);
        history[plan.id] = { past, future: [] };
      }
      return { plans, history };
    });
  },

  addPlacedItem: (item) => {
    const id = uuid();
    get().updateActive((p) => {
      p.placedItems.push({ ...item, id });
    });
    return id;
  },

  updatePlacedItem: (id, patch) => {
    get().updateActive((p) => {
      const idx = p.placedItems.findIndex((i) => i.id === id);
      if (idx >= 0) p.placedItems[idx] = { ...p.placedItems[idx], ...patch };
    });
  },

  deletePlacedItems: (ids) => {
    const ids2 = new Set(ids);
    get().updateActive((p) => {
      p.placedItems = p.placedItems.filter((i) => !ids2.has(i.id));
    });
    get().clearSelection();
  },

  duplicatePlacedItems: (ids) => {
    const newIds: string[] = [];
    const idMap = new Map<string, string>();
    get().updateActive((p) => {
      const originals = p.placedItems.filter((i) => ids.includes(i.id));
      for (const orig of originals) {
        const newId = uuid();
        idMap.set(orig.id, newId);
        const copy: PlacedItem = {
          ...orig,
          id: newId,
          x: orig.x + 12,
          y: orig.y + 12,
        };
        p.placedItems.push(copy);
        newIds.push(newId);
      }
      for (const orig of p.placedItems) {
        if (orig.parentId && idMap.has(orig.parentId) && newIds.includes(orig.id)) {
          orig.parentId = idMap.get(orig.parentId);
        }
      }
    });
    return newIds;
  },

  addZone: (zone) => {
    get().updateActive((p) => {
      let next = { ...zone, id: uuid() } as Zone;
      if (next.kind === "rect") {
        const c = clampRectToFloor(next, p.floor);
        next = { ...next, ...c };
      } else {
        next = { ...next, points: next.points.map((pt) => clampPointToFloor(pt, p.floor)) };
      }
      p.zones.push(next);
    });
  },
  updateZone: (id, patch) => {
    get().updateActive((p) => {
      const idx = p.zones.findIndex((z) => z.id === id);
      if (idx < 0) return;
      let merged = { ...p.zones[idx], ...patch } as Zone;
      if (merged.kind === "rect") {
        const c = clampRectToFloor(merged, p.floor);
        merged = { ...merged, ...c };
      } else {
        merged = { ...merged, points: merged.points.map((pt) => clampPointToFloor(pt, p.floor)) };
      }
      p.zones[idx] = merged;
    });
  },
  moveZoneBy: (id, dx, dy) => {
    get().updateActive((p) => {
      const idx = p.zones.findIndex((z) => z.id === id);
      if (idx < 0) return;
      const z = p.zones[idx];
      if (z.kind === "rect") {
        const c = clampRectToFloor({ x: z.x + dx, y: z.y + dy, width: z.width, height: z.height }, p.floor);
        p.zones[idx] = { ...z, x: c.x, y: c.y };
      } else {
        const moved = z.points.map((pt) => clampPointToFloor({ x: pt.x + dx, y: pt.y + dy }, p.floor));
        p.zones[idx] = { ...z, points: moved };
      }
    });
  },
  deleteZone: (id) => {
    get().updateActive((p) => {
      p.zones = p.zones.filter((z) => z.id !== id);
    });
  },

  addNonUsable: (r) => {
    get().updateActive((p) => {
      if (r.kind === "polygon") {
        const clamped = r.points.map((pt) => clampPointToFloor(pt, p.floor));
        p.nonUsable.push({ ...r, points: clamped, id: uuid() });
      } else {
        const c = clampRectToFloor(r, p.floor);
        p.nonUsable.push({ ...r, ...c, id: uuid() });
      }
    });
  },
  updateNonUsable: (id, patch) => {
    get().updateActive((p) => {
      const idx = p.nonUsable.findIndex((n) => n.id === id);
      if (idx < 0) return;
      const current = p.nonUsable[idx];
      if (current.kind === "polygon") {
        const merged = { ...current, ...patch } as NonUsablePolygon;
        if (merged.points) {
          merged.points = merged.points.map((pt) => clampPointToFloor(pt, p.floor));
        }
        p.nonUsable[idx] = merged;
      } else {
        const merged = { ...current, ...patch } as NonUsableRect;
        const c = clampRectToFloor(merged, p.floor);
        p.nonUsable[idx] = { ...merged, ...c };
      }
    });
  },
  moveNonUsableBy: (id, dx, dy) => {
    get().updateActive((p) => {
      const idx = p.nonUsable.findIndex((n) => n.id === id);
      if (idx < 0) return;
      const n = p.nonUsable[idx];
      if (n.kind === "polygon") {
        const moved = n.points.map((pt) => clampPointToFloor({ x: pt.x + dx, y: pt.y + dy }, p.floor));
        p.nonUsable[idx] = { ...n, points: moved };
      } else {
        const c = clampRectToFloor({ x: n.x + dx, y: n.y + dy, width: n.width, height: n.height }, p.floor);
        p.nonUsable[idx] = { ...n, x: c.x, y: c.y };
      }
    });
  },
  deleteNonUsable: (id) => {
    get().updateActive((p) => {
      p.nonUsable = p.nonUsable.filter((n) => n.id !== id);
    });
  },

  addWall: (w) => {
    get().updateActive((p) => {
      const { width: fw, height: fh } = floorBBox(p.floor);
      const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
      p.walls.push({
        ...w,
        id: uuid(),
        x1: clamp(w.x1, fw),
        y1: clamp(w.y1, fh),
        x2: clamp(w.x2, fw),
        y2: clamp(w.y2, fh),
      });
    });
  },
  updateWall: (id, patch) => {
    get().updateActive((p) => {
      const idx = p.walls.findIndex((w) => w.id === id);
      if (idx >= 0) p.walls[idx] = { ...p.walls[idx], ...patch };
    });
  },
  deleteWall: (id) => {
    get().updateActive((p) => {
      p.walls = p.walls.filter((w) => w.id !== id);
    });
  },

  toggleGrid: () => {
    get().updateActive((p) => {
      p.showGrid = !p.showGrid;
    }, { skipHistory: true });
  },
  toggleSnap: () => {
    get().updateActive((p) => {
      p.snapEnabled = !p.snapEnabled;
    }, { skipHistory: true });
  },
  toggleLabels: () => {
    get().updateActive((p) => {
      p.showLabels = !p.showLabels;
    }, { skipHistory: true });
  },
  setGridSize: (size) => {
    get().updateActive((p) => {
      p.gridSize = size;
    }, { skipHistory: true });
  },

  saveKit: (name, ids) => {
    const plan = get().getActivePlan();
    if (!plan) return;
    const items = plan.placedItems.filter((i) => ids.includes(i.id));
    if (items.length === 0) return;
    const minX = Math.min(...items.map((i) => i.x));
    const minY = Math.min(...items.map((i) => i.y));
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const i of items) {
      const c = CATALOG_BY_ID.get(i.catalogId);
      if (!c) continue;
      maxX = Math.max(maxX, i.x + c.width);
      maxY = Math.max(maxY, i.y + c.depth);
    }
    const idxMap = new Map(items.map((i, idx) => [i.id, idx]));
    const kit: Kit = {
      id: uuid(),
      name,
      items: items.map((i) => ({
        catalogId: i.catalogId,
        dx: i.x - minX,
        dy: i.y - minY,
        rotation: i.rotation,
        color: i.color,
        parentIndex: i.parentId ? idxMap.get(i.parentId) : undefined,
      })),
      bbox: { width: maxX - minX, height: maxY - minY },
    };
    set((s) => {
      const kits = [...s.kits, kit];
      saveKits(kits);
      return { kits };
    });
  },

  deleteKit: (id) => {
    set((s) => {
      const kits = s.kits.filter((v) => v.id !== id);
      saveKits(kits);
      return { kits };
    });
  },

  stampKit: (kitId, dropX, dropY) => {
    const kit = get().kits.find((v) => v.id === kitId);
    if (!kit) return;
    const newIds: string[] = kit.items.map(() => uuid());
    get().updateActive((p) => {
      kit.items.forEach((item, i) => {
        const placed: PlacedItem = {
          id: newIds[i],
          catalogId: item.catalogId,
          x: dropX + item.dx,
          y: dropY + item.dy,
          rotation: item.rotation,
          color: item.color,
          parentId:
            item.parentIndex !== undefined ? newIds[item.parentIndex] : undefined,
        };
        p.placedItems.push(placed);
      });
    });
    set({ selectionIds: newIds });
  },

  setTool: (tool) => set({ tool, selectionIds: [], zoneEditMode: "view", nonUsableEditMode: "view" }),
  setSelection: (ids) =>
    set((s) => {
      const same =
        s.selectionIds.length === ids.length &&
        ids.every((id, i) => id === s.selectionIds[i]);
      // Preserve edit modes if clicking the same item again
      return same ? { selectionIds: ids } : { selectionIds: ids, zoneEditMode: "view", nonUsableEditMode: "view" };
    }),
  addToSelection: (id) =>
    set((s) =>
      s.selectionIds.includes(id)
        ? { selectionIds: s.selectionIds.filter((x) => x !== id), zoneEditMode: "view", nonUsableEditMode: "view" }
        : { selectionIds: [...s.selectionIds, id], zoneEditMode: "view", nonUsableEditMode: "view" },
    ),
  clearSelection: () => set({ selectionIds: [], zoneEditMode: "view", nonUsableEditMode: "view" }),
  setZoneEditMode: (mode) => set({ zoneEditMode: mode, ...(mode !== "view" ? { tool: "select" } : {}) }),
  setNonUsableEditMode: (mode) => set({ nonUsableEditMode: mode, ...(mode !== "view" ? { tool: "select" } : {}) }),
  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(5, z)) }),
  setPan: (p) => set({ pan: p }),

  undo: () => {
    set((s) => {
      const id = s.activePlanId;
      if (!id) return {};
      const h = s.history[id];
      if (!h || h.past.length === 0) return {};
      const current = s.plans.find((p) => p.id === id);
      if (!current) return {};
      const prev = h.past[h.past.length - 1];
      const past = h.past.slice(0, -1);
      const future = [clone(current), ...h.future].slice(0, MAX_HISTORY);
      const plans = s.plans.map((p) => (p.id === id ? prev : p));
      persistAllPlans(plans);
      return {
        plans,
        history: { ...s.history, [id]: { past, future } },
        selectionIds: [],
      };
    });
  },

  redo: () => {
    set((s) => {
      const id = s.activePlanId;
      if (!id) return {};
      const h = s.history[id];
      if (!h || h.future.length === 0) return {};
      const current = s.plans.find((p) => p.id === id);
      if (!current) return {};
      const next = h.future[0];
      const future = h.future.slice(1);
      const past = [...h.past, clone(current)].slice(-MAX_HISTORY);
      const plans = s.plans.map((p) => (p.id === id ? next : p));
      persistAllPlans(plans);
      return {
        plans,
        history: { ...s.history, [id]: { past, future } },
        selectionIds: [],
      };
    });
  },

  canUndo: () => {
    const id = get().activePlanId;
    if (!id) return false;
    return (get().history[id]?.past.length ?? 0) > 0;
  },
  canRedo: () => {
    const id = get().activePlanId;
    if (!id) return false;
    return (get().history[id]?.future.length ?? 0) > 0;
  },
}));
