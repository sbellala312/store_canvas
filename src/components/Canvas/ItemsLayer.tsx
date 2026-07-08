import { memo, useRef } from "react";
import { Group, Text, Rect, Circle, Line } from "react-konva";
import type Konva from "konva";
import type { FloorPlan, PlacedItem } from "../../types/model";
import { getCatalogItem } from "../../data/catalog";
import { PlacedItemNode } from "./PlacedItemNode";
import { usePlanStore } from "../../state/planStore";
import { fontCss } from "../../utils/labelFont";

interface Props {
  plan: FloorPlan;
  pixelsPerInch: number;
  selectionIds: string[];
  onSelect: (id: string, additive: boolean) => void;
}

// Draggable callout label for thin items (mirrors, wall art, etc.)
interface CalloutProps {
  itemId: string;
  labelText: string;
  fontFamily: string;
  calloutFontSize: number;
  boxW: number;
  boxH: number;
  itemCx: number;
  itemCy: number;
  boxX: number;
  boxY: number;
  defaultBoxX: number;
  defaultBoxY: number;
  opacity: number;
  onUpdate: (id: string, patch: Partial<PlacedItem>) => void;
}

function CalloutLabel({
  itemId, labelText, fontFamily, calloutFontSize, boxW, boxH,
  itemCx, itemCy, boxX, boxY, defaultBoxX, defaultBoxY,
  opacity, onUpdate,
}: CalloutProps) {
  const lineRef = useRef<Konva.Line>(null);

  return (
    <Group>
      <Line
        ref={lineRef}
        points={[itemCx, itemCy, boxX + boxW / 2, boxY + boxH / 2]}
        stroke="#8a96a3"
        strokeWidth={0.8}
        dash={[4, 2]}
        listening={false}
      />
      <Group
        x={boxX}
        y={boxY}
        draggable={true}
        onDragMove={(e) => {
          // Update line endpoint imperatively during drag for smooth real-time update
          lineRef.current?.points([
            itemCx, itemCy,
            e.target.x() + boxW / 2,
            e.target.y() + boxH / 2,
          ]);
        }}
        onDragEnd={(e) => {
          onUpdate(itemId, {
            labelCalloutOffset: {
              dx: e.target.x() - defaultBoxX,
              dy: e.target.y() - defaultBoxY,
            },
          });
        }}
        onMouseEnter={(e) => {
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "move";
        }}
        onMouseLeave={(e) => {
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "";
        }}
      >
        <Rect
          width={boxW}
          height={boxH}
          fill={`rgba(255,255,255,${opacity})`}
          stroke="#c4cdd6"
          strokeWidth={0.8}
          cornerRadius={3}
        />
        <Text
          x={3}
          y={4}
          text={labelText}
          fontSize={calloutFontSize}
          fontFamily={fontFamily}
          lineHeight={1.4}
          align="center"
          fill="#1a1f26"
          listening={false}
          width={boxW - 6}
          wrap="word"
        />
      </Group>
    </Group>
  );
}

// The ghost overlay is O(n²) in placed items; skip it on very dense plans so edits
// don't hitch. Items still render normally — only the faint occlusion hint is dropped.
// This is a hard performance ceiling; the feature is also user-toggleable (showGhostOverlay).
const GHOST_LIMIT = 250;

function tier(catalogId: string): number {
  const c = getCatalogItem(catalogId);
  if (!c) return 1;
  // 0 = rugs/mats (bottom), 1 = regular furniture (middle), 2 = accessories (top)
  if (c.subcategory === "Rugs") return 0;
  if (c.isAccessory) return 2;
  return 1;
}

