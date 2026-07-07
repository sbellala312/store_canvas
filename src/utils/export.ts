import type Konva from "konva";
import jsPDF from "jspdf";
import type { FloorPlan } from "../types/model";
import { getCatalogItem } from "../data/catalog";
import { floorBBox } from "./geometry";
import { feetInches } from "./units";

// Export resolution. The whole plan is rendered at EXPORT_PPI pixels per real-world
// inch (independent of the on-screen drawing scale), capped so the longest side starts
// at EXPORT_MAX_DIM px. Browsers silently return a BLANK canvas past their (machine-
// dependent) size limit, so renderFullPlan starts here and steps DOWN by SHRINK_FACTOR
// until it produces a non-blank image — giving the best quality each browser can handle.
const EXPORT_PPI = 40;
const EXPORT_MAX_DIM = 9000;
const SHRINK_FACTOR = 0.72;
const MAX_ATTEMPTS = 8;

// Detects a blank/failed export by downscaling to 64×64 and checking for any pixel that
// isn't transparent-or-white (furniture, zones, walls all add colour/dark strokes).
function isBlankCanvas(canvas: HTMLCanvasElement): boolean {
  try {
    const probe = document.createElement("canvas");
    probe.width = 64;
    probe.height = 64;
    const ctx = probe.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(canvas, 0, 0, 64, 64);
    const { data } = ctx.getImageData(0, 0, 64, 64);
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a > 10 && (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245)) return false;
    }
    return true;
  } catch {
    return true; // couldn't inspect → treat as blank so we step down to a safe size
  }
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Bounding box (in inches) covering the whole plan: the floor plus every placed item,
// even ones dragged outside the floor. A small margin is added around it.
export function planContentBounds(plan: FloorPlan): Bounds {
  const { width: fw, height: fh } = floorBBox(plan.floor);
  let minX = 0;
  let minY = 0;
  let maxX = fw;
  let maxY = fh;

  for (const it of plan.placedItems ?? []) {
    const spec = it.spec ?? getCatalogItem(it.catalogId);
    const w = spec?.width ?? 24;
    const d = spec?.depth ?? 24;
    // Half-diagonal so any rotation of the footprint is fully covered.
    const r = Math.sqrt(w * w + d * d) / 2;
    const cx = it.x + w / 2;
    const cy = it.y + d / 2;
    if (cx - r < minX) minX = cx - r;
    if (cy - r < minY) minY = cy - r;
    if (cx + r > maxX) maxX = cx + r;
    if (cy + r > maxY) maxY = cy + r;
  }

  const pad = 12; // inches of breathing room
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

// Renders the ENTIRE plan (not just the viewport) to a data URL at high resolution.
// Temporarily neutralizes zoom/pan and resizes the stage to fit the whole content,
// captures it, then restores everything exactly as it was.
function renderFullPlan(
  stage: Konva.Stage,
  plan: FloorPlan,
  pixelsPerInch: number,
  mimeType: string,
): string {
  const b = planContentBounds(plan);
  const longest = Math.max(1, b.w, b.h); // inches
  let effectivePPI = Math.min(EXPORT_PPI, EXPORT_MAX_DIM / longest);

  // Save current viewport state.
  const prev = {
    width: stage.width(),
    height: stage.height(),
    scaleX: stage.scaleX(),
    scaleY: stage.scaleY(),
    x: stage.x(),
    y: stage.y(),
  };
  // Hide selection/rotate handles so they don't show up in the export.
  const transformers = stage.find("Transformer");
  const tVisible = transformers.map((t) => t.visible());
  transformers.forEach((t) => t.visible(false));

  let dataURL = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const outW = Math.max(1, Math.round(b.w * effectivePPI));
    const outH = Math.max(1, Math.round(b.h * effectivePPI));
    // Layers draw at `worldInch * pixelsPerInch`; scale the stage so that maps to
    // `worldInch * effectivePPI` in the output, regardless of the on-screen scale.
    const scale = effectivePPI / pixelsPerInch;
    // Position so the plan's top-left (b.x, b.y) maps to canvas (0,0) and fills the stage.
    stage.scale({ x: scale, y: scale });
    stage.position({ x: -b.x * pixelsPerInch * scale, y: -b.y * pixelsPerInch * scale });
    stage.size({ width: outW, height: outH });
    stage.batchDraw();

    try {
      const canvas = stage.toCanvas({ pixelRatio: 1 });
      if (!isBlankCanvas(canvas)) {
        dataURL = canvas.toDataURL(mimeType);
        break;
      }
    } catch {
      // Canvas too large for this browser — fall through and shrink.
    }
    effectivePPI *= SHRINK_FACTOR; // too big → step down and retry
  }

  // Restore the viewport.
  stage.size({ width: prev.width, height: prev.height });
  stage.scale({ x: prev.scaleX, y: prev.scaleY });
  stage.position({ x: prev.x, y: prev.y });
  transformers.forEach((t, i) => t.visible(tVisible[i]));
  stage.batchDraw();

  return dataURL;
}

export function exportPNG(stage: Konva.Stage, plan: FloorPlan, pixelsPerInch: number): void {
  const dataURL = renderFullPlan(stage, plan, pixelsPerInch, "image/png");
  const link = document.createElement("a");
  link.download = `${sanitize(plan.name)}.png`;
  link.href = dataURL;
  link.click();
}

export function exportPDF(stage: Konva.Stage, plan: FloorPlan, pixelsPerInch: number): void {
  const dataURL = renderFullPlan(stage, plan, pixelsPerInch, "image/png");
  const w = plan.floor.kind === "rect" ? plan.floor.width : plan.floor.bbox.width;
  const h = plan.floor.kind === "rect" ? plan.floor.height : plan.floor.bbox.height;

  const orientation = w >= h ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "letter" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.setFontSize(14);
  pdf.text(plan.name, 36, 36);
  pdf.setFontSize(10);
  pdf.setTextColor(110);
  pdf.text(
    `Floor: ${feetInches(w, { compact: true })} × ${feetInches(h, { compact: true })}  ·  Exported ${new Date().toLocaleString()}`,
    36,
    52,
  );

  const margin = 36;
  const headerSpace = 70;
  const availW = pageWidth - margin * 2;
  const availH = pageHeight - margin - headerSpace;

  const img = new Image();
  img.src = dataURL;
  img.onload = () => {
    // The image is high-resolution; it's displayed to fit the page but retains full
    // detail when zoomed in a PDF viewer.
    const ratio = Math.min(availW / img.width, availH / img.height);
    const drawW = img.width * ratio;
    const drawH = img.height * ratio;
    const x = (pageWidth - drawW) / 2;
    const y = headerSpace + (availH - drawH) / 2;
    pdf.addImage(dataURL, "PNG", x, y, drawW, drawH);
    pdf.save(`${sanitize(plan.name)}.pdf`);
  };
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, "_");
}
