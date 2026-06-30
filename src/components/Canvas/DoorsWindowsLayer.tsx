import { Group, Line, Rect, Circle } from "react-konva";
import type Konva from "konva";
import type { Door, Window, Wall } from "../../types/model";

interface Props {
  doors: Door[];
  windows: Window[];
  walls: Wall[];
  pixelsPerInch: number;
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  toolIsSelect: boolean;
  onUpdateDoor: (id: string, patch: Partial<Omit<Door, "id">>) => void;
  onUpdateWindow: (id: string, patch: Partial<Omit<Window, "id">>) => void;
}

export function DoorsWindowsLayer({
  doors,
  windows,
  walls,
  pixelsPerInch,
  selectedIds,
  onSelect,
  toolIsSelect,
  onUpdateDoor,
  onUpdateWindow,
}: Props) {
  const wallMap = new Map(walls.map((w) => [w.id, w]));
  return (
    <Group>
      {doors.map((door) => (
        <DoorSymbol
          key={door.id}
          door={door}
          wall={door.wallId ? wallMap.get(door.wallId) : undefined}
          pixelsPerInch={pixelsPerInch}
          selected={selectedIds.includes(door.id)}
          onSelect={onSelect}
          toolIsSelect={toolIsSelect}
          onUpdate={onUpdateDoor}
        />
      ))}
      {windows.map((win) => (
        <WindowSymbol
          key={win.id}
          win={win}
          wall={win.wallId ? wallMap.get(win.wallId) : undefined}
          pixelsPerInch={pixelsPerInch}
          selected={selectedIds.includes(win.id)}
          onSelect={onSelect}
          toolIsSelect={toolIsSelect}
          onUpdate={onUpdateWindow}
        />
      ))}
    </Group>
  );
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

function buildErasePoints(
  cx: number, cy: number,
  cos_a: number, sin_a: number,
  cos_p: number, sin_p: number,
  halfLen: number, halfWidth: number,
): number[] {
  return [
    cx - cos_a * halfLen - cos_p * halfWidth, cy - sin_a * halfLen - sin_p * halfWidth,
    cx + cos_a * halfLen - cos_p * halfWidth, cy + sin_a * halfLen - sin_p * halfWidth,
    cx + cos_a * halfLen + cos_p * halfWidth, cy + sin_a * halfLen + sin_p * halfWidth,
    cx - cos_a * halfLen + cos_p * halfWidth, cy - sin_a * halfLen + sin_p * halfWidth,
  ];
}

function buildArcPoints(
  hx: number, hy: number,
  radius: number,
  startAngle: number,
  sweepAngle: number,
  segments = 18,
): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + sweepAngle * (i / segments);
    pts.push(hx + radius * Math.cos(a), hy + radius * Math.sin(a));
  }
  return pts;
}

function projectOntoWall(
  tentX: number, tentY: number,
  halfOpeningInches: number,
  wall: Wall | undefined,
): { x: number; y: number } {
  if (!wall) return { x: tentX, y: tentY };
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: tentX, y: tentY };
  const wallLen = Math.sqrt(len2);
  const tMin = Math.min(halfOpeningInches / wallLen, 0.5);
  const tMax = Math.max(1 - halfOpeningInches / wallLen, 0.5);
  const t = Math.max(tMin, Math.min(tMax,
    ((tentX - wall.x1) * dx + (tentY - wall.y1) * dy) / len2,
  ));
  return { x: wall.x1 + t * dx, y: wall.y1 + t * dy };
}

// ─── Door ────────────────────────────────────────────────────────────────────

interface DoorProps {
  door: Door;
  wall?: Wall;
  pixelsPerInch: number;
  selected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  toolIsSelect: boolean;
  onUpdate: (id: string, patch: Partial<Omit<Door, "id">>) => void;
}

