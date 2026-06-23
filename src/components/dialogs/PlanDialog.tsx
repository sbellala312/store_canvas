import { useState } from "react";
import { Modal } from "./Modal";
import { usePlanStore } from "../../state/planStore";
import { parseFeetInches, feetInches } from "../../utils/units";
import type { FloorShape, FloorPlan } from "../../types/model";

interface Props {
  onClose: () => void;
  mode: "new" | "edit";
  existing?: FloorPlan | null;
}

type Shape = "rect" | "L";

function shapeOf(floor: FloorShape | undefined): Shape {
  if (!floor) return "rect";
  return floor.kind === "rect" ? "rect" : "L";
}

function deriveNotch(floor?: FloorShape): { nw: number; nh: number } {
  if (!floor || floor.kind === "rect") return { nw: 120, nh: 120 };
  // Reconstruct notch (assumes bottom-right notch produced by NewPlanDialog)
  const { width, height } = floor.bbox;
  const pts = floor.points;
  let nw = 120;
  let nh = 120;
  for (const p of pts) {
    if (p.x < width && p.x > 0 && p.y < height && p.y > 0) {
      nw = width - p.x;
      nh = height - p.y;
    }
  }
  return { nw, nh };
}

export function PlanDialog({ onClose, mode, existing }: Props) {
  const createPlan = usePlanStore((s) => s.createPlan);
  const updatePlanFloor = usePlanStore((s) => s.updatePlanFloor);

  const initialShape = shapeOf(existing?.floor);
  const initialW =
    existing?.floor.kind === "rect"
      ? existing.floor.width
      : existing?.floor.bbox.width ?? 480;
  const initialH =
    existing?.floor.kind === "rect"
      ? existing.floor.height
      : existing?.floor.bbox.height ?? 360;
  const notch = deriveNotch(existing?.floor);

  const [name, setName] = useState(existing?.name ?? "New Plan");
  const [shape, setShape] = useState<Shape>(initialShape);
  const [widthStr, setWidthStr] = useState(feetInches(initialW, { compact: true }));
  const [heightStr, setHeightStr] = useState(feetInches(initialH, { compact: true }));
  const [notchWStr, setNotchWStr] = useState(feetInches(notch.nw, { compact: true }));
  const [notchHStr, setNotchHStr] = useState(feetInches(notch.nh, { compact: true }));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const w = parseFeetInches(widthStr);
    const h = parseFeetInches(heightStr);
    if (!w || !h || w <= 0 || h <= 0) {
      setError("Enter valid dimensions like 40' or 40' 6\".");
      return;
    }
    let floor: FloorShape;
    if (shape === "rect") {
      floor = { kind: "rect", width: w, height: h };
    } else {
      const nw = parseFeetInches(notchWStr);
      const nh = parseFeetInches(notchHStr);
      if (!nw || !nh || nw <= 0 || nh <= 0 || nw >= w || nh >= h) {
        setError("Notch must be positive and smaller than the floor.");
        return;
      }
      const points = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h - nh },
        { x: w - nw, y: h - nh },
        { x: w - nw, y: h },
        { x: 0, y: h },
      ];
      floor = { kind: "polygon", points, bbox: { width: w, height: h } };
    }
    const trimmedName = name.trim() || "Untitled Plan";
    if (mode === "new") {
      createPlan(trimmedName, floor);
    } else if (existing) {
      updatePlanFloor(existing.id, trimmedName, floor);
    }
    onClose();
  };

  return (
    <Modal title={mode === "new" ? "New Plan" : "Edit Plan"} onClose={onClose}>
      <div style={field}>
        <label style={lbl}>Plan name</label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inp}
        />
      </div>
      <div style={field}>
        <label style={lbl}>Floor shape</label>
        <div style={{ display: "flex", gap: 8 }}>
          <ShapeOption
            active={shape === "rect"}
            onClick={() => setShape("rect")}
            label="Rectangular"
          />
          <ShapeOption
            active={shape === "L"}
            onClick={() => setShape("L")}
            label="L-shaped"
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ ...field, flex: 1 }}>
          <label style={lbl}>Width</label>
          <input
            type="text"
            value={widthStr}
            onChange={(e) => setWidthStr(e.target.value)}
            placeholder="40' or 40' 6&quot;"
            style={inp}
          />
        </div>
        <div style={{ ...field, flex: 1 }}>
          <label style={lbl}>Height</label>
          <input
            type="text"
            value={heightStr}
            onChange={(e) => setHeightStr(e.target.value)}
            placeholder="30'"
            style={inp}
          />
        </div>
      </div>
      {shape === "L" && (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ ...field, flex: 1 }}>
            <label style={lbl}>Notch width (bottom-right)</label>
            <input
              type="text"
              value={notchWStr}
              onChange={(e) => setNotchWStr(e.target.value)}
              style={inp}
            />
          </div>
          <div style={{ ...field, flex: 1 }}>
            <label style={lbl}>Notch height</label>
            <input
              type="text"
              value={notchHStr}
              onChange={(e) => setNotchHStr(e.target.value)}
              style={inp}
            />
          </div>
        </div>
      )}
      {mode === "edit" && (
        <div
          style={{
            fontSize: 11,
            color: "#6b7785",
            marginBottom: 8,
            padding: 8,
            background: "#f5f7fa",
            borderRadius: 4,
          }}
        >
          Note: existing placed items keep their world coordinates. Shrinking the
          floor may leave items outside it — drag them back in.
        </div>
      )}
      {error && (
        <div style={{ color: "#e74c3c", fontSize: 12, marginBottom: 8 }}>{error}</div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button onClick={onClose} style={btnSecondary}>
          Cancel
        </button>
        <button onClick={submit} style={btnPrimary}>
          {mode === "new" ? "Create plan" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}

function ShapeOption({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 12px",
        background: active ? "#1f6feb" : "white",
        color: active ? "white" : "#2d3742",
        border: "1px solid #c0cad4",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

const field: React.CSSProperties = { marginBottom: 12 };
const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#6b7785",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};
const inp: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontSize: 13,
  border: "1px solid #c0cad4",
  borderRadius: 4,
  boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
  padding: "8px 16px",
  background: "#1f6feb",
  color: "white",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
const btnSecondary: React.CSSProperties = {
  padding: "8px 16px",
  background: "white",
  color: "#2d3742",
  border: "1px solid #c0cad4",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
};
