import { Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { Zone } from "../../types/model";
import { polygonBBox, polygonArea, polygonCentroid, snap, computeEdgeSnap } from "../../utils/geometry";
import type { SnapGuide, WorldBBox } from "../../utils/geometry";
import type { NonUsableRegion } from "../../types/model";
import { usePlanStore } from "../../state/planStore";
import { isSpaceDown } from "../../utils/panMode";
import { sqftFromInches, formatSqft } from "../../utils/units";

interface Props {
  zones: Zone[];
  nonUsable: NonUsableRegion[];
  pixelsPerInch: number;
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  toolIsSelect: boolean;
  gridSize: number;
  snapEnabled: boolean;
  zoneEditMode: "view" | "move" | "resize";
  hideLabels?: boolean;
  onSnapGuides?: (guides: SnapGuide[]) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ZonesLayer({
  zones,
  nonUsable,
  pixelsPerInch,
  selectedIds,
  onSelect,
  toolIsSelect,
  gridSize,
  snapEnabled,
  zoneEditMode,
  hideLabels = false,
  onSnapGuides,
}: Props) {
  const moveZoneBy = usePlanStore((s) => s.moveZoneBy);
  const updateZone = usePlanStore((s) => s.updateZone);

  return (
    <Group>
      {zones.map((z) => {
        const selected = selectedIds.includes(z.id);
        const isPoly = z.kind === "polygon";
        const isMoveTarget = selected && zoneEditMode === "move" && toolIsSelect;
        const isResizeTarget = selected && zoneEditMode === "resize" && toolIsSelect;

        const originX = !isPoly ? z.x * pixelsPerInch : 0;
        const originY = !isPoly ? z.y * pixelsPerInch : 0;

        const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
          onSnapGuides?.([]);
          const nodeX = e.target.x();
          const nodeY = e.target.y();
          e.target.x(originX);
          e.target.y(originY);

          // Build list of other element bboxes for edge-snap
          const others: WorldBBox[] = [];
          for (const other of zones) {
            if (other.id === z.id) continue;
            others.push(other.kind === "rect"
              ? { x: other.x, y: other.y, width: other.width, height: other.height }
              : polygonBBox(other.points));
          }
          for (const nu of nonUsable) {
            others.push(nu.kind === "rect"
              ? { x: nu.x, y: nu.y, width: nu.width, height: nu.height }
              : polygonBBox(nu.points));
          }
          const threshold = Math.max(gridSize, 12);

          if (!isPoly) {
            const rawX = nodeX / pixelsPerInch;
            const rawY = nodeY / pixelsPerInch;
            const { dx: edgeDx, dy: edgeDy, guides } = computeEdgeSnap(
              { x: rawX, y: rawY, width: z.width, height: z.height }, others, threshold);
            // Use presence of a guide (not dx/dy value) to detect alignment:
            // edgeDx === 0 can mean "already exactly on an edge" — guides tells us which.
            const hasXSnap = guides.some((g) => g.axis === "x");
            const hasYSnap = guides.some((g) => g.axis === "y");
            const finalX = hasXSnap ? rawX + edgeDx : snap(rawX, gridSize, snapEnabled);
            const finalY = hasYSnap ? rawY + edgeDy : snap(rawY, gridSize, snapEnabled);
            const dxIn = finalX - z.x;
            const dyIn = finalY - z.y;
            if (dxIn !== 0 || dyIn !== 0) moveZoneBy(z.id, dxIn, dyIn);
          } else {
            const dxRaw = nodeX / pixelsPerInch;
            const dyRaw = nodeY / pixelsPerInch;
            const bb = polygonBBox(z.points);
            const { dx: edgeDx, dy: edgeDy, guides } = computeEdgeSnap(
              { x: bb.x + dxRaw, y: bb.y + dyRaw, width: bb.width, height: bb.height }, others, threshold);
            const hasXSnap = guides.some((g) => g.axis === "x");
            const hasYSnap = guides.some((g) => g.axis === "y");
            const finalDx = hasXSnap ? dxRaw + edgeDx : snap(dxRaw, gridSize, snapEnabled);
            const finalDy = hasYSnap ? dyRaw + edgeDy : snap(dyRaw, gridSize, snapEnabled);
            if (finalDx !== 0 || finalDy !== 0) moveZoneBy(z.id, finalDx, finalDy);
          }
        };

        const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
          if (isSpaceDown() || !onSnapGuides) return;
          const node = e.target;
          const ppi = pixelsPerInch;
          // Current world bbox of the dragging zone
          let dragging: WorldBBox;
          if (!isPoly) {
            dragging = { x: node.x() / ppi, y: node.y() / ppi, width: z.width, height: z.height };
          } else {
            const bb = polygonBBox(z.points);
            dragging = { x: bb.x + node.x() / ppi, y: bb.y + node.y() / ppi, width: bb.width, height: bb.height };
          }
          // All other zones + all non-usable as comparison bboxes
          const others: WorldBBox[] = [];
          for (const other of zones) {
            if (other.id === z.id) continue;
            others.push(other.kind === "rect"
              ? { x: other.x, y: other.y, width: other.width, height: other.height }
              : polygonBBox(other.points));
          }
          for (const nu of nonUsable) {
            others.push(nu.kind === "rect"
              ? { x: nu.x, y: nu.y, width: nu.width, height: nu.height }
              : polygonBBox(nu.points));
          }
          const snapThreshold = Math.max(gridSize, 12);
          const { dx, dy, guides } = computeEdgeSnap(dragging, others, snapThreshold);
          if (dx !== 0) node.x(node.x() + dx * ppi);
          if (dy !== 0) node.y(node.y() + dy * ppi);
          onSnapGuides(guides);
        };

        const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
          const node = e.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          if (!isPoly) {
            const newX = node.x() / pixelsPerInch;
            const newY = node.y() / pixelsPerInch;
            const newW = Math.max(6, z.width * scaleX);
            const newH = Math.max(6, z.height * scaleY);
            node.scaleX(1);
            node.scaleY(1);
            updateZone(z.id, { x: newX, y: newY, width: newW, height: newH });
          } else {
            // Polygon: bake group translation + scale back into the absolute vertex coords.
            const tx = node.x() / pixelsPerInch;
            const ty = node.y() / pixelsPerInch;
            const newPoints = z.points.map((p) => ({
              x: tx + p.x * scaleX,
              y: ty + p.y * scaleY,
            }));
            node.scaleX(1);
            node.scaleY(1);
            node.x(0);
            node.y(0);
            updateZone(z.id, { points: newPoints });
          }
        };

        if (isPoly) {
          const flat = z.points.flatMap((p) => [p.x * pixelsPerInch, p.y * pixelsPerInch]);
          const bbox = polygonBBox(z.points);
          const centroid = polygonCentroid(z.points);
          const cx = centroid.x * pixelsPerInch;
          const cy = centroid.y * pixelsPerInch;
          const bboxPxW = bbox.width * pixelsPerInch;
          const bboxPxH = bbox.height * pixelsPerInch;
          const polySqft = polygonArea(z.points) / 144;
          const sqftFontSize = Math.max(12, Math.min(20, Math.min(bboxPxW, bboxPxH) * 0.12));
          return (
            <Group
              key={z.id}
              x={originX}
              y={originY}
              name={`zone-${z.id}`}
              draggable={isMoveTarget}
              onDragStart={(e) => {
                if (isSpaceDown()) e.target.stopDrag();
              }}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
              onClick={(e) => {
                e.cancelBubble = true;
                onSelect(z.id, e.evt.shiftKey);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onSelect(z.id, false);
              }}
            >
              <Line
                points={flat}
                closed
                fill={hexToRgba(z.color, 0.14)}
                stroke={selected ? "#1f6feb" : z.color}
                strokeWidth={selected ? 2 : 1.25}
                dash={selected ? undefined : [6, 4]}
              />
              {!hideLabels && (
                <ZoneLabel
                  name={z.name}
                  color={z.color}
                  cx={cx}
                  cy={cy}
                  bboxWidth={bboxPxW}
                  bboxHeight={bboxPxH}
                />
              )}
              {!hideLabels && (
                <Text
                  text={formatSqft(polySqft)}
                  fontSize={sqftFontSize}
                  fill={hexToRgba(z.color, 0.6)}
                  x={(bbox.x + bbox.width) * pixelsPerInch - 4}
                  y={(bbox.y + bbox.height) * pixelsPerInch - sqftFontSize - 2}
                  align="right"
                  width={Math.max(30, bboxPxW - 8)}
                  offsetX={Math.max(30, bboxPxW - 8)}
                  listening={false}
                />
              )}
              {isResizeTarget && (
                /* placeholder — actual handles come from <Transformer> attached in CanvasStage */
                null
              )}
            </Group>
          );
        }

        const w = z.width * pixelsPerInch;
        const h = z.height * pixelsPerInch;
        const rectSqft = sqftFromInches(z.width, z.height);
        const rectSqftFontSize = Math.max(12, Math.min(20, Math.min(w, h) * 0.12));
        return (
          <Group
            key={z.id}
            x={originX}
            y={originY}
            name={`zone-${z.id}`}
            draggable={isMoveTarget}
            onDragStart={(e) => {
              if (isSpaceDown()) e.target.stopDrag();
            }}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
            onClick={(e) => {
              e.cancelBubble = true;
              onSelect(z.id, e.evt.shiftKey);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onSelect(z.id, false);
            }}
          >
            <Rect
              width={w}
              height={h}
              fill={hexToRgba(z.color, 0.14)}
              stroke={selected ? "#1f6feb" : z.color}
              strokeWidth={selected ? 2 : 1}
              dash={selected ? undefined : [6, 4]}
            />
            {!hideLabels && (
              <ZoneLabel
                name={z.name}
                color={z.color}
                cx={w / 2}
                cy={h / 2}
                bboxWidth={w}
                bboxHeight={h}
              />
            )}
            {!hideLabels && (
              <Text
                text={formatSqft(rectSqft)}
                fontSize={rectSqftFontSize}
                fill={hexToRgba(z.color, 0.6)}
                x={w - 4}
                y={h - rectSqftFontSize - 2}
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

function ZoneLabel({
  name,
  color,
  cx,
  cy,
  bboxWidth,
  bboxHeight,
}: {
  name: string;
  color: string;
  cx: number;
  cy: number;
  bboxWidth: number;
  bboxHeight: number;
}) {
  const minDim = Math.min(bboxWidth, bboxHeight);
  const fontSize = Math.max(16, Math.min(40, minDim * 0.18));
  const padding = 8;
  const maxWidth = Math.max(20, bboxWidth - padding * 2);
  return (
    <Text
      x={cx - maxWidth / 2}
      y={cy - fontSize * 0.7}
      width={maxWidth}
      align="center"
      text={name.toUpperCase()}
      fontSize={fontSize}
      fontStyle="bold"
      letterSpacing={1.5}
      fill={hexToRgba(color, 0.7)}
      listening={false}
    />
  );
}