export const ItemsLayer = memo(function ItemsLayer({ plan, pixelsPerInch, selectionIds, onSelect }: Props) {
  const updatePlacedItem = usePlanStore((s) => s.updatePlacedItem);
  const outlineOnly = usePlanStore((s) => s.furnitureOutline);
  const showGhostOverlay = usePlanStore((s) => s.showGhostOverlay);
  const labelFont = usePlanStore((s) => s.labelFont);
  const labelUppercase = usePlanStore((s) => s.labelUppercase);
  const labelFamily = fontCss(labelFont);
  const applyCase = (t: string) => (labelUppercase ? t.toUpperCase() : t);

  // z-order: rugs first (below), then furniture, then accessories on top.
  // None of these are parented; each item is independently selectable and movable.
  const sorted = [...plan.placedItems].sort((a, b) => tier(a.catalogId) - tier(b.catalogId));

  return (
    <Group>
      {/* Items (shapes + selection highlight) — z-ordered by tier */}
      {sorted.map((item) => {
        const cat = getCatalogItem(item.catalogId);
        if (!cat) return null;
        return (
          <PlacedItemNode
            key={item.id}
            item={item}
            catalog={cat}
            pixelsPerInch={pixelsPerInch}
            selected={selectionIds.includes(item.id)}
            showLabels={plan.showLabels}
            plan={plan}
            onSelect={onSelect}
          />
        );
      })}

      {/* Ghost overlay: faintly reveal the hidden portion of back items under front items */}
      <Group listening={false}>
        {showGhostOverlay && !outlineOnly && sorted.length <= GHOST_LIMIT && sorted.flatMap((frontItem, fi) => {
          const frontCat = getCatalogItem(frontItem.catalogId);
          if (!frontCat) return [];
          const fx = frontItem.x * pixelsPerInch;
          const fy = frontItem.y * pixelsPerInch;
          const fw = frontCat.width * pixelsPerInch;
          const fh = frontCat.depth * pixelsPerInch;

          // Front item AABB — exact for 0°/90°/180°/270°, safe overestimate for other angles.
          const frontRad = ((frontItem.rotation ?? 0) * Math.PI) / 180;
          const frontCx = fx + fw / 2;
          const frontCy = fy + fh / 2;
          const frontAabbW = Math.abs(fw * Math.cos(frontRad)) + Math.abs(fh * Math.sin(frontRad));
          const frontAabbH = Math.abs(fw * Math.sin(frontRad)) + Math.abs(fh * Math.cos(frontRad));
          const frontAabbX = frontCx - frontAabbW / 2;
          const frontAabbY = frontCy - frontAabbH / 2;

          return sorted.slice(0, fi).map((backItem) => {
            const backCat = getCatalogItem(backItem.catalogId);
            if (!backCat) return null;

            // Skip ghost for floor coverings (rugs/carpets).
            const isFloorCovering = /rug|carpet/i.test(
              (backCat.category ?? "") + " " + (backCat.subcategory ?? "")
            );
            if (isFloorCovering) return null;

            const bx = backItem.x * pixelsPerInch;
            const by = backItem.y * pixelsPerInch;
            const bw = backCat.width * pixelsPerInch;
            const bh = backCat.depth * pixelsPerInch;

            // Back item AABB — same AABB approach, exact for 90°-multiple rotations.
            const backRad = ((backItem.rotation ?? 0) * Math.PI) / 180;
            const backCx = bx + bw / 2;
            const backCy = by + bh / 2;
            const aabbW = Math.abs(bw * Math.cos(backRad)) + Math.abs(bh * Math.sin(backRad));
            const aabbH = Math.abs(bw * Math.sin(backRad)) + Math.abs(bh * Math.cos(backRad));
            const aabbX = backCx - aabbW / 2;
            const aabbY = backCy - aabbH / 2;

            // Intersection of the two AABBs.
            const ix = Math.max(frontAabbX, aabbX);
            const iy = Math.max(frontAabbY, aabbY);
            const iw = Math.min(frontAabbX + frontAabbW, aabbX + aabbW) - ix;
            const ih = Math.min(frontAabbY + frontAabbH, aabbY + aabbH) - iy;
            if (iw <= 0 || ih <= 0) return null;

            const bColor = backItem.color === "none" ? "transparent" : (backItem.color ?? backCat.defaultColor);

            return (
              <Group
                key={`ghost-${backItem.id}-${frontItem.id}`}
                clipX={ix} clipY={iy} clipWidth={iw} clipHeight={ih}
                listening={false}
              >
                <Group
                  x={(backItem.x + backCat.width / 2) * pixelsPerInch}
                  y={(backItem.y + backCat.depth / 2) * pixelsPerInch}
                  rotation={backItem.rotation}
                  offsetX={bw / 2}
                  offsetY={bh / 2}
                  opacity={0.35}
                >
                  {backCat.isAccessory && backCat.shape === "circle" ? (
                    <Circle
                      x={bw / 2} y={bh / 2}
                      radius={Math.min(bw, bh) / 2}
                      fill={bColor}
                      stroke="#3a4654" strokeWidth={1.5}
                    />
                  ) : (
                    <Rect
                      width={bw} height={bh}
                      fill={bColor}
                      stroke="#3a4654" strokeWidth={1.5}
                      cornerRadius={backCat.isAccessory ? 4 : 2}
                    />
                  )}
                </Group>
              </Group>
            );
          });
        })}
      </Group>

      {/* Regular labels — non-interactive, clipped inside each item */}
      {plan.showLabels && (
        <Group listening={false}>
          {sorted.map((item) => {
            const cat = getCatalogItem(item.catalogId);
            if (!cat) return null;
            const w = cat.width * pixelsPerInch;
            const h = cat.depth * pixelsPerInch;
            const minDim = Math.min(w, h);
            const maxDim = Math.max(w, h);

            if (maxDim < 20) return null;
            if (minDim < 28) return null; // thin items rendered as draggable callouts below

            // Scale font size with item size, clamped to a readable range
            const fontSize = Math.max(8, Math.min(11, minDim * 0.14));
            const lineH = fontSize * 1.4;
            const labelW = Math.max(0, w - 8);

            const labelText = applyCase(
              cat.seriesName ? `${cat.seriesName}\n${cat.name}` : cat.name
            );

            const effectiveFontSize = item.labelFontSize ?? fontSize;
            const effectiveLineH = effectiveFontSize * 1.4;
            const numLines = labelText.includes("\n") ? 2 : 1;
            const textH = effectiveLineH * numLines;

            const labelPos = item.labelPosition ?? "center";
            const labelRot = item.labelRotation ?? 0;
            const isVertical = labelRot === 90 || labelRot === -90;

            const halfW = labelW / 2;
            let textX = 4;
            let textY = Math.max(4, (h - textH) / 2);
            let align: "left" | "center" | "right" = "center";
            let textWidth = labelW;
            const bot = Math.max(4, h - textH - 4);

            switch (labelPos) {
              case "top":          textY = 4; break;
              case "bottom":       textY = bot; break;
              case "left":         textX = 4;             textWidth = halfW; align = "left"; break;
              case "right":        textX = w - halfW - 4; textWidth = halfW; align = "right"; break;
              case "top-left":     textY = 4;   textX = 4;             textWidth = halfW; align = "left"; break;
              case "top-right":    textY = 4;   textX = w - halfW - 4; textWidth = halfW; align = "right"; break;
              case "bottom-left":  textY = bot; textX = 4;             textWidth = halfW; align = "left"; break;
              case "bottom-right": textY = bot; textX = w - halfW - 4; textWidth = halfW; align = "right"; break;
            }

            const rotatedTextW = Math.max(0, h - 8);

            const rotPivotX =
              (labelPos === "right" || labelPos === "top-right" || labelPos === "bottom-right")
                ? w - 4 - textH / 2
                : (labelPos === "left" || labelPos === "top-left" || labelPos === "bottom-left")
                  ? 4 + textH / 2
                  : w / 2;
            const rotPivotY =
              (labelPos === "top" || labelPos === "top-left" || labelPos === "top-right")
                ? h / 4
                : (labelPos === "bottom" || labelPos === "bottom-left" || labelPos === "bottom-right")
                  ? 3 * h / 4
                  : h / 2;

            return (
              <Group
                key={`lbl-${item.id}`}
                x={(item.x + cat.width / 2) * pixelsPerInch}
                y={(item.y + cat.depth / 2) * pixelsPerInch}
                rotation={item.rotation}
                offsetX={w / 2}
                offsetY={h / 2}
                listening={false}
                clipX={0}
                clipY={0}
                clipWidth={w}
                clipHeight={h}
              >
                {labelRot !== 0 ? (
                  <Group key={`t-${labelPos}-${labelRot}`} x={rotPivotX} y={rotPivotY} rotation={labelRot}>
                    <Text
                      x={-rotatedTextW / 2}
                      y={-textH / 2}
                      text={labelText}
                      fontSize={effectiveFontSize}
                      fontFamily={labelFamily}
                      lineHeight={1.4}
                      align="center"
                      fill="#1a1f26"
                      listening={false}
                      width={rotatedTextW}
                      wrap="word"
                    />
                  </Group>
                ) : (
                  <Text
                    key={`t-${labelPos}`}
                    x={textX}
                    y={textY}
                    text={labelText}
                    fontSize={effectiveFontSize}
                    fontFamily={labelFamily}
                    lineHeight={1.4}
                    align={align}
                    fill="#1a1f26"
                    listening={false}
                    width={textWidth}
                    wrap="word"
                  />
                )}
              </Group>
            );
          })}
        </Group>
      )}

      {/* Callout labels for thin items (mirrors, wall art) — draggable annotation boxes */}
      {plan.showLabels && (
        <Group>
          {sorted.map((item) => {
            const cat = getCatalogItem(item.catalogId);
            if (!cat) return null;
            const w = cat.width * pixelsPerInch;
            const h = cat.depth * pixelsPerInch;
            const minDim = Math.min(w, h);
            const maxDim = Math.max(w, h);

            if (maxDim < 20 || minDim >= 28) return null;

            const calloutFontSize = item.labelFontSize ?? Math.max(8, Math.min(10, maxDim * 0.08));
            const calloutLineH = calloutFontSize * 1.4;
            const labelText = applyCase(
              cat.seriesName ? `${cat.seriesName}\n${cat.name}` : cat.name
            );
            const numLines = labelText.includes("\n") ? 2 : 1;
            const boxH = calloutLineH * numLines + 8;
            const boxW = 66;
            const pad = 6;

            const itemCx = (item.x + cat.width / 2) * pixelsPerInch;
            const itemCy = (item.y + cat.depth / 2) * pixelsPerInch;
            const itemRad = ((item.rotation ?? 0) * Math.PI) / 180;
            const aabbHalfW =
              (Math.abs(w * Math.cos(itemRad)) + Math.abs(h * Math.sin(itemRad))) / 2;

            const defaultBoxX = itemCx + aabbHalfW + pad;
            const defaultBoxY = itemCy - boxH / 2;
            const dx = item.labelCalloutOffset?.dx ?? 0;
            const dy = item.labelCalloutOffset?.dy ?? 0;

            return (
              <CalloutLabel
                key={`callout-${item.id}`}
                itemId={item.id}
                labelText={labelText}
                fontFamily={labelFamily}
                calloutFontSize={calloutFontSize}
                boxW={boxW}
                boxH={boxH}
                itemCx={itemCx}
                itemCy={itemCy}
                boxX={defaultBoxX + dx}
                boxY={defaultBoxY + dy}
                defaultBoxX={defaultBoxX}
                defaultBoxY={defaultBoxY}
                opacity={item.labelCalloutOpacity ?? 0.85}
                onUpdate={updatePlacedItem}
              />
            );
          })}
        </Group>
      )}
    </Group>
  );
});