function DoorSymbol({ door, wall, pixelsPerInch, selected, onSelect, toolIsSelect, onUpdate }: DoorProps) {
  const ppi = pixelsPerInch;

  // Pixel geometry
  const cx = door.x * ppi;
  const cy = door.y * ppi;
  const openW = door.width * ppi;   // total opening in pixels
  const hw = openW / 2;             // half opening in pixels

  const cos_a = Math.cos(door.angle);
  const sin_a = Math.sin(door.angle);
  const cos_p = -sin_a;
  const sin_p = cos_a;

  // Jamb centers
  const lx = cx - cos_a * hw;
  const ly = cy - sin_a * hw;
  const rx = cx + cos_a * hw;
  const ry = cy + sin_a * hw;

  const wallThickPx = (wall?.thickness ?? 6) * ppi;
  const jambH = wallThickPx / 2 + 2;

  const erasePoints = buildErasePoints(cx, cy, cos_a, sin_a, cos_p, sin_p, hw + ppi, jambH + ppi * 0.5);

  const stroke = selected ? "#1f6feb" : "#2d3742";
  const strokeW = selected ? 2 : 1.5;

  // Build arc + leaf data based on kind
  const isDouble = door.kind === "double";
  type ArcData = { pts: number[]; leaf: number[] };
  let arcs: ArcData[] = [];

  if (!isDouble) {
    // Single door: one hinge, full-opening arc
    const isRight = door.swing === "right";
    const hx = isRight ? lx : rx;
    const hy = isRight ? ly : ry;
    const startAngle = isRight ? door.angle : door.angle + Math.PI;
    const leafEndAngle = startAngle + Math.PI / 2;
    arcs = [{
      pts: buildArcPoints(hx, hy, openW, startAngle, Math.PI / 2),
      leaf: [hx, hy, hx + openW * Math.cos(leafEndAngle), hy + openW * Math.sin(leafEndAngle)],
    }];
  } else {
    // Double door: two half-arcs from each jamb, meeting at center
    const sweepLeft = door.swing === "right" ? Math.PI / 2 : -Math.PI / 2;
    const sweepRight = -sweepLeft;
    const leafEndL = door.angle + sweepLeft;
    const leafEndR = door.angle + Math.PI + sweepRight;
    arcs = [
      {
        pts: buildArcPoints(lx, ly, hw, door.angle, sweepLeft),
        leaf: [lx, ly, lx + hw * Math.cos(leafEndL), ly + hw * Math.sin(leafEndL)],
      },
      {
        pts: buildArcPoints(rx, ry, hw, door.angle + Math.PI, sweepRight),
        leaf: [rx, ry, rx + hw * Math.cos(leafEndR), ry + hw * Math.sin(leafEndR)],
      },
    ];
  }

  // ── Body drag (move along wall) ──────────────────────────────────────────
  const handleBodyDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const node = e.target as Konva.Group;
    const tentX = door.x + node.x() / ppi;
    const tentY = door.y + node.y() / ppi;
    const proj = projectOntoWall(tentX, tentY, door.width / 2, wall);
    onUpdate(door.id, { x: proj.x, y: proj.y });
    node.position({ x: 0, y: 0 });
  };

  // ── Resize handles ───────────────────────────────────────────────────────
  const handleResizeLeft = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const node = e.target as Konva.Node;
    const hW = node.x() / ppi;
    const hH = node.y() / ppi;
    // Projection along wall axis from door center (negative = left side)
    const proj = (hW - door.x) * cos_a + (hH - door.y) * sin_a;
    const newHalfW = Math.max(6, -proj);
    const newWidth = newHalfW * 2;
    onUpdate(door.id, { width: newWidth });
    const newHwPx = newHalfW * ppi;
    node.position({ x: cx - cos_a * newHwPx, y: cy - sin_a * newHwPx });
  };

  const handleResizeRight = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const node = e.target as Konva.Node;
    const hW = node.x() / ppi;
    const hH = node.y() / ppi;
    const proj = (hW - door.x) * cos_a + (hH - door.y) * sin_a;
    const newHalfW = Math.max(6, proj);
    const newWidth = newHalfW * 2;
    onUpdate(door.id, { width: newWidth });
    const newHwPx = newHalfW * ppi;
    node.position({ x: cx + cos_a * newHwPx, y: cy + sin_a * newHwPx });
  };

  const canInteract = toolIsSelect;

  return (
    <Group>
      {/* ── Body (draggable: moves door along wall) ── */}
      <Group
        draggable={selected && canInteract}
        onDragStart={(e) => { e.cancelBubble = true; }}
        onDragEnd={selected && canInteract ? handleBodyDragEnd : undefined}
        onMouseDown={(e) => { if (selected && canInteract) e.cancelBubble = true; }}
      >
        {/* White gap over wall */}
        <Line points={erasePoints} closed fill="white" stroke="white" strokeWidth={1} listening={false} />
        {/* Left jamb */}
        <Line
          points={[lx - cos_p * jambH, ly - sin_p * jambH, lx + cos_p * jambH, ly + sin_p * jambH]}
          stroke={stroke} strokeWidth={strokeW} listening={false}
        />
        {/* Right jamb */}
        <Line
          points={[rx - cos_p * jambH, ry - sin_p * jambH, rx + cos_p * jambH, ry + sin_p * jambH]}
          stroke={stroke} strokeWidth={strokeW} listening={false}
        />
        {/* Door leaf(ves) + arc(s) */}
        {arcs.map((arc, i) => (
          <Group key={i} listening={false}>
            <Line points={arc.leaf} stroke={stroke} strokeWidth={strokeW} />
            <Line points={arc.pts} stroke={stroke} strokeWidth={selected ? 1.5 : 1} dash={[5, 3]} />
          </Group>
        ))}
        {/* Center dot (drag handle indicator) */}
        {selected && (
          <Circle x={cx} y={cy} radius={4} fill="#1f6feb" stroke="white" strokeWidth={1.5} listening={false} />
        )}
        {/* Hit area — rotated to match wall angle so it covers the actual door symbol */}
        <Group x={cx} y={cy} rotation={door.angle * 180 / Math.PI}>
          <Rect
            x={-hw} y={-Math.max(jambH, 14)}
            width={openW} height={Math.max(jambH * 2, 28)}
            fill="rgba(0,0,0,0)"
            onClick={canInteract ? (e: Konva.KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              onSelect(door.id, e.evt.shiftKey);
            } : undefined}
            onTap={canInteract ? (e: Konva.KonvaEventObject<TouchEvent>) => {
              e.cancelBubble = true;
              onSelect(door.id, false);
            } : undefined}
          />
        </Group>
      </Group>

      {/* ── Width resize handles (green squares at jamb positions) ── */}
      {selected && canInteract && (
        <>
          <Circle
            x={lx} y={ly} radius={6}
            fill="#22c55e" stroke="white" strokeWidth={1.5}
            draggable
            onDragStart={(e) => { e.cancelBubble = true; }}
            onDragEnd={handleResizeLeft}
          />
          <Circle
            x={rx} y={ry} radius={6}
            fill="#22c55e" stroke="white" strokeWidth={1.5}
            draggable
            onDragStart={(e) => { e.cancelBubble = true; }}
            onDragEnd={handleResizeRight}
          />
        </>
      )}
    </Group>
  );
}

