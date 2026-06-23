import { Modal } from "./Modal";
import { usePlanStore } from "../../state/planStore";
import { getStage } from "../../utils/stageRef";
import { exportPNG, exportPDF } from "../../utils/export";

interface Props {
  onClose: () => void;
}

export function ExportDialog({ onClose }: Props) {
  const plan = usePlanStore((s) => s.getActivePlan());

  const doExport = (format: "png" | "pdf") => {
    const stage = getStage();
    if (!stage || !plan) return;
    if (format === "png") exportPNG(stage, plan);
    else exportPDF(stage, plan);
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
          PNG image
        </button>
        <button style={btn} onClick={() => doExport("pdf")}>
          PDF document
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#6b7785", marginTop: 12 }}>
        Note: zoom and pan are baked in. For a clean output, click <b>Fit</b> in the
        toolbar first.
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
