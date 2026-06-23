import { Group, Line, Rect } from "react-konva";
import type { FloorShape } from "../../types/model";

interface Props {
  floor: FloorShape;
  gridSize: number;
  pixelsPerInch: number;
  visible: boolean;
}

export function GridLayer({ floor, gridSize, pixelsPerInch, visible }: Props) {
  if (!visible) return null;
  const { width, height } =
    floor.kind === "rect" ? floor : floor.bbox;
  const lines: JSX.Element[] = [];
  const minor = gridSize;
  const major = gridSize * 12;

  for (let x = 0; x <= width; x += minor) {
    const isMajor = Math.abs(x % major) < 0.001;
    lines.push(
      <Line
        key={`vx-${x}`}
        points={[x * pixelsPerInch, 0, x * pixelsPerInch, height * pixelsPerInch]}
        stroke={isMajor ? "#c0cad4" : "#e6ecf2"}
        strokeWidth={isMajor ? 1 : 0.5}
        listening={false}
      />,
    );
  }
  for (let y = 0; y <= height; y += minor) {
    const isMajor = Math.abs(y % major) < 0.001;
    lines.push(
      <Line
        key={`hy-${y}`}
        points={[0, y * pixelsPerInch, width * pixelsPerInch, y * pixelsPerInch]}
        stroke={isMajor ? "#c0cad4" : "#e6ecf2"}
        strokeWidth={isMajor ? 1 : 0.5}
        listening={false}
      />,
    );
  }

  return (
    <Group listening={false}>
      <Rect
        x={0}
        y={0}
        width={width * pixelsPerInch}
        height={height * pixelsPerInch}
        fill="transparent"
      />
      {lines}
    </Group>
  );
}