// ─── Window ──────────────────────────────────────────────────────────────────

interface WindowProps {
  win: Window;
  wall?: Wall;
  pixelsPerInch: number;
  selected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  toolIsSelect: boolean;
  onUpdate: (id: string, patch: Partial<Omit<Window, "id">>) => void;
}

function WindowSymbol({ win, wall, pixelsPerInch, selected, onSelect, toolIsSelect, onUpdate }: WindowProps) {
  const ppi = pixelsPerInch;

  const cx = win.x * ppi;
  const cy = win.y * ppi;
  const openW = win.width * ppi;
  const hw = openW / 2;

  const cos_a = Math.cos(win.angle);
  const sin_a = Math.sin(win.angle);
  const cos_p = -sin_a;
  const sin_p = cos_a;

  const lx = cx - cos_a * hw;
  const ly = cy - sin_a * hw;
  const rx = cx + cos_a * hw;
  const ry = cy + sin_a * hw;

  const wallThickPx = (wall?.thickness ?? 6) * ppi;
  const jambH = wallThickPx / 2 + 2;
  const glazeOff = jambH * 0.45;

  const erasePoints = buildErasePoints(cx, cy, cos_a, sin_a, cos_p, sin_p, hw + ppi, jambH + ppi * 0.5);

  const stroke = selected ? "#1f6feb" : "#2d3742";
  const strokeW = selected ? 2 : 1.5;

  // ── Body drag ────────────────────────────────────────────────────────────
  const handleBodyDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const node = e.target as Konva.Group;
    const tentX = win.x + node.x() / ppi;
    const tentY = win.y + node.y() / ppi;
    const proj = projectOntoWall(tentX, tentY, win.width / 2, wall);
    onUpdate(win.id, { x: proj.x, y: proj.y });
    node.position({ x: 0, y: 0 });
  };

  // ── Resize handles ───────────────────────────────────────────────────────
  const handleResizeLeft = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const node = e.target as Konva.Node;
    const hW = node.x() / ppi;
    const hH = node.y() / ppi;
    const proj = (hW - win.x) * cos_a + (hH - win.y) * sin_a;
    const newHalfW = Math.max(6, -proj);
    onUpdate(win.id, { width: newHalfW * 2 });
    const newHwPx = newHalfW * ppi;
    node.position({ x: cx - cos_a * newHwPx, y: cy - sin_a * newHwPx });
  };

  const handleResizeRight = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const node = e.target as Konva.Node;
    const hW = node.x() / ppi;
    const hH = node.y() / ppi;
    const proj = (hW - win.x) * cos_a + (hH - win.y) * sin_a;
    const newHalfW = Math.max(6, proj);
    onUpdate(win.id, { width: newHalfW * 2 });
    const newHwPx = newHalfW * ppi;
    node.position({ x: cx + cos_a * newHwPx, y: cy + sin_a * newHwPx });
  };

  const canInteract = toolIsSelect;

  return (
    <Group>
      {/* ── Body ── */}
      <Group
        draggable={selected && canInteract}
        onDragStart={(e) => { e.cancelBubble = true; }}
        onDragEnd={selected && canInteract ? handleBodyDragEnd : undefined}
        onMouseDown={(e) => { if (selected && canInteract) e.cancelBubble = true; }}
      >
        {/* White gap */}
        <Line points={erasePoints} closed fill="white" stroke="white" strokeWidth={1} listening={false} />
        {/* Left jamb */}
        <Line
          points={[lx - cos_p * jambH, ly - sin_p * jambH, lx + cos_p * jambH, ly + sin_p * jambH]}
          stroke={stroke} strokeWidth={strokeW} listening={false}
        />
        {/* Right jamb */}
        <Line
          points={[rx - cos_p * jambH, ry - sin_p * jambH, rx + cos_p * jambH, ry + sin_p * jambH]}
          stroke={stroke} strokeWidth={strokeW} listening={false}
        />
        {/* Glazing line 1 */}
        <Line
          points={[lx + cos_p * glazeOff, ly + sin_p * glazeOff, rx + cos_p * glazeOff, ry + sin_p * glazeOff]}
          stroke={stroke} strokeWidth={strokeW} listening={false}
        />
        {/* Glazing line 2 */}
        <Line
          points={[lx - cos_p * glazeOff, ly - sin_p * glazeOff, rx - cos_p * glazeOff, ry - sin_p * glazeOff]}
          stroke={stroke} strokeWidth={strokeW} listening={false}
        />
        {/* Center dot */}
        {selected && (
          <Circle x={cx} y={cy} radius={4} fill="#1f6feb" stroke="white" strokeWidth={1.5} listening={false} />
        )}
        {/* Hit area — rotated to match wall angle */}
        <Group x={cx} y={cy} rotation={win.angle * 180 / Math.PI}>
          <Rect
            x={-hw} y={-Math.max(jambH, 14)}
            width={openW} height={Math.max(jambH * 2, 28)}
            fill="rgba(0,0,0,0)"
            onClick={canInteract ? (e: Konva.KonvaEventObject<MouseEvent>) => {
              e.cancelBubble = true;
              onSelect(win.id, e.evt.shiftKey);
            } : undefined}
            onTap={canInteract ? (e: Konva.KonvaEventObject<TouchEvent>) => {
              e.cancelBubble = true;
              onSelect(win.id, false);
            } : undefined}
          />
        </Group>
      </Group>

      {/* ── Width resize handles ── */}
      {selected && canInteract && (
        <>
          <Circle
            x={lx} y={ly} radius={6}
            fill="#22c55e" stroke="white" strokeWidth={1.5}
            draggable
            onDragStart={(e) => { e.cancelBubble = true; }}
            onDragEnd={handleResizeLeft}
          />
          <Circle
            x={rx} y={ry} radius={6}
            fill="#22c55e" stroke="white" strokeWidth={1.5}
            draggable
            onDragStart={(e) => { e.cancelBubble = true; }}
            onDragEnd={handleResizeRight}
          />
        </>
      )}
    </Group>
  );
}
