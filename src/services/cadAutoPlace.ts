import type { CatalogItem, FloorPlan, Zone } from "../types/model";
import type { RefImage } from "../state/refImageStore";
import { extractCadItems, type CadDetection, type CadUsage } from "./cadVision";
import { findCatalogItemBySku } from "./azureSearch";
import { usePlanStore } from "../state/planStore";
import { slimCatalogItem } from "../data/catalog";
import { cropRefImageToZone, type WorldBounds } from "../utils/imageCrop";
import { nanoid } from "nanoid";

export type CadScope = "store" | Zone;

export interface CadReviewRow {
  detection: CadDetection;
  sku: string;
  catalogItem: CatalogItem | null;
  worldX: number;
  worldY: number;
  rotation: number;
  status: "matched" | "unmatched" | "duplicate";
  scopeName?: string;
}

export interface CadAnalysisResult {
  rows: CadReviewRow[];
  /** The exact image sent to Gemini (full store or the zone crop) — for the detection map. */
  analyzedImage: string;
  /** Unique detections after dedup — one entry per physical piece, boxes in 0-1000 space. */
  detections: CadDetection[];
  /** Token usage + estimated cost for the vision call (null if unavailable). */
  usage: CadUsage | null;
}

/** Check whether a same-SKU item is already placed near the given center position. */
function isDuplicate(
  plan: FloorPlan,
  catalogId: string,
  cx: number,
  cy: number,
  cat: CatalogItem
): boolean {
  const threshold = Math.min(cat.width, cat.depth) * 0.75;
  return plan.placedItems.some((p) => {
    if (p.catalogId !== catalogId) return false;
    const existingCat = p.spec ?? cat;
    const existingCx = p.x + existingCat.width / 2;
    const existingCy = p.y + existingCat.depth / 2;
    const dx = existingCx - cx;
    const dy = existingCy - cy;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  });
}

/** Intersection-over-Union of two Gemini boxes (0-1000 space). */
function boxIoU(
  a: CadDetection["box"],
  b: CadDetection["box"]
): number {
  const ix1 = Math.max(a.x1, b.x1);
  const iy1 = Math.max(a.y1, b.y1);
  const ix2 = Math.min(a.x2, b.x2);
  const iy2 = Math.min(a.y2, b.y2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  if (inter === 0) return 0;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

/** Stable signature of a detection's SKU set (order-independent). */
function skuKey(d: CadDetection): string {
  return [...d.skus].sort().join("|");
}

/**
 * Collapse detections that are the same physical item detected more than once.
 * Two detections are duplicates when they share the same SKU set AND their
 * bounding boxes overlap (IoU above the threshold). Genuinely separate items of
 * the same SKU have non-overlapping footprints and are always kept.
 */
function dedupeDetections(dets: CadDetection[], iouThreshold = 0.4): CadDetection[] {
  const kept: CadDetection[] = [];
  for (const d of dets) {
    const key = skuKey(d);
    const isDup = kept.some(
      (k) => skuKey(k) === key && boxIoU(k.box, d.box) >= iouThreshold
    );
    if (!isDup) kept.push(d);
  }
  return kept;
}

/**
 * Map a detection's bounding box (Gemini 0-1000 space, relative to imageBounds)
 * to world-inch top-left for a catalog item.
 */
function boxToWorldCoords(
  detection: CadDetection,
  imageBounds: WorldBounds,
  cat: CatalogItem
): { worldX: number; worldY: number } {
  const { box } = detection;
  const nx = (box.x1 + box.x2) / 2 / 1000;
  const ny = (box.y1 + box.y2) / 2 / 1000;
  const cx = imageBounds.x + nx * imageBounds.width;
  const cy = imageBounds.y + ny * imageBounds.height;
  return {
    worldX: cx - cat.width / 2,
    worldY: cy - cat.depth / 2,
  };
}

/**
 * Analyze the reference image (full store or a specific zone) and return review rows.
 * For zone scope: crops the image to the zone bounding box + 15% padding for context.
 */
export async function analyzeCad(
  refImage: RefImage,
  plan: FloorPlan,
  scope: CadScope
): Promise<CadAnalysisResult> {
  let dataUrl: string;
  let imageBounds: WorldBounds;
  let scopeName: string | undefined;

  if (scope === "store") {
    dataUrl = refImage.dataUrl;
    const worldW = refImage.realWidthFt * 12;
    const imgW = refImage.imageWidth ?? 1;
    const imgH = refImage.imageHeight ?? 1;
    imageBounds = { x: 0, y: 0, width: worldW, height: worldW * (imgH / imgW) };
    scopeName = undefined;
  } else {
    const cropped = await cropRefImageToZone(refImage, scope);
    dataUrl = cropped.croppedDataUrl;
    imageBounds = cropped.imageBounds;
    scopeName = scope.name;
  }

  const { detections: rawDetections, usage } = await extractCadItems(dataUrl);
  const detections = dedupeDetections(rawDetections);

  const pairs = detections.flatMap((d) => d.skus.map((sku) => ({ detection: d, sku })));

  const rows = await Promise.all(
    pairs.map(async ({ detection, sku }): Promise<CadReviewRow> => {
      let catalogItem: CatalogItem | null = null;
      try {
        catalogItem = await findCatalogItemBySku(sku);
      } catch {
        // network/search error — treat as unmatched
      }

      if (!catalogItem) {
        return {
          detection,
          sku,
          catalogItem: null,
          worldX: 0,
          worldY: 0,
          rotation: detection.rotationDeg,
          status: "unmatched",
          scopeName,
        };
      }

      const { worldX, worldY } = boxToWorldCoords(detection, imageBounds, catalogItem);
      const cx = worldX + catalogItem.width / 2;
      const cy = worldY + catalogItem.depth / 2;
      const dup = isDuplicate(plan, catalogItem.id, cx, cy, catalogItem);

      return {
        detection,
        sku,
        catalogItem,
        worldX,
        worldY,
        rotation: detection.rotationDeg,
        status: dup ? "duplicate" : "matched",
        scopeName,
      };
    })
  );

  return { rows, analyzedImage: dataUrl, detections, usage };
}

/** Batch-place checked rows as a single undo step. */
export function placeMatched(rows: CadReviewRow[]): void {
  const toPlace = rows.filter(
    (r) => (r.status === "matched" || r.status === "duplicate") && r.catalogItem
  );
  if (toPlace.length === 0) return;

  usePlanStore.getState().updateActive((plan) => {
    for (const row of toPlace) {
      const cat = row.catalogItem!;
      plan.placedItems.push({
        id: nanoid(),
        catalogId: cat.id,
        x: row.worldX,
        y: row.worldY,
        rotation: row.rotation,
        spec: slimCatalogItem(cat),
      });
    }
  });
}
