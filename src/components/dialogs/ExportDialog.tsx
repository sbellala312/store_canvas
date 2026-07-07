import { Modal } from "./Modal";
import { usePlanStore } from "../../state/planStore";
import { useRefImageStore } from "../../state/refImageStore";
import { getStage } from "../../utils/stageRef";
import { exportPNG, exportPDF } from "../../utils/export";
import { exportVectorPDF } from "../../utils/exportVector";

interface Props {
  onClose: () => void;
}

export function ExportDialog({ onClose }: Props) {
  const plan = usePlanStore((s) => s.getActivePlan());
  const pixelsPerInch = usePlanStore((s) => s.pixelsPerInch);
  const refImages = useRefImageStore((s) => s.refImages);
  const refImage = plan ? refImages[plan.id] ?? null : null;
  const furnitureOutline = usePlanStore((s) => s.furnitureOutline);
  const labelFont = usePlanStore((s) => s.labelFont);
  const labelUppercase = usePlanStore((s) => s.labelUppercase);

  const doExport = (format: "png" | "pdf" | "vector") => {
    if (!plan) return;
    if (format === "vector") {
      // Vector PDF — sharp at any zoom, drawn from plan data (no stage needed).
      exportVectorPDF(plan, refImage, furnitureOutline, labelFont, labelUppercase);
    } else {
      // Raster PNG / PDF — rendered off-screen at the best resolution the browser allows.
      const stage = getStage();
      if (!stage) return;
      if (format === "png") exportPNG(stage, plan, pixelsPerInch);
      else exportPDF(stage, plan, pixelsPerInch);
    }
    onClose();
  };

  if (!plan) return null;

  return (
    <Modal title="Export plan" onClose={onClose} width={360}>
      <div style={{ fontSize: 13, color: "#2d3742", marginBottom: 12 }}>
        Export <b>{plan.name}</b> as:
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn} onClick={() => doExport("png")}>
          PNG Image
        </button>
        <button style={btn} onClick={() => doExport("pdf")}>
          PDF File
        </button>
        <button style={btn} onClick={() => doExport("vector")}>
          Vector PDF
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#6b7785", marginTop: 12 }}>
        The whole plan is exported (not just the current view).<br />
        <b>PNG Image</b> / <b>PDF File</b> are high-resolution images at the best size your
        browser can produce. <b>Vector PDF</b> stays perfectly sharp at any zoom — best for detail.
      </div>
    </Modal>
  );
}

const btn: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  background: "white",
  border: "1px solid #c0cad4",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};
