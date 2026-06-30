import { useRef, useState } from "react";
import { usePlanStore, findMatchingKit } from "../../state/planStore";
import { useRefImageStore } from "../../state/refImageStore";
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
  { id: "door", label: "Door" },
  { id: "window", label: "Window" },
  { id: "measure", label: "Measure", shortcut: "M" },
];

export function Toolbar({ onNewPlan, onEditPlan, onOpenPlans, onExport, onSaveKit, onComparePlans }: Props) {
  const [exportDataOpen, setExportDataOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const refImages = useRefImageStore((s) => s.refImages);
  const setRefImage = useRefImageStore((s) => s.setRefImage);
  const updateRef = useRefImageStore((s) => s.update);
  const tool = usePlanStore((s) => s.tool);
  const setTool = usePlanStore((s) => s.setTool);
  const plan = usePlanStore((s) => s.getActivePlan());
  const refImage = plan ? (refImages[plan.id] ?? null) : null;
  const zoom = usePlanStore((s) => s.zoom);
  const setZoom = usePlanStore((s) => s.setZoom);
  const setPan = usePlanStore((s) => s.setPan);
  const toggleGrid = usePlanStore((s) => s.toggleGrid);
  const toggleSnap = usePlanStore((s) => s.toggleSnap);
  const toggleLabels = usePlanStore((s) => s.toggleLabels);
  const showRuler = usePlanStore((s) => s.showRuler);
  const toggleRuler = usePlanStore((s) => s.toggleRuler);
  const scaleRatio = usePlanStore((s) => s.scaleRatio);
  const setScaleRatio = usePlanStore((s) => s.setScaleRatio);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [customRatio, setCustomRatio] = useState("");

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        if (!plan) return;
        const existing = refImage;
        // Preserve existing realWidthFt; recompute only if scale + drawingWidthIn are already set
        let rw = existing?.realWidthFt ??
          parseFloat(((plan.floor.kind === "rect" ? plan.floor.width : plan.floor.bbox.width) / 12).toFixed(3));
        if (existing?.scalePaperIn && existing?.drawingWidthIn) {
          const pw = parseFraction(existing.scalePaperIn);
          const rf = existing.scaleRealFt ?? 1;
          if (!isNaN(pw) && pw > 0 && rf > 0) {
            rw = parseFloat((existing.drawingWidthIn * rf / pw).toFixed(3));
          }
        }
        setRefImage(plan.id, {
          ...(existing ?? {}),
          dataUrl,
          opacity: existing?.opacity ?? 0.4,
          visible: existing?.visible ?? true,
          imageWidth: img.naturalWidth,
          imageHeight: img.naturalHeight,
          realWidthFt: rw,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

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
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} title="Show scale ruler and scale bar">
            <input type="checkbox" checked={showRuler} onChange={toggleRuler} /> Ruler
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
      {/* Scale picker */}
      <div style={{ position: "relative" }}>
        <button
          style={btn(scaleRatio !== 48)}
          onClick={() => setScaleOpen((o) => !o)}
          title="Set drawing scale (e.g. 1:48 means 1 screen inch = 4 real feet)"
        >
          1:{scaleRatio}
        </button>
        {scaleOpen && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 99 }}
              onClick={() => setScaleOpen(false)}
            />
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 4,
                background: "white",
                border: "1px solid #c0cad4",
                borderRadius: 6,
                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                zIndex: 100,
                width: 200,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 12,
                color: "#2d3742",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>Drawing Scale</div>
              <div style={{ color: "#6b7785", fontSize: 11 }}>
                1 screen inch = 1:{scaleRatio} real world
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {([
                  { ratio: 24,  label: "1:24  (½\"=1')" },
                  { ratio: 48,  label: "1:48  (¼\"=1')" },
                  { ratio: 96,  label: "1:96  (⅛\"=1')" },
                  { ratio: 128, label: "1:128 (3/32\"=1')" },
                  { ratio: 192, label: "1:192 (1/16\"=1')" },
                ] as const).map(({ ratio, label }) => (
                  <button
                    key={ratio}
                    style={{
                      ...btn(scaleRatio === ratio),
                      textAlign: "left",
                      fontFamily: "monospace",
                      fontSize: 11,
                    }}
                    onClick={() => {
                      setScaleRatio(ratio);
                      setScaleOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ borderTop: "1px solid #e0e8f0", paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: "#6b7785", marginBottom: 4 }}>Custom ratio:</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12 }}>1 :</span>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    value={customRatio}
                    placeholder={String(scaleRatio)}
                    onChange={(e) => setCustomRatio(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const n = parseInt(customRatio, 10);
                        if (n >= 1 && n <= 10000) {
                          setScaleRatio(n);
                          setCustomRatio("");
                          setScaleOpen(false);
                        }
                      }
                    }}
                    style={{
                      width: 80,
                      padding: "4px 6px",
                      border: "1px solid #c0cad4",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  />
                  <button
                    style={btn(false)}
                    onClick={() => {
                      const n = parseInt(customRatio, 10);
                      if (n >= 1 && n <= 10000) {
                        setScaleRatio(n);
                        setCustomRatio("");
                        setScaleOpen(false);
                      }
                    }}
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
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
      <div style={divider} />
      {/* Reference image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />
      <div style={{ position: "relative" }}>
        <button
          style={btn(refOpen)}
          onClick={() => setRefOpen((o) => !o)}
          title="Load a reference image (e.g. CAD floor plan) to trace over"
        >
          🖼 Ref {refImage ? (refImage.visible ? "●" : "○") : ""}
        </button>
        {refOpen && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 99 }}
              onClick={() => setRefOpen(false)}
            />
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                background: "white",
                border: "1px solid #c0cad4",
                borderRadius: 6,
                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                zIndex: 100,
                width: 240,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 12,
                color: "#2d3742",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>Reference Image</div>
              <button
                style={{ ...btn(false), textAlign: "left" }}
                onClick={() => fileInputRef.current?.click()}
              >
                {fileName ? `📎 ${fileName}` : "Choose image…"}
              </button>
              {refImage && (
                <>
                  {/* Architectural scale — e.g. 3/32" = 1' */}
                  <RefScaleSection refImage={refImage} planId={plan?.id ?? ""} updateRef={updateRef} />
                  {/* Real width — auto-filled or manual */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontWeight: 500 }}>Real width (ft)</span>
                    <input
                      type="number"
                      min={0.001}
                      step={0.001}
                      value={refImage.realWidthFt}
                      onChange={(e) => plan && updateRef(plan.id, {
                        realWidthFt: parseFloat(e.target.value) || refImage.realWidthFt,
                        drawingWidthIn: undefined,
                        scalePaperIn: undefined,
                        scaleRealFt: undefined,
                      })}
                      style={{
                        width: "100%",
                        padding: "4px 6px",
                        border: "1px solid #c0cad4",
                        borderRadius: 4,
                        fontSize: 12,
                        background: refImage.drawingWidthIn ? "#f0f4f8" : "white",
                      }}
                    />
                    {refImage.drawingWidthIn && (
                      <span style={{ fontSize: 10, color: "#6b7785" }}>
                        Auto-computed. Edit to override.
                      </span>
                    )}
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span>Opacity — {Math.round(refImage.opacity * 100)}%</span>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      value={Math.round(refImage.opacity * 100)}
                      onChange={(e) => plan && updateRef(plan.id, { opacity: Number(e.target.value) / 100 })}
                      style={{ width: "100%" }}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={refImage.visible}
                      onChange={(e) => plan && updateRef(plan.id, { visible: e.target.checked })}
                    />
                    Show on canvas
                  </label>
                  <button
                    style={{ ...btn(false), color: "#c0392b", borderColor: "#e0a09a" }}
                    onClick={() => { if (plan) setRefImage(plan.id, null); setFileName(null); }}
                  >
                    Clear image
                  </button>
                </>
              )}
              {!refImage && (
                <div style={{ color: "#6b7785", fontSize: 11, lineHeight: 1.5 }}>
                  Upload a PNG/JPG of your CAD floor plan to use as a tracing guide.<br /><br />
                  <strong>Tip:</strong> Enter the scale exactly as printed on the drawing (e.g. <em>3/32" = 1'</em>) and the drawing width in inches — the real width is computed automatically.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Architectural scale sub-panel ────────────────────────────────────────────

function parseFraction(s: string): number {
  const t = s.trim();
  const slash = t.indexOf("/");
  if (slash >= 0) {
    const num = parseFloat(t.slice(0, slash));
    const den = parseFloat(t.slice(slash + 1));
    return den !== 0 ? num / den : NaN;
  }
  return parseFloat(t);
}

interface RefScaleSectionProps {
  refImage: {
    imageWidth?: number; imageHeight?: number;
    scalePaperIn?: string; scaleRealFt?: number;
    drawingWidthIn?: number; realWidthFt: number;
  };
  planId: string;
  updateRef: (planId: string, patch: object) => void;
}

function RefScaleSection({ refImage, planId, updateRef }: RefScaleSectionProps) {
  const paperInVal  = parseFraction(refImage.scalePaperIn ?? "");
  const realFtVal   = refImage.scaleRealFt ?? 1;
  const scaleValid  = !isNaN(paperInVal) && paperInVal > 0 && realFtVal > 0;
  const scaleRatioN = scaleValid ? Math.round(realFtVal * 12 / paperInVal) : null;

  const drawingW    = refImage.drawingWidthIn;
  const computedRw  = scaleValid && drawingW && drawingW > 0
    ? parseFloat((drawingW * realFtVal / paperInVal).toFixed(3))
    : null;

  function recompute(newPaperIn: string, newRf: number, newDw?: number) {
    const pw = parseFraction(newPaperIn);
    const rw = (!isNaN(pw) && pw > 0 && newRf > 0 && newDw && newDw > 0)
      ? parseFloat((newDw * newRf / pw).toFixed(3))
      : null;
    return rw;
  }

  const inputStyle: React.CSSProperties = {
    padding: "4px 6px",
    border: "1px solid #c0cad4",
    borderRadius: 4,
    fontSize: 12,
    width: "100%",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* Scale label row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontWeight: 500, fontSize: 12 }}>Drawing scale</span>
        {scaleRatioN && (
          <span style={{ fontSize: 10, background: "#e8f0fe", color: "#1f6feb", borderRadius: 3, padding: "1px 5px", fontFamily: "monospace" }}>
            1:{scaleRatioN}
          </span>
        )}
      </div>

      {/* [3/32] " = [1] ' */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="text"
          value={refImage.scalePaperIn ?? ""}
          placeholder="3/32"
          onChange={(e) => {
            const v = e.target.value;
            const rw = recompute(v, realFtVal, drawingW);
            updateRef(planId, { scalePaperIn: v, ...(rw !== null ? { realWidthFt: rw } : {}) });
          }}
          style={{ ...inputStyle, width: 64 }}
          title='Paper side of scale e.g. "3/32" or "1/4"'
        />
        <span style={{ fontSize: 11, color: "#4b5563", whiteSpace: "nowrap" }}>" =</span>
        <input
          type="number"
          min={0.001}
          step={1}
          value={refImage.scaleRealFt ?? ""}
          placeholder="1"
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (isNaN(v) || v <= 0) { updateRef(planId, { scaleRealFt: undefined }); return; }
            const rw = recompute(refImage.scalePaperIn ?? "", v, drawingW);
            updateRef(planId, { scaleRealFt: v, ...(rw !== null ? { realWidthFt: rw } : {}) });
          }}
          style={{ ...inputStyle, width: 48 }}
          title="Real-world side in feet"
        />
        <span style={{ fontSize: 11, color: "#4b5563" }}>'</span>
      </div>

      {/* Drawing width input */}
      <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontWeight: 500, fontSize: 12 }}>Drawing width (in)</span>
        <input
          type="number"
          min={0.001}
          step={0.5}
          value={drawingW ?? ""}
          placeholder="e.g. 42"
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (isNaN(v) || v <= 0) {
              updateRef(planId, { drawingWidthIn: undefined });
              return;
            }
            const rw = recompute(refImage.scalePaperIn ?? "", realFtVal, v);
            updateRef(planId, { drawingWidthIn: v, ...(rw !== null ? { realWidthFt: rw } : {}) });
          }}
          style={{ ...inputStyle }}
        />
        <span style={{ fontSize: 10, color: "#9aa5b1", lineHeight: 1.5 }}>
          Find in PDF: File → Properties → Page Size.<br />
          If shown in points, divide by 72<br />
          (e.g. 3024 pt ÷ 72 = <strong>42 in</strong>).
        </span>
      </label>

      {/* Image pixel dimensions (info only) */}
      {refImage.imageWidth && (
        <div style={{ fontSize: 10, color: "#9aa5b1" }}>
          Image: {refImage.imageWidth} × {refImage.imageHeight} px
        </div>
      )}

      {/* Result banner */}
      {computedRw !== null ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 4, padding: "6px 8px", fontSize: 11, color: "#15803d", fontFamily: "monospace" }}>
          {drawingW!.toFixed(1)}" × {realFtVal}' ÷ {refImage.scalePaperIn}" = <strong>{computedRw} ft</strong>
        </div>
      ) : scaleValid && !drawingW ? (
        <div style={{ fontSize: 10, color: "#9aa5b1" }}>Enter drawing width above to compute real width.</div>
      ) : null}

      <div style={{ borderTop: "1px solid #e8edf2", margin: "2px 0" }} />
    </div>
  );
}
