import type { FloorPlan, PlacedItem, Zone } from "../types/model";
import { getCatalogItem } from "../data/catalog";
import { pointInRect, pointInPolygon } from "./geometry";

export type ChangeKind = "added" | "removed" | "unchanged" | "moved" | "recolored";

export interface ItemChange {
  kind: ChangeKind;
  catalogId: string;
  name: string;
  preItem?: PlacedItem;
  postItem?: PlacedItem;
  distanceMoved?: number;
  preZoneName?: string;
  postZoneName?: string;
}

export interface ZoneChange {
  kind: "added" | "removed" | "resized" | "modified";
  preZone?: Zone;
  postZone?: Zone;
  name: string;
}

export interface PlanDiff {
  prePlan: FloorPlan;
  postPlan: FloorPlan;
  itemChanges: ItemChange[];
  zoneChanges: ZoneChange[];
  summary: {
    added: number;
    removed: number;
    moved: number;
    recolored: number;
    unchanged: number;
    zoneChanges: number;
  };
}

function getZoneName(x: number, y: number, zones: Zone[]): string {
  for (const z of zones) {
    if (z.kind === "rect") {
      if (pointInRect(x, y, z.x, z.y, z.width, z.height)) return z.name;
    } else {
      if (pointInPolygon({ x, y }, z.points)) return z.name;
    }
  }
  return "Unassigned";
}

function itemCenter(item: PlacedItem): { cx: number; cy: number } {
  const cat = getCatalogItem(item.catalogId);
  return {
    cx: item.x + (cat ? cat.width / 2 : 0),
    cy: item.y + (cat ? cat.depth / 2 : 0),
  };
}

type MatchPair =
  | { pre: PlacedItem; post: PlacedItem }
  | { pre: PlacedItem; post: null }
  | { pre: null; post: PlacedItem };

function matchItems(preItems: PlacedItem[], postItems: PlacedItem[]): MatchPair[] {
  const preGroups = new Map<string, PlacedItem[]>();
  const postGroups = new Map<string, PlacedItem[]>();

  for (const item of preItems) {
    const g = preGroups.get(item.catalogId) ?? [];
    g.push(item);
    preGroups.set(item.catalogId, g);
  }
  for (const item of postItems) {
    const g = postGroups.get(item.catalogId) ?? [];
    g.push(item);
    postGroups.set(item.catalogId, g);
  }

  const allIds = new Set([...preGroups.keys(), ...postGroups.keys()]);
  const result: MatchPair[] = [];

  for (const catalogId of allIds) {
    const pres = preGroups.get(catalogId) ?? [];
    const posts = postGroups.get(catalogId) ?? [];
    const usedPostIds = new Set<string>();

    for (const pre of pres) {
      const { cx: px, cy: py } = itemCenter(pre);
      let bestPost: PlacedItem | null = null;
      let bestDist = Infinity;

      for (const post of posts) {
        if (usedPostIds.has(post.id)) continue;
        const { cx: qx, cy: qy } = itemCenter(post);
        const d = Math.hypot(px - qx, py - qy);
        if (d < bestDist) {
          bestDist = d;
          bestPost = post;
        }
      }

      if (bestPost) {
        usedPostIds.add(bestPost.id);
        result.push({ pre, post: bestPost });
      } else {
        result.push({ pre, post: null });
      }
    }

    for (const post of posts) {
      if (!usedPostIds.has(post.id)) result.push({ pre: null, post });
    }
  }

  return result;
}

export function computeDiff(prePlan: FloorPlan, postPlan: FloorPlan): PlanDiff {
  const itemChanges: ItemChange[] = [];

  for (const pair of matchItems(prePlan.placedItems, postPlan.placedItems)) {
    const catalogId = pair.pre?.catalogId ?? pair.post!.catalogId;
    const cat = getCatalogItem(catalogId);
    const name = cat?.name ?? catalogId;

    if (pair.pre === null && pair.post !== null) {
      const { cx, cy } = itemCenter(pair.post);
      itemChanges.push({
        kind: "added",
        catalogId,
        name,
        postItem: pair.post,
        postZoneName: getZoneName(cx, cy, postPlan.zones),
      });
    } else if (pair.pre !== null && pair.post === null) {
      const { cx, cy } = itemCenter(pair.pre);
      itemChanges.push({
        kind: "removed",
        catalogId,
        name,
        preItem: pair.pre,
        preZoneName: getZoneName(cx, cy, prePlan.zones),
      });
    } else if (pair.pre !== null && pair.post !== null) {
      const { cx: px, cy: py } = itemCenter(pair.pre);
      const { cx: qx, cy: qy } = itemCenter(pair.post);
      const dist = Math.hypot(px - qx, py - qy);
      const rotDelta = Math.abs(((pair.post.rotation - pair.pre.rotation) % 360 + 360) % 360);
      const rotNorm = rotDelta > 180 ? 360 - rotDelta : rotDelta;
      const moved = dist >= 6 || rotNorm >= 5;
      const recolored = !moved && pair.pre.color !== pair.post.color;

      itemChanges.push({
        kind: moved ? "moved" : recolored ? "recolored" : "unchanged",
        catalogId,
        name,
        preItem: pair.pre,
        postItem: pair.post,
        distanceMoved: moved ? dist : undefined,
        preZoneName: getZoneName(px, py, prePlan.zones),
        postZoneName: getZoneName(qx, qy, postPlan.zones),
      });
    }
  }

  // Zone comparison — match by name
  const zoneChanges: ZoneChange[] = [];
  const preZoneMap = new Map(prePlan.zones.map((z) => [z.name.toLowerCase(), z]));
  const postZoneMap = new Map(postPlan.zones.map((z) => [z.name.toLowerCase(), z]));

  for (const [key, preZone] of preZoneMap) {
    const postZone = postZoneMap.get(key);
    if (!postZone) {
      zoneChanges.push({ kind: "removed", preZone, name: preZone.name });
    } else {
      let changed = false;
      if (preZone.kind === "rect" && postZone.kind === "rect") {
        changed =
          Math.abs(preZone.x - postZone.x) > 6 ||
          Math.abs(preZone.y - postZone.y) > 6 ||
          Math.abs(preZone.width - postZone.width) > 6 ||
          Math.abs(preZone.height - postZone.height) > 6;
      } else if (preZone.kind !== postZone.kind) {
        changed = true;
      } else if (preZone.kind === "polygon" && postZone.kind === "polygon") {
        changed = preZone.points.length !== postZone.points.length;
      }
      const colorChanged = preZone.color !== postZone.color;
      if (changed || colorChanged) {
        zoneChanges.push({
          kind: changed ? "resized" : "modified",
          preZone,
          postZone,
          name: preZone.name,
        });
      }
    }
  }

  for (const [key, postZone] of postZoneMap) {
    if (!preZoneMap.has(key)) {
      zoneChanges.push({ kind: "added", postZone, name: postZone.name });
    }
  }

  return {
    prePlan,
    postPlan,
    itemChanges,
    zoneChanges,
    summary: {
      added: itemChanges.filter((c) => c.kind === "added").length,
      removed: itemChanges.filter((c) => c.kind === "removed").length,
      moved: itemChanges.filter((c) => c.kind === "moved").length,
      recolored: itemChanges.filter((c) => c.kind === "recolored").length,
      unchanged: itemChanges.filter((c) => c.kind === "unchanged").length,
      zoneChanges: zoneChanges.length,
    },
  };
}
