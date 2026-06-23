import { Group, Line, Rect } from "react-konva";
import type { FloorShape } from "../../types/model";

interface Props {
  floor: FloorShape;
  pixelsPerInch: number;
}

export function FloorLayer({ floor, pixelsPerInch }: Props) {
  if (floor.kind === "rect") {
    return (
      <Rect
        x={0}
        y={0}
        width={floor.width * pixelsPerInch}
        height={floor.height * pixelsPerInch}
        fill="#fafbfc"
        stroke="#2d3742"
        strokeWidth={2}
        listening={false}
      />
    );
  }
  const pts = floor.points.flatMap((p) => [p.x * pixelsPerInch, p.y * pixelsPerInch]);
  return (
    <Group listening={false}>
      <Line points={pts} closed fill="#fafbfc" stroke="#2d3742" strokeWidth={2} />
    </Group>
  );
}
