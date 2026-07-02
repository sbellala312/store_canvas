import { Group, Text, Rect, Circle } from "react-konva";
import type { FloorPlan } from "../../types/model";
import { getCatalogItem } from "../../data/catalog";
import { PlacedItemNode } from "./PlacedItemNode";

interface Props {
  plan: FloorPlan;
  pixelsPerInch: number;
  selectionIds: string[];
  onSelect: (id: string, additive: boolean) => void;
}

function tier(catalogId: string): number {
  const c = getCatalogItem(catalogId);
  if (!c) return 1;
  // 0 = rugs/mats (bottom), 1 = regular furniture (middle), 2 = accessories (top)
  if (c.subcategory === "Rugs") return 0;
  if (c.isAccessory) return 2;
  return 1;
}

export function ItemsLayer({ plan, pixelsPerInch, selectionIds, onSelect }: Props) {
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
        {sorted.flatMap((frontItem, fi) => {
          const frontCat = getCatalogItem(frontItem.catalogId);
          if (!frontCat) return [];
          const fx = frontItem.x * pixelsPerInch;
          const fy = frontItem.y * pixelsPerInch;
          const fw = frontCat.width * pixelsPerInch;
          const fh = frontCat.depth * pixelsPerInch;

          return sorted.slice(0, fi).map((backItem) => {
            const backCat = getCatalogItem(backItem.catalogId);
            if (!backCat) return null;
            const bx = backItem.x * pixelsPerInch;
            const by = backItem.y * pixelsPerInch;
            const bw = backCat.width * pixelsPerInch;
            const bh = backCat.depth * pixelsPerInch;

            // Intersection of the two unrotated bounding boxes
            const ix = Math.max(fx, bx);
            const iy = Math.max(fy, by);
            const iw = Math.min(fx + fw, bx + bw) - ix;
            const ih = Math.min(fy + fh, by + bh) - iy;
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

      {/* Labels on top of everything — never occluded by overlapping items */}
      {plan.showLabels && (
        <Group listening={false}>
          {sorted.map((item) => {
            const cat = getCatalogItem(item.catalogId);
            if (!cat || cat.isAccessory) return null;
            const w = cat.width * pixelsPerInch;
            const h = cat.depth * pixelsPerInch;
            const minDim = Math.min(w, h);

            // Hide label entirely when the item is too small to be readable
            if (minDim < 28) return null;

            // Scale font size with item size, clamped to a readable range
            const fontSize = Math.max(8, Math.min(11, minDim * 0.14));
            const lineH = fontSize * 1.4;
            const labelW = Math.max(0, w - 8);

            // Only show series name when there is vertical room for two lines
            const twoLineHeight = lineH * 2 + 8;
            const labelText =
              cat.seriesName && h >= twoLineHeight
                ? `${cat.seriesName}\n${cat.name}`
                : cat.name;

            // Use custom font size if the user has set one, otherwise auto
            const effectiveFontSize = item.labelFontSize ?? fontSize;
            const effectiveLineH = effectiveFontSize * 1.4;
            const numLines = labelText.includes("\n") ? 2 : 1;
            const textH = effectiveLineH * numLines;

            const labelPos = item.labelPosition ?? "center";

            // All positions stay inside the item — clipped to item bounds.
            let textX = 4;
            let textY = Math.max(4, (h - textH) / 2);
            let align: "left" | "center" | "right" = "center";
            const bot = Math.max(4, h - textH - 4);

            switch (labelPos) {
              case "top":          textY = 4; break;
              case "bottom":       textY = bot; break;
              case "left":         align = "left"; break;
              case "right":        align = "right"; break;
              case "top-left":     textY = 4; align = "left"; break;
              case "top-right":    textY = 4; align = "right"; break;
              case "bottom-left":  textY = bot; align = "left"; break;
              case "bottom-right": textY = bot; align = "right"; break;
              // center: defaults are already correct
            }

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
                <Text
                  x={textX}
                  y={textY}
                  text={labelText}
                  fontSize={effectiveFontSize}
                  lineHeight={1.4}
                  align={align}
                  fill="#1a1f26"
                  listening={false}
                  width={labelW}
                  wrap="word"
                />
              </Group>
            );
          })}
        </Group>
      )}
    </Group>
  );
}
