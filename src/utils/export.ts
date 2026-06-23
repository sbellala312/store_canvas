import type Konva from "konva";
import jsPDF from "jspdf";
import type { FloorPlan } from "../types/model";
import { feetInches } from "./units";

export function exportPNG(stage: Konva.Stage, plan: FloorPlan): void {
  const dataURL = stage.toDataURL({ pixelRatio: 2 });
  const link = document.createElement("a");
  link.download = `${sanitize(plan.name)}.png`;
  link.href = dataURL;
  link.click();
}

export function exportPDF(stage: Konva.Stage, plan: FloorPlan): void {
  const dataURL = stage.toDataURL({ pixelRatio: 2 });
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
