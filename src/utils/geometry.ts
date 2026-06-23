import type { Inches, PlacedItem, CatalogItem, Point, FloorShape } from "../types/model";

export function snap(value: Inches, grid: Inches, enabled: boolean): Inches {
  if (!enabled || grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function snapPoint(p: Point, grid: Inches, enabled: boolean): Point {
  return { x: snap(p.x, grid, enabled), y: snap(p.y, grid, enabled) };
}

export function pointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function findParentFurniture(
  dropX: Inches,
  dropY: Inches,
  items: PlacedItem[],
  getCatalogItem: (id: string) => CatalogItem | undefined,
): PlacedItem | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const cat = getCatalogItem(item.catalogId);
    if (!cat || cat.isAccessory) continue;
    if (pointInRect(dropX, dropY, item.x, item.y, cat.width, cat.depth)) {
      return item;
    }
  }
  return undefined;
}

export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function floorBBox(floor: FloorShape): { width: number; height: number } {
  return floor.kind === "rect" ? { width: floor.width, height: floor.height } : floor.bbox;
}

export function clampRectToFloor(
  rect: { x: number; y: number; width: number; height: number },
  floor: FloorShape,
): { x: number; y: number; width: number; height: number } {
  const { width: fw, height: fh } = floorBBox(floor);
  let { x, y, width, height } = rect;
  width = Math.min(Math.max(1, width), fw);
  height = Math.min(Math.max(1, height), fh);
  x = Math.max(0, Math.min(x, fw - width));
  y = Math.max(0, Math.min(y, fh - height));
  return { x, y, width, height };
}

export function clampPointToFloor(p: Point, floor: FloorShape): Point {
  const { width: fw, height: fh } = floorBBox(floor);
  return {
    x: Math.max(0, Math.min(p.x, fw)),
    y: Math.max(0, Math.min(p.y, fh)),
  };
}

export function polygonCentroid(points: Point[]): Point {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { ...points[0] };
  if (n === 2) return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  let cx = 0, cy = 0, area = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-9) {
    return {
      x: points.reduce((s, p) => s + p.x, 0) / n,
      y: points.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  const f = 1 / (6 * area);
  return { x: cx * f, y: cy * f };
}

export function polygonArea(points: Point[]): number {
  let sum = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonBBox(points: Point[]): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export interface WorldBBox {
  x: number; y: number; width: number; height: number;
}

export interface SnapGuide {
  axis: "x" | "y";
  at: number;   // world coord of the guide line
  from: number; // world coord of guide start
  to: number;   // world coord of guide end
}

// Find the best edge-to-edge snap correction for `dragging` against `others`.
// Returns pixel deltas (dx, dy) to apply to the dragging node, plus guide lines to render.
// Threshold is in world units (inches).
export function computeEdgeSnap(
  dragging: WorldBBox,
  others: WorldBBox[],
  threshold: number,
): { dx: number; dy: number; guides: SnapGuide[] } {
  let bestDx = 0, bestAbsDx = Infinity;
  let bestDy = 0, bestAbsDy = Infinity;

  const dl = dragging.x, dr = dragging.x + dragging.width;
  const dt = dragging.y, db = dragging.y + dragging.height;

  for (const o of others) {
    const ol = o.x, or_ = o.x + o.width;
    const ot = o.y, ob = o.y + o.height;
    for (const [de, oe] of [[dl, ol], [dl, or_], [dr, ol], [dr, or_]] as [number, number][]) {
      const d = oe - de;
      if (Math.abs(d) <= threshold && Math.abs(d) < bestAbsDx) { bestDx = d; bestAbsDx = Math.abs(d); }
    }
    for (const [de, oe] of [[dt, ot], [dt, ob], [db, ot], [db, ob]] as [number, number][]) {
      const d = oe - de;
      if (Math.abs(d) <= threshold && Math.abs(d) < bestAbsDy) { bestDy = d; bestAbsDy = Math.abs(d); }
    }
  }

  const dx = bestAbsDx <= threshold ? bestDx : 0;
  const dy = bestAbsDy <= threshold ? bestDy : 0;
  const sdl = dl + dx, sdr = dr + dx;
  const sdt = dt + dy, sdb = db + dy;
  const margin = 12; // extra world units to extend guide lines past element edges

  const guides: SnapGuide[] = [];
  const seenX = new Set<number>(), seenY = new Set<number>();
  for (const o of others) {
    const ol = o.x, or_ = o.x + o.width;
    const ot = o.y, ob = o.y + o.height;
    for (const se of [sdl, sdr]) {
      for (const oe of [ol, or_]) {
        if (Math.abs(se - oe) < 0.5 && !seenX.has(Math.round(se))) {
          seenX.add(Math.round(se));
          guides.push({ axis: "x", at: se, from: Math.min(sdt, ot) - margin, to: Math.max(sdb, ob) + margin });
        }
      }
    }
    for (const se of [sdt, sdb]) {
      for (const oe of [ot, ob]) {
        if (Math.abs(se - oe) < 0.5 && !seenY.has(Math.round(se))) {
          seenY.add(Math.round(se));
          guides.push({ axis: "y", at: se, from: Math.min(sdl, ol) - margin, to: Math.max(sdr, or_) + margin });
        }
      }
    }
  }
  return { dx, dy, guides };
}

export function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}
