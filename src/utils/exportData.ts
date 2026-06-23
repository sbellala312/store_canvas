import type { FloorPlan, Zone, NonUsableRegion, PlacedItem } from "../types/model";
import { getCatalogItem } from "../data/catalog";
import { pointInRect, pointInPolygon, polygonArea, polygonBBox, floorBBox } from "./geometry";
import { sqftFromInches } from "./units";

export interface ItemSummary {
  id: string;
  name: string;
  sku: string;
  vendor: string;
  pricePoint: string;
  tags: string[];
  xIn: number;
  yIn: number;
  widthIn: number;
  depthIn: number;
  rotationDeg: number;
  footprintSqFt: number;
}

export interface ZoneReport {
  id: string;
  name: string;
  kind: "rect" | "polygon";
  color: string;
  areaSqFt: number;
  boundsIn: { x: number; y: number; width: number; height: number };
  items: ItemSummary[];
}

export interface NonUsableReport {
  id: string;
  label: string;
  kind: "rect" | "polygon";
  areaSqFt: number;
  boundsIn: { x: number; y: number; width: number; height: number };
}

export interface PlanReport {
  planName: string;
  exportedAt: string;
  floor: {
    kind: string;
    widthIn: number;
    heightIn: number;
    totalSqFt: number;
  };
  zones: ZoneReport[];
  nonUsable: NonUsableReport[];
  unassignedItems: ItemSummary[];
  summary: {
    totalZones: number;
    totalZoneAreaSqFt: number;
    totalNonUsableAreas: number;
    totalNonUsableAreaSqFt: number;
    totalItems: number;
    assignedItems: number;
    unassignedItems: number;
    totalItemFootprintSqFt: number;
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildItemSummary(item: PlacedItem): ItemSummary | null {
  const cat = getCatalogItem(item.catalogId);
  if (!cat || cat.isAccessory) return null;
  return {
    id: item.id,
    name: cat.name,
    sku: item.sku ?? "",
    vendor: item.vendor ?? "",
    pricePoint: item.pricePoint ?? "",
    tags: item.tags ?? [],
    xIn: round1(item.x),
    yIn: round1(item.y),
    widthIn: cat.width,
    depthIn: cat.depth,
    rotationDeg: Math.round(item.rotation),
    footprintSqFt: round1(sqftFromInches(cat.width, cat.depth)),
  };
}

function itemCenter(item: PlacedItem): { cx: number; cy: number } | null {
  const cat = getCatalogItem(item.catalogId);
  if (!cat) return null;
  return { cx: item.x + cat.width / 2, cy: item.y + cat.depth / 2 };
}

function zoneBounds(zone: Zone): { x: number; y: number; width: number; height: number } {
  return zone.kind === "rect"
    ? { x: zone.x, y: zone.y, width: zone.width, height: zone.height }
    : polygonBBox(zone.points);
}

function zoneSqFt(zone: Zone): number {
  return zone.kind === "rect"
    ? round1(sqftFromInches(zone.width, zone.height))
    : round1(polygonArea(zone.points) / 144);
}

function nonUsableBounds(nu: NonUsableRegion): { x: number; y: number; width: number; height: number } {
  return nu.kind === "rect"
    ? { x: nu.x, y: nu.y, width: nu.width, height: nu.height }
    : polygonBBox(nu.points);
}

function nonUsableSqFt(nu: NonUsableRegion): number {
  return nu.kind === "rect"
    ? round1(sqftFromInches(nu.width, nu.height))
    : round1(polygonArea(nu.points) / 144);
}

function itemInZone(item: PlacedItem, zone: Zone): boolean {
  const center = itemCenter(item);
  if (!center) return false;
  if (zone.kind === "rect") {
    return pointInRect(center.cx, center.cy, zone.x, zone.y, zone.width, zone.height);
  }
  return pointInPolygon({ x: center.cx, y: center.cy }, zone.points);
}

export function computePlanReport(plan: FloorPlan): PlanReport {
  const { width: floorW, height: floorH } = floorBBox(plan.floor);
  const totalSqFt = round1(floorW * floorH / 144);

  // Map each placed item's id to the zone it belongs to
  const itemZoneMap = new Map<string, string>();
  for (const item of plan.placedItems) {
    const cat = getCatalogItem(item.catalogId);
    if (!cat || cat.isAccessory) continue;
    for (const zone of plan.zones) {
      if (itemInZone(item, zone)) {
        itemZoneMap.set(item.id, zone.id);
        break;
      }
    }
  }

  // Build zone reports
  const zones: ZoneReport[] = plan.zones.map((zone) => {
    const items = plan.placedItems
      .filter((item) => itemZoneMap.get(item.id) === zone.id)
      .map(buildItemSummary)
      .filter((s): s is ItemSummary => s !== null);
    return {
      id: zone.id,
      name: zone.name,
      kind: zone.kind,
      color: zone.color,
      areaSqFt: zoneSqFt(zone),
      boundsIn: zoneBounds(zone),
      items,
    };
  });

  // Build non-usable reports
  const nonUsable: NonUsableReport[] = plan.nonUsable.map((nu) => ({
    id: nu.id,
    label: nu.label ?? "Non-usable",
    kind: nu.kind,
    areaSqFt: nonUsableSqFt(nu),
    boundsIn: nonUsableBounds(nu),
  }));

  // Unassigned items (not in any zone, not accessories)
  const unassignedItems: ItemSummary[] = plan.placedItems
    .filter((item) => {
      const cat = getCatalogItem(item.catalogId);
      return cat && !cat.isAccessory && !itemZoneMap.has(item.id);
    })
    .map(buildItemSummary)
    .filter((s): s is ItemSummary => s !== null);

  const assignedCount = itemZoneMap.size;
  const totalItemCount = assignedCount + unassignedItems.length;
  const totalFootprint = round1(
    [...zones.flatMap((z) => z.items), ...unassignedItems].reduce((s, i) => s + i.footprintSqFt, 0)
  );

  return {
    planName: plan.name,
    exportedAt: new Date().toISOString(),
    floor: {
      kind: plan.floor.kind,
      widthIn: floorW,
      heightIn: floorH,
      totalSqFt,
    },
    zones,
    nonUsable,
    unassignedItems,
    summary: {
      totalZones: zones.length,
      totalZoneAreaSqFt: round1(zones.reduce((s, z) => s + z.areaSqFt, 0)),
      totalNonUsableAreas: nonUsable.length,
      totalNonUsableAreaSqFt: round1(nonUsable.reduce((s, n) => s + n.areaSqFt, 0)),
      totalItems: totalItemCount,
      assignedItems: assignedCount,
      unassignedItems: unassignedItems.length,
      totalItemFootprintSqFt: totalFootprint,
    },
  };
}

function csvEsc(value: string | number | undefined | null): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function generateCSV(report: PlanReport): string {
  const rows: string[] = [];

  rows.push(`STORE PLAN: ${csvEsc(report.planName)}`);
  rows.push(`Exported: ${report.exportedAt}`);
  rows.push(`Floor: ${report.floor.widthIn}" x ${report.floor.heightIn}" | ${report.floor.totalSqFt} sq ft`);
  rows.push("");

  // Zones & Items
  rows.push("ZONES & ITEMS");
  rows.push(
    [
      "Zone", "Zone Type", "Zone Area (sq ft)",
      "Zone X (in)", "Zone Y (in)", "Zone Width (in)", "Zone Height (in)",
      "Item Name", "SKU", "Vendor", "Price Point", "Tags",
      "Item X (in)", "Item Y (in)", "Width (in)", "Depth (in)", "Rotation (deg)", "Footprint (sq ft)",
    ]
      .map(csvEsc)
      .join(",")
  );

  for (const zone of report.zones) {
    const bb = zone.boundsIn;
    const zonePrefix = [
      csvEsc(zone.name),
      csvEsc(zone.kind === "rect" ? "Rectangle" : "Free-form"),
      csvEsc(zone.areaSqFt),
      csvEsc(Math.round(bb.x)),
      csvEsc(Math.round(bb.y)),
      csvEsc(Math.round(bb.width)),
      csvEsc(Math.round(bb.height)),
    ];
    if (zone.items.length === 0) {
      rows.push([...zonePrefix, "(no items)", "", "", "", "", "", "", "", "", "", ""].join(","));
    } else {
      for (const item of zone.items) {
        rows.push(
          [
            ...zonePrefix,
            csvEsc(item.name),
            csvEsc(item.sku),
            csvEsc(item.vendor),
            csvEsc(item.pricePoint),
            csvEsc(item.tags.join("; ")),
            csvEsc(item.xIn),
            csvEsc(item.yIn),
            csvEsc(item.widthIn),
            csvEsc(item.depthIn),
            csvEsc(item.rotationDeg),
            csvEsc(item.footprintSqFt),
          ].join(",")
        );
      }
    }
  }
  rows.push("");

  // Non-usable areas
  rows.push("NON-USABLE AREAS");
  rows.push(
    ["Label", "Type", "Area (sq ft)", "X (in)", "Y (in)", "Width (in)", "Height (in)"]
      .map(csvEsc)
      .join(",")
  );
  for (const nu of report.nonUsable) {
    const bb = nu.boundsIn;
    rows.push(
      [
        csvEsc(nu.label),
        csvEsc(nu.kind === "rect" ? "Rectangle" : "Free-form"),
        csvEsc(nu.areaSqFt),
        csvEsc(Math.round(bb.x)),
        csvEsc(Math.round(bb.y)),
        csvEsc(Math.round(bb.width)),
        csvEsc(Math.round(bb.height)),
      ].join(",")
    );
  }
  rows.push("");

  // Unassigned items
  if (report.unassignedItems.length > 0) {
    rows.push("UNASSIGNED ITEMS");
    rows.push(
      ["Item Name", "SKU", "Vendor", "Price Point", "Tags", "X (in)", "Y (in)", "Width (in)", "Depth (in)", "Rotation (deg)", "Footprint (sq ft)"]
        .map(csvEsc)
        .join(",")
    );
    for (const item of report.unassignedItems) {
      rows.push(
        [
          csvEsc(item.name),
          csvEsc(item.sku),
          csvEsc(item.vendor),
          csvEsc(item.pricePoint),
          csvEsc(item.tags.join("; ")),
          csvEsc(item.xIn),
          csvEsc(item.yIn),
          csvEsc(item.widthIn),
          csvEsc(item.depthIn),
          csvEsc(item.rotationDeg),
          csvEsc(item.footprintSqFt),
        ].join(",")
      );
    }
    rows.push("");
  }

  // Summary
  rows.push("SUMMARY");
  rows.push("Metric,Value");
  rows.push(`Total Zones,${report.summary.totalZones}`);
  rows.push(`Total Zone Area (sq ft),${report.summary.totalZoneAreaSqFt}`);
  rows.push(`Total Non-Usable Areas,${report.summary.totalNonUsableAreas}`);
  rows.push(`Total Non-Usable Area (sq ft),${report.summary.totalNonUsableAreaSqFt}`);
  rows.push(`Total Items,${report.summary.totalItems}`);
  rows.push(`Assigned Items,${report.summary.assignedItems}`);
  rows.push(`Unassigned Items,${report.summary.unassignedItems}`);
  rows.push(`Total Item Footprint (sq ft),${report.summary.totalItemFootprintSqFt}`);

  // UTF-8 BOM for Excel compatibility
  return "﻿" + rows.join("\r\n");
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, "_").replace(/__+/g, "_");
}

export function downloadJSON(plan: FloorPlan) {
  const report = computePlanReport(plan);
  const content = JSON.stringify(report, null, 2);
  triggerDownload(content, `${safeFilename(plan.name)}_data.json`, "application/json");
}

export function downloadCSV(plan: FloorPlan) {
  const report = computePlanReport(plan);
  const content = generateCSV(report);
  triggerDownload(content, `${safeFilename(plan.name)}_data.csv`, "text/csv;charset=utf-8;");
}
