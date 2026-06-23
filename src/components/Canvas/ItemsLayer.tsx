import { Group, Text } from "react-konva";
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

      {/* Labels on top of everything — never occluded by overlapping items */}
      {plan.showLabels && (
        <Group listening={false}>
          {sorted.map((item) => {
            const cat = getCatalogItem(item.catalogId);
            if (!cat || cat.isAccessory) return null;
            const w = cat.width * pixelsPerInch;
            const h = cat.depth * pixelsPerInch;
            const labelW = Math.max(0, w - 8);
            const fontSize = 11;
            return (
              <Group
                key={`lbl-${item.id}`}
                x={(item.x + cat.width / 2) * pixelsPerInch}
                y={(item.y + cat.depth / 2) * pixelsPerInch}
                rotation={item.rotation}
                offsetX={w / 2}
                offsetY={h / 2}
                listening={false}
              >
                <Text
                  x={4}
                  y={4}
                  text={cat.name}
                  fontSize={fontSize}
                  fill="#1a1f26"
                  listening={false}
                  width={labelW}
                />
              </Group>
            );
          })}
        </Group>
      )}
    </Group>
  );
}
