import { useState, useRef, type RefObject } from "react";
import { Stage, Layer, Rect, Line, Text } from "react-konva";
import { Modal } from "./Modal";
import { usePlanStore } from "../../state/planStore";
import { computeDiff, type PlanDiff, type ItemChange, type ZoneChange } from "../../utils/comparePlans";
import { getCatalogItem } from "../../data/catalog";
import { feetInches } from "../../utils/units";
import { floorBBox, polygonCentroid } from "../../utils/geometry";
import type { PlacedItem, Zone } from "../../types/model";

interface Props {
  onClose: () => void;
}

const CANVAS_W = 600;
const CANVAS_H = 440;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function htmlSection(title: string, color: string, rows: string[]): string {
  if (rows.length === 0) return "";
  return `
    <div style="margin-bottom:18px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${color};border-left:3px solid ${color};padding-left:8px;margin-bottom:6px">${title}</div>
      ${rows.map((r) => `<div style="font-size:13px;padding:3px 8px 3px 11px;line-height:1.5">${r}</div>`).join("")}
    </div>`;
}

function downloadHTMLReport(diff: PlanDiff, imageDataURL: string | null) {
  const { summary, itemChanges, zoneChanges } = diff;
  const totalChanges = summary.added + summary.removed + summary.moved + summary.zoneChanges;
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const zoneRows = zoneChanges.map((z) => {
    const prefix = z.kind === "added" ? "+" : z.kind === "removed" ? "−" : "~";
    return `${prefix}&nbsp; ${z.name} <span style="color:#999;font-size:11px">(${z.kind})</span>`;
  });
  const addedRows = itemChanges.filter((c) => c.kind === "added").map((c) =>
    `+&nbsp; ${c.name} &mdash; ${c.postZoneName ?? "Unassigned"}`,
  );
  const removedRows = itemChanges.filter((c) => c.kind === "removed").map((c) =>
    `&minus;&nbsp; ${c.name} &mdash; was in ${c.preZoneName ?? "Unassigned"}`,
  );
  const movedRows = itemChanges.filter((c) => c.kind === "moved").map((c) => {
    const dist = c.distanceMoved ? ` (${feetInches(c.distanceMoved, { compact: true })})` : "";
    const from = c.preZoneName ?? "Unassigned";
    const to = c.postZoneName ?? "Unassigned";
    const zone = from === to ? `in ${from}` : `${from} &rarr; ${to}`;
    return `&rarr;&nbsp; ${c.name}${dist ? ` <span style="color:#999">${dist}</span>` : ""} &mdash; ${zone}`;
  });
  const recoloredRows = itemChanges.filter((c) => c.kind === "recolored").map((c) =>
    `~&nbsp; ${c.name} &mdash; color changed`,
  );

  const chip = (color: string, label: string) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px">
      <span style="display:inline-block;width:12px;height:12px;background:${color};border-radius:2px"></span>
      <span style="font-size:12px;color:#555">${label}</span>
    </span>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Plan Comparison: ${diff.prePlan.name} &rarr; ${diff.postPlan.name}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:40px;color:#1a1f26;max-width:860px}
    h1{font-size:22px;margin:0 0 4px;font-weight:700}
    .meta{color:#6b7785;font-size:13px;margin-bottom:28px}
    .badge{display:inline-block;background:#1f6feb;color:white;border-radius:12px;padding:2px 12px;font-size:12px;font-weight:700;vertical-align:middle;margin-left:8px}
    img.canvas{width:100%;max-width:700px;border-radius:6px;border:1px solid #dde3ea;display:block;margin-bottom:8px}
    .legend{display:flex;flex-wrap:wrap;margin-bottom:24px}
    .summary-grid{display:flex;gap:28px;flex-wrap:wrap;background:#f5f7fa;border:1px solid #e1e6ed;border-radius:6px;padding:16px;margin-top:24px}
    .stat{display:flex;flex-direction:column}
    .stat-val{font-size:26px;font-weight:700;line-height:1}
    .stat-lbl{font-size:11px;color:#6b7785;margin-top:2px}
    @media print{body{padding:20px}}
  </style>
</head>
<body>
  <h1>Plan Comparison Report <span class="badge">${totalChanges} change${totalChanges !== 1 ? "s" : ""}</span></h1>
  <div class="meta">
    Before: <strong>${diff.prePlan.name}</strong> &nbsp;&rarr;&nbsp; After: <strong>${diff.postPlan.name}</strong>
    &nbsp;&nbsp;|&nbsp;&nbsp; ${date}
  </div>

  ${imageDataURL ? `<img class="canvas" src="${imageDataURL}" alt="Layout comparison" />` : ""}
  <div class="legend">
    ${chip("#43A047", "Added")}
    ${chip("#F44336", "Removed (old position)")}
    ${chip("#FF9800", "Moved (new position)")}
    ${chip("#999", "Unchanged / ghost (old position)")}
  </div>

  ${htmlSection(`Zone Changes (${zoneChanges.length})`, "#7b1fa2", zoneRows)}
  ${htmlSection(`Items Added (${summary.added})`, "#2e7d32", addedRows)}
  ${htmlSection(`Items Removed (${summary.removed})`, "#c62828", removedRows)}
  ${htmlSection(`Items Moved (${summary.moved})`, "#e65100", movedRows)}
  ${htmlSection(`Color Changes (${summary.recolored})`, "#1565c0", recoloredRows)}

  <div class="summary-grid">
    <div class="stat"><span class="stat-val" style="color:#2e7d32">${summary.added}</span><span class="stat-lbl">Added</span></div>
    <div class="stat"><span class="stat-val" style="color:#c62828">${summary.removed}</span><span class="stat-lbl">Removed</span></div>
    <div class="stat"><span class="stat-val" style="color:#e65100">${summary.moved}</span><span class="stat-lbl">Moved</span></div>
    <div class="stat"><span class="stat-val" style="color:#555">${summary.unchanged}</span><span class="stat-lbl">Unchanged</span></div>
    <div class="stat"><span class="stat-val" style="color:#7b1fa2">${summary.zoneChanges}</span><span class="stat-lbl">Zone changes</span></div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `compare_${diff.prePlan.name}_vs_${diff.postPlan.name}.html`.replace(/[^\w._-]/g, "_");
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Diff Canvas ────────────────────────────────────────────────────────────

function renderItem(
  item: PlacedItem,
  fill: string,
  strokeColor: string,
  opacity: number,
  keyPrefix: string,
  dashed?: boolean,
) {
  const cat = getCatalogItem(item.catalogId);
  const w = cat ? cat.width : 24;
  const d = cat ? cat.depth : 24;
  return { item, w, d, fill, strokeColor, opacity, keyPrefix, dashed };
}

interface RenderedItem {
  item: PlacedItem;
  w: number;
  d: number;
  fill: string;
  strokeColor: string;
  opacity: number;
  keyPrefix: string;
  dashed?: boolean;
}

function DiffItemRect({
  ri,
  scale,
  offX,
  offY,
}: {
  ri: RenderedItem;
  scale: number;
  offX: number;
  offY: number;
}) {
  const { item, w, d, fill, strokeColor, opacity, keyPrefix, dashed } = ri;
  const sw = Math.max(w * scale, 6);
  const sd = Math.max(d * scale, 4);
  const cx = item.x * scale + offX + sw / 2;
  const cy = item.y * scale + offY + sd / 2;
  return (
    <Rect
      key={keyPrefix + item.id}
      x={cx}
      y={cy}
      width={sw}
      height={sd}
      offsetX={sw / 2}
      offsetY={sd / 2}
      rotation={item.rotation}
      fill={fill}
      stroke={strokeColor}
      strokeWidth={1.5}
      opacity={opacity}
      dash={dashed ? [4, 3] : undefined}
    />
  );
}

function DiffZone({ zone, scale, offX, offY }: { zone: Zone; scale: number; offX: number; offY: number }) {
  const fill = hexToRgba(zone.color, 0.14);
  if (zone.kind === "rect") {
    return (
      <>
        <Rect
          x={zone.x * scale + offX}
          y={zone.y * scale + offY}
          width={zone.width * scale}
          height={zone.height * scale}
          fill={fill}
          stroke={zone.color}
          strokeWidth={1}
        />
        <Text
          x={zone.x * scale + offX}
          y={zone.y * scale + offY + 4}
          width={zone.width * scale}
          text={zone.name}
          fontSize={Math.max(9, Math.min(11, zone.width * scale * 0.12))}
          fill={zone.color}
          align="center"
          listening={false}
        />
      </>
    );
  }
  const centroid = polygonCentroid(zone.points);
  return (
    <>
      <Line
        points={zone.points.flatMap((p) => [p.x * scale + offX, p.y * scale + offY])}
        closed={true}
        fill={fill}
        stroke={zone.color}
        strokeWidth={1}
      />
      <Text
        x={centroid.x * scale + offX - 40}
        y={centroid.y * scale + offY - 6}
        width={80}
        text={zone.name}
        fontSize={10}
        fill={zone.color}
        align="center"
        listening={false}
      />
    </>
  );
}

function DiffCanvas({ diff, stageRef }: { diff: PlanDiff; stageRef: RefObject<any> }) {
  const { postPlan, itemChanges } = diff;
  const bbox = floorBBox(postPlan.floor);
  const pad = 20;
  const scale = Math.min(CANVAS_W / (bbox.width + pad * 2), CANVAS_H / (bbox.height + pad * 2));
  const offX = (CANVAS_W - bbox.width * scale) / 2;
  const offY = (CANVAS_H - bbox.height * scale) / 2;

  const removedItems = itemChanges.filter((c) => c.kind === "removed" && c.preItem).map((c) =>
    renderItem(c.preItem!, "#F44336", "#c62828", 0.45, "rem_", true),
  );
  const unchangedItems = itemChanges
    .filter((c) => c.kind === "unchanged" || c.kind === "recolored")
    .filter((c) => c.postItem)
    .map((c) => {
      const col = c.postItem!.color ?? getCatalogItem(c.postItem!.catalogId)?.defaultColor ?? "#888";
      return renderItem(c.postItem!, col, "#555", 0.65, "unc_");
    });
  const movedPreItems = itemChanges.filter((c) => c.kind === "moved" && c.preItem).map((c) =>
    renderItem(c.preItem!, "#bbb", "#999", 0.3, "mpre_", true),
  );
  const movedPostItems = itemChanges.filter((c) => c.kind === "moved" && c.postItem).map((c) =>
    renderItem(c.postItem!, "#FF9800", "#e65100", 0.9, "mpost_"),
  );
  const addedItems = itemChanges.filter((c) => c.kind === "added" && c.postItem).map((c) =>
    renderItem(c.postItem!, "#43A047", "#2e7d32", 1, "add_"),
  );

  const allRendered = [...removedItems, ...unchangedItems, ...movedPreItems, ...movedPostItems, ...addedItems];

  const floor = postPlan.floor;

  return (
    <div>
      <Stage ref={stageRef} width={CANVAS_W} height={CANVAS_H} style={{ background: "#dde3ea", borderRadius: 6, display: "block" }}>
        <Layer>
          {/* Floor outline */}
          {floor.kind === "rect" ? (
            <Rect
              x={offX}
              y={offY}
              width={floor.width * scale}
              height={floor.height * scale}
              fill="white"
              stroke="#aaa"
              strokeWidth={1.5}
            />
          ) : (
            <Line
              points={floor.points.flatMap((p) => [p.x * scale + offX, p.y * scale + offY])}
              closed={true}
              fill="white"
              stroke="#aaa"
              strokeWidth={1.5}
            />
          )}
          {/* Zones */}
          {postPlan.zones.map((z) => (
            <DiffZone key={z.id} zone={z} scale={scale} offX={offX} offY={offY} />
          ))}
          {/* Items in z-order */}
          {allRendered.map((ri) => (
            <DiffItemRect key={ri.keyPrefix + ri.item.id} ri={ri} scale={scale} offX={offX} offY={offY} />
          ))}
        </Layer>
      </Stage>
      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#444", flexWrap: "wrap" }}>
        {[
          { color: "#43A047", label: "Added" },
          { color: "#F44336", label: "Removed (old position)" },
          { color: "#FF9800", label: "Moved (new position)" },
          { color: "#999", label: "Unchanged / ghost (old)" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 12, height: 12, background: color, borderRadius: 2 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Text Report ────────────────────────────────────────────────────────────

function Section({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
          paddingLeft: 8,
          borderLeft: `3px solid ${color}`,
        }}
      >
        {title}
      </div>
      {items.map((text, i) => (
        <div
          key={i}
          style={{
            fontSize: 12,
            padding: "3px 8px 3px 11px",
            color: "#2d3742",
            lineHeight: 1.5,
          }}
        >
          {text}
        </div>
      ))}
    </div>
  );
}

function TextReport({ diff }: { diff: PlanDiff }) {
  const { itemChanges, zoneChanges, summary } = diff;
  const totalChanges = summary.added + summary.removed + summary.moved + summary.zoneChanges;

  const zoneLines = zoneChanges.map((z: ZoneChange) => {
    const prefix = z.kind === "added" ? "+" : z.kind === "removed" ? "−" : "~";
    const label = z.kind === "added" ? "new zone" : z.kind === "removed" ? "removed" : z.kind;
    return `${prefix}  ${z.name}  (${label})`;
  });

  const addedLines = itemChanges
    .filter((c) => c.kind === "added")
    .map((c: ItemChange) => `+  ${c.name}  —  ${c.postZoneName ?? "Unassigned"}`);

  const removedLines = itemChanges
    .filter((c) => c.kind === "removed")
    .map((c: ItemChange) => `−  ${c.name}  —  was in ${c.preZoneName ?? "Unassigned"}`);

  const movedLines = itemChanges
    .filter((c) => c.kind === "moved")
    .map((c: ItemChange) => {
      const dist = c.distanceMoved ? `${feetInches(c.distanceMoved, { compact: true })}` : "";
      const from = c.preZoneName ?? "Unassigned";
      const to = c.postZoneName ?? "Unassigned";
      const zone = from === to ? `in ${from}` : `${from} → ${to}`;
      return `→  ${c.name}${dist ? `  (${dist})` : ""}  —  ${zone}`;
    });

  const recoloredLines = itemChanges
    .filter((c) => c.kind === "recolored")
    .map((c: ItemChange) => `~  ${c.name}  —  color changed`);

  return (
    <div>
      {/* Summary badge */}
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            background: totalChanges > 0 ? "#1f6feb" : "#6b7785",
            color: "white",
            borderRadius: 12,
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {totalChanges} change{totalChanges !== 1 ? "s" : ""}
        </span>
        {totalChanges === 0 && (
          <span style={{ fontSize: 12, color: "#6b7785", marginLeft: 8 }}>Plans are identical</span>
        )}
      </div>

      <Section title={`Zone changes (${zoneChanges.length})`} color="#8E24AA" items={zoneLines} />
      <Section title={`Items added (${summary.added})`} color="#2e7d32" items={addedLines} />
      <Section title={`Items removed (${summary.removed})`} color="#c62828" items={removedLines} />
      <Section title={`Items moved (${summary.moved})`} color="#e65100" items={movedLines} />
      <Section title={`Color changes (${summary.recolored})`} color="#1565c0" items={recoloredLines} />

      {summary.unchanged > 0 && (
        <div style={{ fontSize: 11, color: "#6b7785", marginTop: 4 }}>
          {summary.unchanged} item{summary.unchanged !== 1 ? "s" : ""} unchanged
        </div>
      )}
    </div>
  );
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export function ComparePlansDialog({ onClose }: Props) {
  const plans = usePlanStore((s) => s.plans);
  const [preId, setPreId] = useState(plans[0]?.id ?? "");
  const [postId, setPostId] = useState(plans[1]?.id ?? "");
  const [diff, setDiff] = useState<PlanDiff | null>(null);
  const stageRef = useRef<any>(null);

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    fontSize: 13,
    border: "1px solid #c0cad4",
    borderRadius: 4,
    background: "white",
  };

  const btnStyle = (primary?: boolean): React.CSSProperties => ({
    padding: "7px 14px",
    fontSize: 13,
    borderRadius: 4,
    border: primary ? "none" : "1px solid #c0cad4",
    background: primary ? "#1f6feb" : "white",
    color: primary ? "white" : "#2d3742",
    cursor: "pointer",
    fontWeight: primary ? 600 : 400,
  });

  function handleCompare() {
    const pre = plans.find((p) => p.id === preId);
    const post = plans.find((p) => p.id === postId);
    if (!pre || !post) return;
    setDiff(computeDiff(pre, post));
  }

  function handleSwap() {
    setPreId(postId);
    setPostId(preId);
  }

  // ── Step 1: Plan selection ──────────────────────────────────────────────
  if (!diff) {
    return (
      <Modal title="⇄ Compare Plans" onClose={onClose} width={480}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7785" }}>
            Select the Before (Pre) and After (Post) layouts to see what changed.
          </p>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#2d3742", display: "block", marginBottom: 4 }}>
              Before (Pre) — original layout
            </label>
            <select value={preId} onChange={(e) => setPreId(e.target.value)} style={selectStyle}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              onClick={handleSwap}
              title="Swap Before / After"
              style={{
                background: "#f5f7fa",
                border: "1px solid #c0cad4",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 13,
                cursor: "pointer",
                color: "#444",
              }}
            >
              ⇅ Swap
            </button>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#2d3742", display: "block", marginBottom: 4 }}>
              After (Post) — updated layout
            </label>
            <select value={postId} onChange={(e) => setPostId(e.target.value)} style={selectStyle}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {preId === postId && (
            <p style={{ margin: 0, fontSize: 12, color: "#c62828" }}>
              Before and After must be different plans.
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button style={btnStyle()} onClick={onClose}>
              Cancel
            </button>
            <button style={btnStyle(true)} onClick={handleCompare} disabled={!preId || !postId || preId === postId}>
              Compare →
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Step 2: Results ─────────────────────────────────────────────────────
  return (
    <Modal title={`${diff.prePlan.name}  →  ${diff.postPlan.name}`} onClose={onClose} width={1060}>
      <div>
        {/* Back + Download row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button style={btnStyle()} onClick={() => setDiff(null)}>
            ← Back
          </button>
          <button
            style={btnStyle()}
            onClick={() => {
              const imageDataURL = stageRef.current?.toDataURL({ pixelRatio: 2 }) ?? null;
              downloadHTMLReport(diff, imageDataURL);
            }}
          >
            ⬇ Download Report
          </button>
        </div>

        {/* Side-by-side layout */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          {/* Left: text report */}
          <div
            style={{
              width: 340,
              flexShrink: 0,
              maxHeight: CANVAS_H + 44,
              overflowY: "auto",
              paddingRight: 8,
            }}
          >
            <TextReport diff={diff} />
          </div>

          {/* Right: visual canvas */}
          <div style={{ flex: 1 }}>
            <DiffCanvas diff={diff} stageRef={stageRef} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
