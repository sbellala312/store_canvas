import { Group, Rect, Circle, Text } from "react-konva";
import type Konva from "konva";
import type { PlacedItem, CatalogItem, FloorPlan } from "../../types/model";
import { snap } from "../../utils/geometry";
import { usePlanStore } from "../../state/planStore";
import { isSpaceDown } from "../../utils/panMode";

interface Props {
  item: PlacedItem;
  catalog: CatalogItem;
  pixelsPerInch: number;
  selected: boolean;
  showLabels: boolean;
  plan: FloorPlan;
  onSelect: (id: string, additive: boolean) => void;
}

export function PlacedItemNode({
  item,
  catalog,
  pixelsPerInch,
  selected,
  showLabels,
  plan,
  onSelect,
}: Props) {
  const updatePlacedItem = usePlanStore((s) => s.updatePlacedItem);

  const w = catalog.width * pixelsPerInch;
  const h = catalog.depth * pixelsPerInch;
  const color = item.color ?? catalog.defaultColor;
  const isAccessory = catalog.isAccessory;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Group origin is the item center (offset = center). Convert back to top-left.
    const centerX = e.target.x() / pixelsPerInch;
    const centerY = e.target.y() / pixelsPerInch;
    let tlX = centerX - catalog.width / 2;
    let tlY = centerY - catalog.depth / 2;
    tlX = snap(tlX, plan.gridSize, plan.snapEnabled);
    tlY = snap(tlY, plan.gridSize, plan.snapEnabled);
    // Reset Konva node to match the snapped position (center again)
    e.target.x((tlX + catalog.width / 2) * pixelsPerInch);
    e.target.y((tlY + catalog.depth / 2) * pixelsPerInch);
    updatePlacedItem(item.id, { x: tlX, y: tlY });
  };

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const newRotation = ((node.rotation() % 360) + 360) % 360;
    // Reset Konva's local scale — we don't resize, only rotate
    node.scaleX(1);
    node.scaleY(1);
    updatePlacedItem(item.id, { rotation: newRotation });
  };

  return (
    <Group
      x={(item.x + catalog.width / 2) * pixelsPerInch}
      y={(item.y + catalog.depth / 2) * pixelsPerInch}
      rotation={item.rotation}
      offsetX={(catalog.width * pixelsPerInch) / 2}
      offsetY={(catalog.depth * pixelsPerInch) / 2}
      name={`item-${item.id}`}
      draggable={true}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(item.id, e.evt.shiftKey);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(item.id, false);
      }}
      onDragStart={(e) => {
        if (isSpaceDown()) {
          e.target.stopDrag();
        }
      }}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {isAccessory && catalog.shape === "circle" ? (
        <Circle
          x={w / 2}
          y={h / 2}
          radius={Math.min(w, h) / 2}
          fill={color}
          stroke={selected ? "#1f6feb" : "#3a4654"}
          strokeWidth={selected ? 2 : 1}
          shadowBlur={selected ? 6 : 0}
          shadowColor="#1f6feb"
        />
      ) : (
        <Rect
          width={w}
          height={h}
          fill={color}
          stroke={selected ? "#1f6feb" : "#3a4654"}
          strokeWidth={selected ? 2 : 1}
          cornerRadius={isAccessory ? 4 : 2}
          shadowBlur={selected ? 6 : 0}
          shadowColor="#1f6feb"
        />
      )}
      {/* Labels rendered in a separate top-level group in ItemsLayer so they
          are never occluded by items stacked above this one. */}
    </Group>
  );
}
