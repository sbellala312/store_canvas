import { Group, Line } from "react-konva";
import type { Wall } from "../../types/model";

interface Props {
  walls: Wall[];
  pixelsPerInch: number;
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
}

export function WallsLayer({ walls, pixelsPerInch, selectedIds, onSelect }: Props) {
  return (
    <Group>
      {walls.map((w) => {
        const selected = selectedIds.includes(w.id);
        return (
          <Line
            key={w.id}
            points={[
              w.x1 * pixelsPerInch,
              w.y1 * pixelsPerInch,
              w.x2 * pixelsPerInch,
              w.y2 * pixelsPerInch,
            ]}
            stroke={selected ? "#1f6feb" : "#2d3742"}
            strokeWidth={Math.max(2, w.thickness * pixelsPerInch * 0.5)}
            lineCap="round"
            onClick={(e) => {
              e.cancelBubble = true;
              onSelect(w.id, e.evt.shiftKey);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onSelect(w.id, false);
            }}
          />
        );
      })}
    </Group>
  );
}
