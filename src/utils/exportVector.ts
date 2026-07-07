import jsPDF from "jspdf";
import type { FloorPlan, Zone, NonUsableRegion, Point, PlacedItem, CatalogItem } from "../types/model";
import type { RefImage } from "../state/refImageStore";
import { getCatalogItem } from "../data/catalog";
import { floorBBox, polygonBBox, polygonCentroid, polygonArea } from "../utils/geometry";
import { feetInches, sqftFromInches, formatSqft } from "../utils/units";
import { fontPdf } from "../utils/labelFont";
import { planContentBounds } from "./export";

// Vector PDF export: draws the whole plan as PDF vector shapes + text (not a flattened
// image), so it stays razor-sharp at any zoom and the file is small — the right format
// for large floor plans. Independent of the on-screen Konva stage.

const TARGET_PT = 2000; // longest content side, in PDF points (vector — viewers zoom freely)
const HEADER_PT = 40;

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function setOpacity(pdf: jsPDF, opacity: number): void {
  // GState typing isn't in jspdf's public types; both members exist at runtime.
  const anyPdf = pdf as unknown as {
    setGState: (g: unknown) => void;
    GState: new (o: { opacity: number }) => unknown;
  };
  anyPdf.setGState(new anyPdf.GState({ opacity }));
}

