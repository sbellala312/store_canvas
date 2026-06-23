import { Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { NonUsableRegion } from "../../types/model";
import { polygonBBox, polygonCentroid, polygonArea, snap, computeEdgeSnap } from "../../utils/geometry";
import type { SnapGuide, WorldBBox } from "../../utils/geometry";
import type { Zone } from "../../types/model";
import { usePlanStore } from "../../state/planStore";
import { isSpaceDown } from "../../utils/panMode";
import { sqftFromInches, formatSqft } from "../../utils/units";

// Module-level hatch pattern canvas — created once, no clip-Group needed.
function buildHatchPattern(): HTMLCanvasElement {
  const size = 10;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#dde3ea";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#9aa5b1";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(-size, size);
  ctx.lineTo(size, -size);
  ctx.moveTo(0, size * 2);
  ctx.lineTo(size * 2, 0);
  ctx.stroke();
  return c;
}

const HATCH_PATTERN = buildHatchPattern();

interface Props {
  regions: NonUsableRegion[];
  zones: Zone[];
  pixelsPerInch: number;
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  toolIsSelect: boolean;
  gridSize: number;
  snapEnabled: boolean;
  nonUsableEditMode: "view" | "move" | "resize";
  hideLabels?: boolean;
  onSnapGuides?: (guides: SnapGuide[]) => void;
}

export function NonUsableLayer({
  regions,
  zones,
  pixelsPerInch,
  selectedIds,
  onSelect,
  toolIsSelect,
  gridSize,
  snapEnabled,
  nonUsableEditMode,
  hideLabels = false,
  onSnapGuides,
}: Props) {
  const moveNonUsableBy = usePlanStore((s) => s.moveNonUsableBy);
  const updateNonUsable = usePlanStore((s) => s.updateNonUsable);

  return (
    <Group>
      {regions.map((r) => {
        const selected = selectedIds.includes(r.id);
        const isMoveTarget = selected && nonUsableEditMode === "move" && toolIsSelect;
        const isRect = r.kind === "rect";

        const originX = isRect ? r.x * pixelsPerInch : 0;
        const originY = isRect ? r.y * pixelsPerInch : 0;

        const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
          if (isSpaceDown() || !onSnapGuides) return;
          const node = e.target;
          const ppi = pixelsPerInch;
          let dragging: WorldBBox;
          if (isRect) {
            dragging = { x: node.x() / ppi, y: node.y() / ppi, width: r.width, height: r.height };
          } else {
            const bb = polygonBBox(r.points);
            dragging = { x: bb.x + node.x() / ppi, y: bb.y + node.y() / ppi, width: bb.width, height: bb.height };
          }
          const others: WorldBBox[] = [];
          for (const z of zones) {
            others.push(z.kind === "rect"
              ? { x: z.x, y: z.y, width: z.width, height: z.height }
              : polygonBBox(z.points));
          }
          for (const other of regions) {
            if (other.id === r.id) continue;
            others.push(other.kind === "rect"
              ? { x: other.x, y: other.y, width: other.width, height: other.height }
              : polygonBBox(other.points));
          }
          const snapThreshold = Math.max(gridSize, 12);
          const { dx, dy, guides } = computeEdgeSnap(dragging, others, snapThreshold);
          if (dx !== 0) node.x(node.x() + dx * ppi);
          if (dy !== 0) node.y(node.y() + dy * ppi);
          onSnapGuides(guides);
        };

        const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
          onSnapGuides?.([]);
          const nodeX = e.target.x();
          const nodeY = e.target.y();
          e.target.x(originX);
          e.target.y(originY);

          // Build list of other element bboxes for edge-snap
          const others: WorldBBox[] = [];
          for (const z of zones) {
            others.push(z.kind === "rect"
              ? { x: z.x, y: z.y, width: z.width, height: z.height }
              : polygonBBox(z.points));
          }
          for (const other of regions) {
            if (other.id === r.id) continue;
            others.push(other.kind === "rect"
              ? { x: other.x, y: other.y, width: other.width, height: other.height }
              : polygonBBox(other.points));
          }
          const threshold = Math.max(gridSize, 12);

          if (isRect) {
            const rawX = nodeX / pixelsPerInch;
            const rawY = nodeY / pixelsPerInch;
            const { dx: edgeDx, dy: edgeDy, guides } = computeEdgeSnap(
              { x: rawX, y: rawY, width: r.width, height: r.height }, others, threshold);
            const hasXSnap = guides.some((g) => g.axis === "x");
            const hasYSnap = guides.some((g) => g.axis === "y");
            const finalX = hasXSnap ? rawX + edgeDx : snap(rawX, gridSize, snapEnabled);
            const finalY = hasYSnap ? rawY + edgeDy : snap(rawY, gridSize, snapEnabled);
            const dxIn = finalX - r.x;
            const dyIn = finalY - r.y;
            if (dxIn !== 0 || dyIn !== 0) moveNonUsableBy(r.id, dxIn, dyIn);
          } else {
            const dxRaw = nodeX / pixelsPerInch;
            const dyRaw = nodeY / pixelsPerInch;
            const bb = polygonBBox(r.points);
            const { dx: edgeDx, dy: edgeDy, guides } = computeEdgeSnap(
              { x: bb.x + dxRaw, y: bb.y + dyRaw, width: bb.width, height: bb.height }, others, threshold);
            const hasXSnap = guides.some((g) => g.axis === "x");
            const hasYSnap = guides.some((g) => g.axis === "y");
            const finalDx = hasXSnap ? dxRaw + edgeDx : snap(dxRaw, gridSize, snapEnabled);
            const finalDy = hasYSnap ? dyRaw + edgeDy : snap(dyRaw, gridSize, snapEnabled);
            if (finalDx !== 0 || finalDy !== 0) moveNonUsableBy(r.id, finalDx, finalDy);
          }
        };

        const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
          const node = e.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          if (isRect) {
            const newX = node.x() / pixelsPerInch;
            const newY = node.y() / pixelsPerInch;
            const newW = Math.max(6, r.width * scaleX);
            const newH = Math.max(6, r.height * scaleY);
            node.scaleX(1);
            node.scaleY(1);
            updateNonUsable(r.id, { x: newX, y: newY, width: newW, height: newH });
          } else {
            const tx = node.x() / pixelsPerInch;
            const ty = node.y() / pixelsPerInch;
            const newPoints = r.points.map((p) => ({
              x: tx + p.x * scaleX,
              y: ty + p.y * scaleY,
            }));
            node.scaleX(1);
            node.scaleY(1);
            node.x(0);
            node.y(0);
            updateNonUsable(r.id, { points: newPoints });
          }
        };

        if (!isRect) {
          // ---- Polygon non-usable ----
          const flat = r.points.flatMap((p) => [p.x * pixelsPerInch, p.y * pixelsPerInch]);
          const bbox = polygonBBox(r.points);
          const centroid = polygonCentroid(r.points);
          const cx = centroid.x * pixelsPerInch;
          const cy = centroid.y * pixelsPerInch;
          const bboxPxW = bbox.width * pixelsPerInch;
          const bboxPxH = bbox.height * pixelsPerInch;
          const sqft = polygonArea(r.points) / 144;
          const sqftFontSize = Math.max(12, Math.min(20, Math.min(bboxPxW, bboxPxH) * 0.12));
          const labelText = (r.label ?? "Non-usable").toUpperCase();
          const minDim = Math.min(bboxPxW, bboxPxH);
          const labelFontSize = Math.max(14, Math.min(32, minDim * 0.18));
          const labelWidth = Math.max(20, bboxPxW - 16);

          return (
            <Group
              key={r.id}
              x={originX}
              y={originY}
              name={`nonusable-${r.id}`}
              draggable={isMoveTarget}
              onDragStart={(e) => { if (isSpaceDown()) e.target.stopDrag(); }}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
              onClick={(e) => { e.cancelBubble = true; onSelect(r.id, e.evt.shiftKey); }}
              onTap={(e) => { e.cancelBubble = true; onSelect(r.id, false); }}
            >
              <Line
                points={flat}
                closed
                fillPatternImage={HATCH_PATTERN as unknown as HTMLImageElement}
                fillPatternRepeat="repeat"
                stroke={selected ? "#1f6feb" : "#6b7785"}
                strokeWidth={selected ? 2 : 1}
              />
              {!hideLabels && (
                <Text
                  x={cx - labelWidth / 2}
                  y={cy - labelFontSize * 0.7}
                  width={labelWidth}
                  align="center"
                  text={labelText}
                  fontSize={labelFontSize}
                  fontStyle="bold"
                  letterSpacing={1.5}
                  fill="rgba(58,70,84,0.75)"
                  listening={false}
                />
              )}
              {!hideLabels && (
                <Text
                  text={formatSqft(sqft)}
                  fontSize={sqftFontSize}
                  fill="rgba(58,70,84,0.7)"
                  x={(bbox.x + bbox.width) * pixelsPerInch - 4}
                  y={(bbox.y + bbox.height) * pixelsPerInch - sqftFontSize - 2}
                  align="right"
                  width={Math.max(30, bboxPxW - 8)}
                  offsetX={Math.max(30, bboxPxW - 8)}
                  listening={false}
                />
              )}
            </Group>
          );
        }

        // ---- Rect non-usable ----
        const w = r.width * pixelsPerInch;
        const h = r.height * pixelsPerInch;
        const sqft = sqftFromInches(r.width, r.height);
        const sqftFontSize = Math.max(12, Math.min(20, Math.min(w, h) * 0.12));
        const labelText = (r.label ?? "Non-usable").toUpperCase();

        return (
          <Group
            key={r.id}
            x={originX}
            y={originY}
            name={`nonusable-${r.id}`}
            draggable={isMoveTarget}
            onDragStart={(e) => { if (isSpaceDown()) e.target.stopDrag(); }}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
            onClick={(e) => { e.cancelBubble = true; onSelect(r.id, e.evt.shiftKey); }}
            onTap={(e) => { e.cancelBubble = true; onSelect(r.id, false); }}
          >
            <Rect
              width={w}
              height={h}
              fillPatternImage={HATCH_PATTERN as unknown as HTMLImageElement}
              fillPatternRepeat="repeat"
              stroke={selected ? "#1f6feb" : "#6b7785"}
              strokeWidth={selected ? 2 : 1}
            />
            {!hideLabels && <NonUsableLabel text={labelText} bboxWidth={w} bboxHeight={h} />}
            {!hideLabels && (
              <Text
                text={formatSqft(sqft)}
                fontSize={sqftFontSize}
                fill="rgba(58,70,84,0.7)"
                x={w - 4}
                y={h - sqftFontSize - 2}
                align="right"
                width={Math.max(30, w - 8)}
                offsetX={Math.max(30, w - 8)}
                listening={false}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}

function NonUsableLabel({ text, bboxWidth, bboxHeight }: { text: string; bboxWidth: number; bboxHeight: number }) {
  const minDim = Math.min(bboxWidth, bboxHeight);
  const fontSize = Math.max(14, Math.min(32, minDim * 0.18));
  const padding = 6;
  const maxWidth = Math.max(16, bboxWidth - padding * 2);
  return (
    <Text
      x={bboxWidth / 2 - maxWidth / 2}
      y={bboxHeight / 2 - fontSize * 0.7}
      width={maxWidth}
      align="center"
      text={text}
      fontSize={fontSize}
      fontStyle="bold"
      letterSpacing={1.5}
      fill="rgba(58, 70, 84, 0.75)"
      listening={false}
    />
  );
}
