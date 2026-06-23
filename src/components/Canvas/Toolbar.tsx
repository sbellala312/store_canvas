import { useState } from "react";
import { usePlanStore, findMatchingKit } from "../../state/planStore";
import type { Tool } from "../../types/model";
import { downloadJSON, downloadCSV } from "../../utils/exportData";

interface Props {
  onNewPlan: () => void;
  onEditPlan: () => void;
  onOpenPlans: () => void;
  onExport: () => void;
  onSaveKit: () => void;
  onComparePlans: () => void;
}

const TOOLS: { id: Tool; label: string; shortcut?: string }[] = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "pan", label: "✋ Pan", shortcut: "H" },
  { id: "zone", label: "Zone (rect)" },
  { id: "zonePolygon", label: "Zone (free)" },
  { id: "nonUsable", label: "Non-usable" },
  { id: "nonUsablePolygon", label: "Non-usable (free)" },
  { id: "wall", label: "Wall" },
  { id: "measure", label: "Measure", shortcut: "M" },
];

export function Toolbar({ onNewPlan, onEditPlan, onOpenPlans, onExport, onSaveKit, onComparePlans }: Props) {
  const [exportDataOpen, setExportDataOpen] = useState(false);
  const tool = usePlanStore((s) => s.tool);
  const setTool = usePlanStore((s) => s.setTool);
  const plan = usePlanStore((s) => s.getActivePlan());
  const zoom = usePlanStore((s) => s.zoom);
  const setZoom = usePlanStore((s) => s.setZoom);
  const setPan = usePlanStore((s) => s.setPan);
  const toggleGrid = usePlanStore((s) => s.toggleGrid);
  const toggleSnap = usePlanStore((s) => s.toggleSnap);
  const toggleLabels = usePlanStore((s) => s.toggleLabels);
  const undo = usePlanStore((s) => s.undo);
  const redo = usePlanStore((s) => s.redo);
  const canUndo = usePlanStore((s) => s.canUndo());
  const canRedo = usePlanStore((s) => s.canRedo());
  const selectionIds = usePlanStore((s) => s.selectionIds);
  const kits = usePlanStore((s) => s.kits);
  const plans = usePlanStore((s) => s.plans);

  const matchingKit = plan && selectionIds.length > 1
    ? findMatchingKit(selectionIds, plan.placedItems, kits)
    : null;

  const btn = (active: boolean): React.CSSProperties => ({
    background: active ? "#1f6feb" : "white",
    color: active ? "white" : "#2d3742",
    border: "1px solid #c0cad4",
    borderRadius: 4,
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
  });

  const divider: React.CSSProperties = {
    width: 1,
    height: 22,
    background: "#d0d8e0",
    margin: "0 4px",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        background: "#f5f7fa",
        borderBottom: "1px solid #c0cad4",
        flexWrap: "wrap",
      }}
    >
      <button style={btn(false)} onClick={onOpenPlans}>📋 Plans</button>
      <button style={btn(false)} onClick={onNewPlan}>+ New</button>
      <button style={btn(false)} onClick={onEditPlan} disabled={!plan} title="Edit floor dimensions and shape">
        ✎ Edit Plan
      </button>
      <div style={divider} />
      {TOOLS.map((t) => (
        <button
          key={t.id}
          style={btn(tool === t.id)}
          onClick={() => setTool(t.id)}
          title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
        >
          {t.label}
        </button>
      ))}
      <div style={divider} />
      <button style={btn(false)} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↶</button>
      <button style={btn(false)} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">↷</button>
      <div style={divider} />
      <button
        style={btn(false)}
        disabled={selectionIds.length === 0 || !!matchingKit}
        onClick={onSaveKit}
        title={
          matchingKit
            ? `Kit already saved: "${matchingKit.name}"`
            : "Save selection as a reusable kit"
        }
      >
        {matchingKit ? `★ ${matchingKit.name}` : "★ Save Kit"}
      </button>
      <div style={divider} />
      {plan && (
        <>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={plan.showGrid} onChange={toggleGrid} /> Grid
          </label>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={plan.snapEnabled} onChange={toggleSnap} /> Snap
          </label>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={plan.showLabels} onChange={toggleLabels} /> Labels
          </label>
        </>
      )}
      <div style={divider} />
      <button style={btn(false)} onClick={() => setZoom(zoom / 1.2)}>−</button>
      <span style={{ fontSize: 12, minWidth: 40, textAlign: "center" }}>
        {(zoom * 100).toFixed(0)}%
      </span>
      <button style={btn(false)} onClick={() => setZoom(zoom * 1.2)}>+</button>
      <button
        style={btn(false)}
        onClick={() => {
          setZoom(1);
          setPan({ x: 40, y: 40 });
        }}
      >
        Fit
      </button>
      <div style={divider} />
      <button style={btn(false)} onClick={onExport}>⬇ Export</button>
      <div style={{ position: "relative" }}>
        <button
          style={btn(false)}
          onClick={() => setExportDataOpen((o) => !o)}
          disabled={!plan}
          title="Export plan data as JSON or CSV"
        >
          ⬇ Data
        </button>
        {exportDataOpen && plan && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 99 }}
              onClick={() => setExportDataOpen(false)}
            />
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 2,
                background: "white",
                border: "1px solid #c0cad4",
                borderRadius: 4,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                zIndex: 100,
                minWidth: 150,
                padding: 4,
              }}
            >
              <button
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  background: "none",
                  border: "none",
                  fontSize: 12,
                  cursor: "pointer",
                  borderRadius: 3,
                  color: "#2d3742",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f0f4f8"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                onClick={() => { downloadJSON(plan); setExportDataOpen(false); }}
              >
                Download JSON
              </button>
              <button
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  background: "none",
                  border: "none",
                  fontSize: 12,
                  cursor: "pointer",
                  borderRadius: 3,
                  color: "#2d3742",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f0f4f8"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                onClick={() => { downloadCSV(plan); setExportDataOpen(false); }}
              >
                Download CSV
              </button>
            </div>
          </>
        )}
      </div>
      <div style={divider} />
      <button
        style={btn(false)}
        onClick={onComparePlans}
        disabled={plans.length < 2}
        title={plans.length < 2 ? "Need at least 2 plans to compare" : "Compare two plan layouts"}
      >
        ⇄ Compare
      </button>
    </div>
  );
}