export function exportVectorPDF(
  plan: FloorPlan,
  refImage: RefImage | null,
  outlineOnly = false,
  labelFontKey = "sans",
  labelUppercase = true,
): void {
  const labelFontName = fontPdf(labelFontKey);
  const applyCase = (t: string) => (labelUppercase ? t.toUpperCase() : t);
  const b = planContentBounds(plan);
  const S = TARGET_PT / Math.max(1, b.w, b.h); // points per inch
  const contentW = b.w * S;
  const contentH = b.h * S;
  const pageW = contentW;
  const pageH = contentH + HEADER_PT;

  const orientation = pageW >= pageH ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: [pageW, pageH] });

  // World inch -> PDF point transforms.
  const X = (wx: number) => (wx - b.x) * S;
  const Y = (wy: number) => (wy - b.y) * S + HEADER_PT;
  const L = (inches: number) => inches * S;

  const rect = (xIn: number, yIn: number, wIn: number, hIn: number, style: string) =>
    pdf.rect(X(xIn), Y(yIn), L(wIn), L(hIn), style);

  const polygon = (pts: Point[], style: string) => {
    if (pts.length < 2) return;
    const p0 = [X(pts[0].x), Y(pts[0].y)] as [number, number];
    const rel: [number, number][] = [];
    for (let i = 1; i < pts.length; i++) {
      rel.push([X(pts[i].x) - X(pts[i - 1].x), Y(pts[i].y) - Y(pts[i - 1].y)]);
    }
    pdf.lines(rel, p0[0], p0[1], [1, 1], style, true);
  };

  // Draw N centered text lines around a point, sized in points.
  const centeredText = (lines: string[], cxPt: number, cyPt: number, fontPt: number, bold: boolean) => {
    pdf.setFont(labelFontName, bold ? "bold" : "normal");
    pdf.setFontSize(fontPt);
    const lh = fontPt * 1.15;
    let ty = cyPt - (lines.length * lh) / 2 + fontPt * 0.85;
    for (const ln of lines) {
      pdf.text(ln, cxPt, ty, { align: "center" });
      ty += lh;
    }
  };

  // ── Header ────────────────────────────────────────────────────────────────
  const fw = plan.floor.kind === "rect" ? plan.floor.width : plan.floor.bbox.width;
  const fh = plan.floor.kind === "rect" ? plan.floor.height : plan.floor.bbox.height;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(26, 31, 38);
  pdf.text(plan.name, 24, 24);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(110, 119, 133);
  pdf.text(
    `Floor: ${feetInches(fw, { compact: true })} × ${feetInches(fh, { compact: true })}  ·  Exported ${new Date().toLocaleString()}`,
    24,
    36,
  );

  // ── Reference (CAD) image, if shown ─────────────────────────────────────────
  if (refImage?.visible && refImage.dataUrl && refImage.imageWidth && refImage.imageHeight) {
    const wIn = refImage.realWidthFt * 12;
    const hIn = wIn * (refImage.imageHeight / refImage.imageWidth);
    const fmt = refImage.dataUrl.slice(11, refImage.dataUrl.indexOf(";")).toUpperCase(); // e.g. PNG/JPEG
    try {
      setOpacity(pdf, refImage.opacity ?? 0.4);
      pdf.addImage(refImage.dataUrl, fmt || "PNG", X(0), Y(0), L(wIn), L(hIn));
      setOpacity(pdf, 1);
    } catch {
      setOpacity(pdf, 1); // unsupported image format — skip the backdrop
    }
  }

  // ── Floor ───────────────────────────────────────────────────────────────────
  pdf.setDrawColor(45, 55, 66);
  pdf.setFillColor(250, 251, 252);
  pdf.setLineWidth(1);
  if (plan.floor.kind === "rect") {
    rect(0, 0, plan.floor.width, plan.floor.height, "FD");
  } else {
    polygon(plan.floor.points, "FD");
  }

  // ── Zones ─────────────────────────────────────────────────────────────────
  for (const z of plan.zones ?? []) drawZone(z);

  // ── Non-usable regions ──────────────────────────────────────────────────────
  for (const r of plan.nonUsable ?? []) drawNonUsable(r);

  // ── Walls ────────────────────────────────────────────────────────────────────
  pdf.setDrawColor(45, 55, 66);
  for (const w of plan.walls ?? []) {
    pdf.setLineWidth(Math.max(1, L(w.thickness) * 0.5));
    pdf.line(X(w.x1), Y(w.y1), X(w.x2), Y(w.y2));
  }

  // ── Furniture ────────────────────────────────────────────────────────────────
  // Match the canvas: stack by tier (rugs below, then furniture, then accessories),
  // draw ALL shapes first, then ALL labels on top so a label is never covered.
  const drawn = (plan.placedItems ?? [])
    .map((it) => ({ it, cat: it.spec ?? getCatalogItem(it.catalogId) }))
    .filter((x): x is { it: PlacedItem; cat: CatalogItem } => x.cat != null)
    .sort((a, b) => itemTier(a.cat) - itemTier(b.cat));

  for (const { it, cat } of drawn) {
    const w = cat.width;
    const d = cat.depth;
    const rawColor = it.color ?? cat.defaultColor;
    const color = rawColor === "none" || outlineOnly ? null : rawColor;
    const cx = it.x + w / 2;
    const cy = it.y + d / 2;

    pdf.setDrawColor(58, 70, 84);
    pdf.setLineWidth(0.5);
    if (color) pdf.setFillColor(...hexToRgb(color));

    if (cat.isAccessory && cat.shape === "circle") {
      pdf.circle(X(cx), Y(cy), L(Math.min(w, d) / 2), color ? "FD" : "S");
    } else {
      // Rotated rectangle: compute corners (clockwise, screen y-down) then draw a polygon.
      const th = ((it.rotation ?? 0) * Math.PI) / 180;
      const cos = Math.cos(th);
      const sin = Math.sin(th);
      const corners: Point[] = [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ].map(([dx, dy]) => ({ x: cx + (dx * cos - dy * sin), y: cy + (dx * sin + dy * cos) }));
      polygon(corners, color ? "FD" : "S");
    }
  }

  if (plan.showLabels) {
    for (const { it, cat } of drawn) drawItemLabel(it, cat);
  }

  pdf.save(`${sanitize(plan.name)}.pdf`);

  // ── helpers that close over pdf/transforms ──────────────────────────────────
  function drawZone(z: Zone): void {
    const noFill = z.color === "none";
    const stroke: RGB = noFill ? [154, 165, 177] : hexToRgb(z.color);
    pdf.setDrawColor(...stroke);
    pdf.setLineWidth(1);
    pdf.setLineDashPattern([6, 4], 0);
    if (!noFill) {
      pdf.setFillColor(...hexToRgb(z.color));
      setOpacity(pdf, 0.14);
      if (z.kind === "rect") rect(z.x, z.y, z.width, z.height, "F");
      else polygon(z.points, "F");
      setOpacity(pdf, 1);
    }
    if (z.kind === "rect") rect(z.x, z.y, z.width, z.height, "S");
    else polygon(z.points, "S");
    pdf.setLineDashPattern([], 0);

    // Name (centered, bold) + sqft (bottom-right).
    const bb = z.kind === "rect" ? { x: z.x, y: z.y, width: z.width, height: z.height } : polygonBBox(z.points);
    const c = z.kind === "rect" ? { x: z.x + z.width / 2, y: z.y + z.height / 2 } : polygonCentroid(z.points);
    const minDim = Math.min(bb.width, bb.height);
    const nameFont = Math.max(6, Math.min(L(minDim) * 0.16, L(minDim) * 0.5));
    if (!noFill) pdf.setTextColor(...hexToRgb(z.color));
    else pdf.setTextColor(120, 130, 140);
    setOpacity(pdf, 0.75);
    centeredText([applyCase(z.name)], X(c.x), Y(c.y), nameFont, true);
    const sqft = z.kind === "rect" ? sqftFromInches(z.width, z.height) : polygonArea(z.points) / 144;
    pdf.setFont(labelFontName, "normal");
    pdf.setFontSize(Math.max(5, nameFont * 0.5));
    pdf.text(formatSqft(sqft), X(bb.x + bb.width) - 3, Y(bb.y + bb.height) - 3, { align: "right" });
    setOpacity(pdf, 1);
  }

  // Canvas z-tier: rugs at bottom (0), furniture (1), accessories on top (2).
  function itemTier(cat: CatalogItem): number {
    if (cat.subcategory === "Rugs") return 0;
    if (cat.isAccessory) return 2;
    return 1;
  }

  // Draws an item's label, positioned and rotated to match the canvas: anchored per
  // labelPosition within the item, rotated with the item (+ any labelRotation).
  function drawItemLabel(item: PlacedItem, cat: CatalogItem): void {
    const w = cat.width;
    const d = cat.depth;
    const cx = item.x + w / 2;
    const cy = item.y + d / 2;
    const rawLines = (cat.seriesName ? [cat.seriesName, cat.name] : [cat.name]).map(applyCase);

    // Font sized to the item (in inches) so it reads like the canvas and scales with zoom.
    const fontIn = Math.min(8, Math.max(2, Math.min(w, d) * 0.14));
    const fontPt = fontIn * S;
    pdf.setFont(labelFontName, "normal");
    pdf.setFontSize(fontPt);
    pdf.setTextColor(26, 31, 38);

    const pos = item.labelPosition ?? "center";
    const halfWidthPos =
      pos === "left" || pos === "right" ||
      pos === "top-left" || pos === "top-right" ||
      pos === "bottom-left" || pos === "bottom-right";
    const wrapWIn = (halfWidthPos ? w / 2 : w) - 2;
    const wrapped = rawLines.flatMap((l) => pdf.splitTextToSize(l, Math.max(2, L(wrapWIn))) as string[]);
    const n = wrapped.length;
    const lineHIn = fontIn * 1.15;
    const tbh = n * lineHIn; // text-block height, inches
    const padIn = 2;

    // Anchor (block centre) in the item's local, unrotated frame.
    let ax = w / 2;
    let ay = d / 2;
    switch (pos) {
      case "top": ay = padIn + tbh / 2; break;
      case "bottom": ay = d - padIn - tbh / 2; break;
      case "left": ax = w * 0.25; break;
      case "right": ax = w * 0.75; break;
      case "top-left": ax = w * 0.25; ay = padIn + tbh / 2; break;
      case "top-right": ax = w * 0.75; ay = padIn + tbh / 2; break;
      case "bottom-left": ax = w * 0.25; ay = d - padIn - tbh / 2; break;
      case "bottom-right": ax = w * 0.75; ay = d - padIn - tbh / 2; break;
    }

    // Rotate the anchor about the item centre by the item's rotation.
    const ir = ((item.rotation ?? 0) * Math.PI) / 180;
    const ci = Math.cos(ir);
    const si = Math.sin(ir);
    const relX = ax - w / 2;
    const relY = ay - d / 2;
    const acx = cx + (relX * ci - relY * si);
    const acy = cy + (relX * si + relY * ci);

    // Text glyphs rotate with the item plus any per-label rotation.
    const totalDeg = (item.rotation ?? 0) + (item.labelRotation ?? 0);
    const tr = (totalDeg * Math.PI) / 180;
    const ct = Math.cos(tr);
    const st = Math.sin(tr);

    for (let i = 0; i < n; i++) {
      const dy = (i - (n - 1) / 2) * lineHIn; // offset along local +y (down)
      const wx = acx + -dy * st; // rotate (0,dy) by tr
      const wy = acy + dy * ct;
      pdf.text(wrapped[i], X(wx), Y(wy), { align: "center", baseline: "middle", angle: -totalDeg });
    }
  }

  function drawNonUsable(r: NonUsableRegion): void {
    const hasColor = r.color != null && r.color !== "none";
    const stroke: RGB = hasColor ? hexToRgb(r.color as string) : [107, 119, 133];
    pdf.setDrawColor(...stroke);
    pdf.setLineWidth(1);
    pdf.setLineDashPattern([6, 4], 0);
    if (hasColor) {
      pdf.setFillColor(...hexToRgb(r.color as string));
      setOpacity(pdf, 0.2);
      if (r.kind === "rect") rect(r.x, r.y, r.width, r.height, "F");
      else polygon(r.points, "F");
      setOpacity(pdf, 1);
    }
    if (r.kind === "rect") rect(r.x, r.y, r.width, r.height, "S");
    else polygon(r.points, "S");
    pdf.setLineDashPattern([], 0);

    const bb = r.kind === "rect" ? { x: r.x, y: r.y, width: r.width, height: r.height } : polygonBBox(r.points);
    const c = r.kind === "rect" ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : polygonCentroid(r.points);
    const minDim = Math.min(bb.width, bb.height);
    const nameFont = Math.max(6, L(minDim) * 0.16);
    pdf.setTextColor(58, 70, 84);
    setOpacity(pdf, 0.75);
    centeredText([applyCase(r.label ?? "Non-usable")], X(c.x), Y(c.y), nameFont, true);
    const sqft = r.kind === "rect" ? sqftFromInches(r.width, r.height) : polygonArea(r.points) / 144;
    pdf.setFont(labelFontName, "normal");
    pdf.setFontSize(Math.max(5, nameFont * 0.5));
    pdf.text(formatSqft(sqft), X(bb.x + bb.width) - 3, Y(bb.y + bb.height) - 3, { align: "right" });
    setOpacity(pdf, 1);
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, "_");
}
