import { useState } from "react";
import type { CadReviewRow } from "../../services/cadAutoPlace";

interface Props {
  /** The exact image sent to Gemini (full store or zone crop). */
  image: string;
  /** Review rows — used to color boxes by match status and label them. */
  rows: CadReviewRow[];
}

/**
 * Visual explanation of the auto-place technique: overlays Gemini's returned
 * bounding boxes on the exact image it analyzed. Each box is positioned from the
 * detection's 0-1000 normalized coordinates, colored by match status, and labeled
 * with its SKU — so you can see what the model detected and where.
 */
export function CadDetectionMap({ image, rows }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  // One box per unique detection (rows from the same detection share a box).
  const boxes = rows.map((row, i) => {
    const b = row.detection.box; // 0-1000 space
    const left = Math.min(b.x1, b.x2) / 10;   // → percent
    const top = Math.min(b.y1, b.y2) / 10;
    const width = Math.abs(b.x2 - b.x1) / 10;
    const height = Math.abs(b.y2 - b.y1) / 10;
    const color =
      row.status === "matched" ? "#1a9c4a"
      : row.status === "duplicate" ? "#c8860a"
      : "#d64545";
    return { i, row, left, top, width, height, color };
  });

  const matched = rows.filter((r) => r.status === "matched").length;
  const dup = rows.filter((r) => r.status === "duplicate").length;
  const unmatched = rows.filter((r) => r.status === "unmatched").length;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#5a6572", marginBottom: 8, lineHeight: 1.5 }}>
        This is the exact image sent to <b>Gemini 2.5 Flash</b>. Each box is a furniture
        footprint the model detected, returned as normalized <code>0–1000</code> coordinates and
        mapped onto your canvas. Hover a box to see its label.
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 12, flexWrap: "wrap" }}>
        <Legend color="#1a9c4a" label={`Matched (${matched})`} />
        <Legend color="#c8860a" label={`Already on canvas (${dup})`} />
        <Legend color="#d64545" label={`Not in catalog (${unmatched})`} />
      </div>

      {/* Image + overlay */}
      <div style={{
        position: "relative", display: "inline-block", width: "100%",
        border: "1px solid #d8dee6", borderRadius: 8, overflow: "hidden", background: "#f4f6f8",
        lineHeight: 0,
      }}>
        <img src={image} alt="Analyzed floor plan" style={{ width: "100%", display: "block" }} />
        {boxes.map((box) => (
          <div
            key={box.i}
            onMouseEnter={() => setHover(box.i)}
            onMouseLeave={() => setHover(null)}
            style={{
              position: "absolute",
              left: `${box.left}%`, top: `${box.top}%`,
              width: `${box.width}%`, height: `${box.height}%`,
              border: `2px solid ${box.color}`,
              background: hover === box.i ? `${box.color}33` : `${box.color}14`,
              borderRadius: 3,
              boxSizing: "border-box",
              cursor: "default",
              zIndex: hover === box.i ? 5 : 1,
              transition: "background 0.1s",
            }}
          >
            <span style={{
              position: "absolute", top: -1, left: -1,
              transform: "translateY(-100%)",
              background: box.color, color: "white",
              fontSize: 9, lineHeight: 1.4, fontWeight: 600,
              padding: "1px 4px", borderRadius: "3px 3px 3px 0",
              whiteSpace: "nowrap",
              opacity: hover === box.i ? 1 : 0.9,
              display: box.width < 4 && hover !== box.i ? "none" : "block",
            }}>
              {box.row.sku}
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#8a96a3", marginTop: 6 }}>
        Technique: vision-language model (Gemini) performs object detection + OCR on the CAD
        drawing, returning a bounding box and rotation per piece. We match each label to the
        Ashley catalog, then convert box centers to canvas inches for placement.
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#4a5568" }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${color}`, background: `${color}22` }} />
      {label}
    </span>
  );
}
