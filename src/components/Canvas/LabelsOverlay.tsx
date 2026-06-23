import { Group, Text } from "react-konva";
import type { Zone, NonUsableRegion } from "../../types/model";
import { polygonBBox, polygonCentroid, polygonArea } from "../../utils/geometry";
import { sqftFromInches, formatSqft } from "../../utils/units";

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface Props {
  zones: Zone[];
  nonUsable: NonUsableRegion[];
  pixelsPerInch: number;
  showLabels: boolean;
}

export function LabelsOverlay({ zones, nonUsable, pixelsPerInch, showLabels }: Props) {
  if (!showLabels) return null;
  const ppi = pixelsPerInch;

  return (
    <Group listening={false}>
      {/* Zone labels */}
      {zones.map((z) => {
        if (z.kind === "rect") {
          const w = z.width * ppi;
          const h = z.height * ppi;
          const minDim = Math.min(w, h);
          const fontSize = Math.max(16, Math.min(40, minDim * 0.18));
          const labelW = Math.max(20, w - 16);
          const sqftFontSize = Math.max(12, Math.min(20, minDim * 0.12));
          return (
            <Group key={`zlbl-${z.id}`} x={z.x * ppi} y={z.y * ppi} listening={false}>
              <Text
                x={w / 2 - labelW / 2}
                y={h / 2 - fontSize * 0.7}
                width={labelW}
                align="center"
                text={z.name.toUpperCase()}
                fontSize={fontSize}
                fontStyle="bold"
                letterSpacing={1.5}
                fill={hexToRgba(z.color, 0.7)}
                listening={false}
              />
              <Text
                text={formatSqft(sqftFromInches(z.width, z.height))}
                fontSize={sqftFontSize}
                fill={hexToRgba(z.color, 0.6)}
                x={w - 4}
                y={h - sqftFontSize - 2}
                align="right"
                width={Math.max(30, w - 8)}
                offsetX={Math.max(30, w - 8)}
                listening={false}
              />
            </Group>
          );
        } else {
          const bbox = polygonBBox(z.points);
          const centroid = polygonCentroid(z.points);
          const bboxPxW = bbox.width * ppi;
          const bboxPxH = bbox.height * ppi;
          const cx = centroid.x * ppi;
          const cy = centroid.y * ppi;
          const minDim = Math.min(bboxPxW, bboxPxH);
          const fontSize = Math.max(16, Math.min(40, minDim * 0.18));
          const labelW = Math.max(20, bboxPxW - 16);
          const sqftFontSize = Math.max(12, Math.min(20, minDim * 0.12));
          const polySqft = polygonArea(z.points) / 144;
          return (
            <Group key={`zlbl-${z.id}`} listening={false}>
              <Text
                x={cx - labelW / 2}
                y={cy - fontSize * 0.7}
                width={labelW}
                align="center"
                text={z.name.toUpperCase()}
                fontSize={fontSize}
                fontStyle="bold"
                letterSpacing={1.5}
                fill={hexToRgba(z.color, 0.7)}
                listening={false}
              />
              <Text
                text={formatSqft(polySqft)}
                fontSize={sqftFontSize}
                fill={hexToRgba(z.color, 0.6)}
                x={(bbox.x + bbox.width) * ppi - 4}
                y={(bbox.y + bbox.height) * ppi - sqftFontSize - 2}
                align="right"
                width={Math.max(30, bboxPxW - 8)}
                offsetX={Math.max(30, bboxPxW - 8)}
                listening={false}
              />
            </Group>
          );
        }
      })}

      {/* Non-usable labels */}
      {nonUsable.map((r) => {
        if (r.kind === "rect") {
          const w = r.width * ppi;
          const h = r.height * ppi;
          const minDim = Math.min(w, h);
          const fontSize = Math.max(14, Math.min(32, minDim * 0.18));
          const labelW = Math.max(16, w - 12);
          const sqftFontSize = Math.max(12, Math.min(20, minDim * 0.12));
          const labelText = (r.label ?? "Non-usable").toUpperCase();
          return (
            <Group key={`nulbl-${r.id}`} x={r.x * ppi} y={r.y * ppi} listening={false}>
              <Text
                x={w / 2 - labelW / 2}
                y={h / 2 - fontSize * 0.7}
                width={labelW}
                align="center"
                text={labelText}
                fontSize={fontSize}
                fontStyle="bold"
                letterSpacing={1.5}
                fill="rgba(58,70,84,0.75)"
                listening={false}
              />
              <Text
                text={formatSqft(sqftFromInches(r.width, r.height))}
                fontSize={sqftFontSize}
                fill="rgba(58,70,84,0.7)"
                x={w - 4}
                y={h - sqftFontSize - 2}
                align="right"
                width={Math.max(30, w - 8)}
                offsetX={Math.max(30, w - 8)}
                listening={false}
              />
            </Group>
          );
        } else {
          const bbox = polygonBBox(r.points);
          const centroid = polygonCentroid(r.points);
          const bboxPxW = bbox.width * ppi;
          const bboxPxH = bbox.height * ppi;
          const cx = centroid.x * ppi;
          const cy = centroid.y * ppi;
          const minDim = Math.min(bboxPxW, bboxPxH);
          const fontSize = Math.max(14, Math.min(32, minDim * 0.18));
          const labelW = Math.max(20, bboxPxW - 16);
          const sqftFontSize = Math.max(12, Math.min(20, minDim * 0.12));
          const sqft = polygonArea(r.points) / 144;
          const labelText = (r.label ?? "Non-usable").toUpperCase();
          return (
            <Group key={`nulbl-${r.id}`} listening={false}>
              <Text
                x={cx - labelW / 2}
                y={cy - fontSize * 0.7}
                width={labelW}
                align="center"
                text={labelText}
                fontSize={fontSize}
                fontStyle="bold"
                letterSpacing={1.5}
                fill="rgba(58,70,84,0.75)"
                listening={false}
              />
              <Text
                text={formatSqft(sqft)}
                fontSize={sqftFontSize}
                fill="rgba(58,70,84,0.7)"
                x={(bbox.x + bbox.width) * ppi - 4}
                y={(bbox.y + bbox.height) * ppi - sqftFontSize - 2}
                align="right"
                width={Math.max(30, bboxPxW - 8)}
                offsetX={Math.max(30, bboxPxW - 8)}
                listening={false}
              />
            </Group>
          );
        }
      })}
    </Group>
  );
}
