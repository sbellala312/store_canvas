import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Text, Group, Circle, Transformer, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { Point } from "../../types/model";
import { usePlanStore } from "../../state/planStore";
import { getCatalogItem } from "../../data/catalog";
import { getActiveDrag, clearActiveDrag } from "../../state/dragContext";
import { FloorLayer } from "./FloorLayer";
import { GridLayer } from "./GridLayer";
import { ZonesLayer } from "./ZonesLayer";
import { NonUsableLayer } from "./NonUsableLayer";
import { WallsLayer } from "./WallsLayer";
import { DoorsWindowsLayer } from "./DoorsWindowsLayer";
import { ItemsLayer } from "./ItemsLayer";
import { LabelsOverlay } from "./LabelsOverlay";
import { CanvasRuler } from "./CanvasRuler";
import { ScaleBar } from "./ScaleBar";
import { snapPoint, distance, polygonArea, pointInPolygon, pointInRect, floorBBox } from "../../utils/geometry";
import type { SnapGuide } from "../../utils/geometry";
import { feetInches, sqftFromInches, formatSqft } from "../../utils/units";
import { registerStage } from "../../utils/stageRef";
import { setSpaceDown } from "../../utils/panMode";
import { useRefImageStore } from "../../state/refImageStore";

interface Props {
  width: number;
  height: number;
}

interface DraftRectState {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface DraftLineState {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface MeasureState {
  a: { x: number; y: number };
  b: { x: number; y: number } | null;
}

export function CanvasStage({ width, height }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const zoneTransformerRef = useRef<Konva.Transformer>(null);
  const nonUsableTransformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [hoverWorld, setHoverWorld] = useState<{ x: number; y: number } | null>(null);

  const plan = usePlanStore((s) => s.getActivePlan());
  const pixelsPerInch = usePlanStore((s) => s.pixelsPerInch);
  const zoom = usePlanStore((s) => s.zoom);
  const pan = usePlanStore((s) => s.pan);
  const tool = usePlanStore((s) => s.tool);
  const selectionIds = usePlanStore((s) => s.selectionIds);
  const zoneEditMode = usePlanStore((s) => s.zoneEditMode);
  const nonUsableEditMode = usePlanStore((s) => s.nonUsableEditMode);
  const setSelection = usePlanStore((s) => s.setSelection);
  const addToSelection = usePlanStore((s) => s.addToSelection);
  const clearSelection = usePlanStore((s) => s.clearSelection);
  const setZoom = usePlanStore((s) => s.setZoom);
  const setPan = usePlanStore((s) => s.setPan);
  const addPlacedItem = usePlanStore((s) => s.addPlacedItem);
  const addZone = usePlanStore((s) => s.addZone);
  const addNonUsable = usePlanStore((s) => s.addNonUsable);
  const addWall = usePlanStore((s) => s.addWall);
  const addDoor = usePlanStore((s) => s.addDoor);
  const updateDoor = usePlanStore((s) => s.updateDoor);
  const addWindow = usePlanStore((s) => s.addWindow);
  const updateWindow = usePlanStore((s) => s.updateWindow);
  const stampKit = usePlanStore((s) => s.stampKit);
  const setTool = usePlanStore((s) => s.setTool);
  const showRuler = usePlanStore((s) => s.showRuler);
  const scaleRatio = usePlanStore((s) => s.scaleRatio);

  const [draftRect, setDraftRect] = useState<DraftRectState | null>(null);
  const [draftLine, setDraftLine] = useState<DraftLineState | null>(null);
  const [measure, setMeasure] = useState<MeasureState | null>(null);
  const [marquee, setMarquee] = useState<DraftRectState | null>(null);
  const [draftPolygon, setDraftPolygon] = useState<Point[] | null>(null);
  const [isPanningState, setIsPanningState] = useState(false);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [wallEndpointSnap, setWallEndpointSnap] = useState<{ x: number; y: number } | null>(null);
  const [wallProjectionSnap, setWallProjectionSnap] = useState<{ x: number; y: number; angle: number; wallId: string } | null>(null);
  const isPanning = useRef(false);
  const spaceDown = useRef(false);
  const altDown = useRef(false);
  const shiftDown = useRef(false);

  const refImages = useRefImageStore((s) => s.refImages);
  const refImage = plan ? (refImages[plan.id] ?? null) : null;
  const [refHtmlImage, setRefHtmlImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!refImage?.dataUrl) { setRefHtmlImage(null); return; }
    const img = new window.Image();
    img.src = refImage.dataUrl;
    img.onload = () => setRefHtmlImage(img);
  }, [refImage?.dataUrl]);

  useEffect(() => {
    registerStage(stageRef.current);
    return () => registerStage(null);
  }, []);

  // Attach Konva Transformer to selected placed items so they get rotation handles.
  // We only attach to placed items (not zones / walls / non-usable regions).
  useEffect(() => {
    const tr = transformerRef.current;
    const layer = layerRef.current;
    if (!tr || !layer || !plan) return;
    const placedIdSet = new Set(plan.placedItems.map((i) => i.id));
    const nodes = selectionIds
      .filter((id) => placedIdSet.has(id))
      .map((id) => layer.findOne(`.item-${id}`))
      .filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectionIds, plan]);

  // Attach a separate Transformer to a selected zone when in Resize mode.
  useEffect(() => {
    const tr = zoneTransformerRef.current;
    const layer = layerRef.current;
    if (!tr || !layer || !plan) return;
    if (zoneEditMode !== "resize") {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const zoneIdSet = new Set(plan.zones.map((z) => z.id));
    const nodes = selectionIds
      .filter((id) => zoneIdSet.has(id))
      .map((id) => layer.findOne(`.zone-${id}`))
      .filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectionIds, zoneEditMode, plan]);

  // Attach a Transformer to a selected non-usable region when in Resize mode.
  useEffect(() => {
    const tr = nonUsableTransformerRef.current;
    const layer = layerRef.current;
    if (!tr || !layer || !plan) return;
    if (nonUsableEditMode !== "resize") {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const nuIdSet = new Set(plan.nonUsable.map((n) => n.id));
    const nodes = selectionIds
      .filter((id) => nuIdSet.has(id))
      .map((id) => layer.findOne(`.nonusable-${id}`))
      .filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectionIds, nonUsableEditMode, plan]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "AltLeft" || e.code === "AltRight") {
        altDown.current = true;
        e.preventDefault(); // prevent browser Alt-focus behavior
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        shiftDown.current = true;
      }
      if (e.code === "Space") {
        spaceDown.current = true;
        setSpaceDown(true);
      }
      if (e.code === "Escape") {
        setDraftPolygon(null);
        setDraftLine(null);
        setDraftRect(null);
      }
      if (e.code === "Enter" && draftPolygon && draftPolygon.length >= 3 &&
          (tool === "zonePolygon" || tool === "nonUsablePolygon")) {
        commitPolygon(draftPolygon);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "AltLeft" || e.code === "AltRight") {
        altDown.current = false;
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        shiftDown.current = false;
      }
      if (e.code === "Space") {
        spaceDown.current = false;
        setSpaceDown(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [draftPolygon]);

  useEffect(() => {
    // Reset in-flight drafts when switching tools
    setDraftPolygon(null);
    setDraftLine(null);
    setDraftRect(null);
    setMeasure(null);
    setWallEndpointSnap(null);
    setWallProjectionSnap(null);
  }, [tool]);

  // Constrain a point to the nearest 45° angle from a start point (0°/45°/90°/135°/…).
  function constrainToAngle(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): { x: number; y: number } {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return end;
    const angle = Math.atan2(dy, dx);
    const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    return {
      x: start.x + dist * Math.cos(snappedAngle),
      y: start.y + dist * Math.sin(snappedAngle),
    };
  }

  // Returns the nearest wall endpoint within snapThresholdInches, or null.
  function findWallEndpointSnap(wp: { x: number; y: number }, thresholdInches: number) {
    if (!plan) return null;
    let best: { x: number; y: number } | null = null;
    let bestDist = thresholdInches;
    for (const w of plan.walls) {
      for (const ep of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
        const d = distance(wp, ep);
        if (d < bestDist) {
          bestDist = d;
          best = ep;
        }
      }
    }
    return best;
  }

  // Returns the nearest projection onto any wall within thresholdInches, or null.
  function findNearestWallProjection(wp: { x: number; y: number }, thresholdInches: number) {
    if (!plan) return null;
    let best: { x: number; y: number; angle: number; wallId: string } | null = null;
    let bestDist = thresholdInches;
    for (const w of plan.walls) {
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1) continue;
      const t = Math.max(0, Math.min(1, ((wp.x - w.x1) * dx + (wp.y - w.y1) * dy) / len2));
      const px = w.x1 + t * dx;
      const py = w.y1 + t * dy;
      const d = Math.sqrt((wp.x - px) ** 2 + (wp.y - py) ** 2);
      if (d < bestDist) {
        bestDist = d;
        best = { x: px, y: py, angle: Math.atan2(dy, dx), wallId: w.id };
      }
    }
    return best;
  }

  function commitPolygon(pts: Point[]) {
    if (pts.length < 3 || !plan) {
      setDraftPolygon(null);
      return;
    }
    if (tool === "nonUsablePolygon") {
      addNonUsable({ kind: "polygon", points: pts });
    } else {
      const palette = [
        "#F44336", "#FF9800", "#F9A825", "#8BC34A", "#4CAF50",
        "#009688", "#00BCD4", "#2196F3", "#3F51B5", "#9C27B0",
      ];
      const color = palette[plan.zones.length % palette.length];
      const name = `Zone ${plan.zones.length + 1}`;
      addZone({ kind: "polygon", name, color, points: pts });
    }
    setDraftPolygon(null);
  }

  if (!plan) {
    return (
      <div style={{ padding: 24, color: "#6b7785" }}>
        No active plan. Create or open one from the Plans menu.
      </div>
    );
  }

  const floorWidth =
    plan.floor.kind === "rect" ? plan.floor.width : plan.floor.bbox.width;
  const floorHeight =
    plan.floor.kind === "rect" ? plan.floor.height : plan.floor.bbox.height;

  function getWorldPoint(): { x: number; y: number } | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const t = stage.getAbsoluteTransform().copy().invert();
    const wp = t.point(pos);
    return { x: wp.x / pixelsPerInch, y: wp.y / pixelsPerInch };
  }

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = zoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.1;
    const newScale = direction > 0 ? oldScale * factor : oldScale / factor;
    const clamped = Math.max(0.1, Math.min(5, newScale));
    const mousePointTo = {
      x: (pointer.x - pan.x) / oldScale,
      y: (pointer.y - pan.y) / oldScale,
    };
    const newPan = {
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    };
    setZoom(clamped);
    setPan(newPan);
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.attrs?.name === "floor-bg";
    const wp = getWorldPoint();
    if (!wp) return;

    if (spaceDown.current || e.evt.button === 1 || tool === "pan") {
      // Middle-mouse: prevent the browser's default scroll-cursor behavior
      if (e.evt.button === 1) e.evt.preventDefault();
      isPanning.current = true;
      setIsPanningState(true);
      return;
    }

    if (tool === "select") {
      if (clickedOnEmpty) {
        if (!e.evt.shiftKey) clearSelection();
        setMarquee({ start: wp, end: wp });
      }
      return;
    }
    if (tool === "zone" || tool === "nonUsable") {
      const { width: fw, height: fh } = floorBBox(plan.floor);
      const clampedStart = {
        x: Math.max(0, Math.min(wp.x, fw)),
        y: Math.max(0, Math.min(wp.y, fh)),
      };
      const snapped = snapPoint(clampedStart, plan.gridSize, plan.snapEnabled);
      setDraftRect({ start: snapped, end: snapped });
      return;
    }
    if (tool === "wall") {
      const { width: fw, height: fh } = floorBBox(plan.floor);
      const clampedWall = {
        x: Math.max(0, Math.min(wp.x, fw)),
        y: Math.max(0, Math.min(wp.y, fh)),
      };
      // Snap threshold: screen-pixel-based only (no inch minimum).
      // Hold Alt to bypass all snapping for precise small-wall placement.
      // Hold Shift to constrain wall to 0°/45°/90° from its start point.
      const snapThreshold = 16 / (pixelsPerInch * zoom);
      const epSnap = altDown.current ? null : findWallEndpointSnap(clampedWall, snapThreshold);
      const baseSnapped = altDown.current
        ? clampedWall
        : (epSnap ?? snapPoint(clampedWall, plan.gridSize, plan.snapEnabled));
      if (!draftLine) {
        setDraftLine({ start: baseSnapped, end: baseSnapped });
      } else {
        const endPt = shiftDown.current
          ? constrainToAngle(draftLine.start, clampedWall)
          : baseSnapped;
        addWall({
          x1: draftLine.start.x,
          y1: draftLine.start.y,
          x2: endPt.x,
          y2: endPt.y,
          thickness: 4,
        });
        setDraftLine(null);
        setWallEndpointSnap(null);
      }
      return;
    }
    if (tool === "door" || tool === "window") {
      const snapThreshold = 40 / (pixelsPerInch * zoom);
      const proj = findNearestWallProjection(wp, Math.max(snapThreshold, 18));
      if (proj) {
        if (tool === "door") {
          const newId = addDoor({ x: proj.x, y: proj.y, angle: proj.angle, width: 36, swing: "right", kind: "single", wallId: proj.wallId });
          setTool("select");
          setSelection([newId]);
        } else {
          const newId = addWindow({ x: proj.x, y: proj.y, angle: proj.angle, width: 36, wallId: proj.wallId });
          setTool("select");
          setSelection([newId]);
        }
      }
      return;
    }
    if (tool === "zonePolygon" || tool === "nonUsablePolygon") {
      const { width: fw, height: fh } = floorBBox(plan.floor);
      const clamped = {
        x: Math.max(0, Math.min(wp.x, fw)),
        y: Math.max(0, Math.min(wp.y, fh)),
      };
      const snapped = snapPoint(clamped, plan.gridSize, plan.snapEnabled);
      if (!draftPolygon || draftPolygon.length === 0) {
        setDraftPolygon([snapped]);
        return;
      }
      // Close polygon if click is near the first vertex (within 12 inches)
      const first = draftPolygon[0];
      const dxClose = snapped.x - first.x;
      const dyClose = snapped.y - first.y;
      const closeDist = Math.sqrt(dxClose * dxClose + dyClose * dyClose);
      if (draftPolygon.length >= 3 && closeDist < 12) {
        commitPolygon(draftPolygon);
        return;
      }
      setDraftPolygon([...draftPolygon, snapped]);
      return;
    }
    if (tool === "measure") {
      if (!measure || measure.b) {
        setMeasure({ a: wp, b: null });
      } else {
        setMeasure({ a: measure.a, b: wp });
      }
      return;
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const wp = getWorldPoint();
    if (!wp) return;
    setHoverWorld(wp);

    if (isPanning.current) {
      const stage = stageRef.current;
      if (!stage) return;
      const dx = e.evt.movementX;
      const dy = e.evt.movementY;
      setPan({ x: pan.x + dx, y: pan.y + dy });
      return;
    }

    if (draftRect) {
      const { width: fw, height: fh } = floorBBox(plan.floor);
      const clamped = {
        x: Math.max(0, Math.min(wp.x, fw)),
        y: Math.max(0, Math.min(wp.y, fh)),
      };
      const snapped = snapPoint(clamped, plan.gridSize, plan.snapEnabled);
      setDraftRect({ start: draftRect.start, end: snapped });
    }
    if (draftLine) {
      const { width: fw, height: fh } = floorBBox(plan.floor);
      const clampedEnd = {
        x: Math.max(0, Math.min(wp.x, fw)),
        y: Math.max(0, Math.min(wp.y, fh)),
      };
      const snapThreshold = 16 / (pixelsPerInch * zoom);
      const epSnap = altDown.current ? null : findWallEndpointSnap(clampedEnd, snapThreshold);
      // Don't show endpoint-snap indicator when shift-constraining (angle takes priority)
      setWallEndpointSnap(shiftDown.current ? null : epSnap);
      const baseSnapped = altDown.current
        ? clampedEnd
        : (epSnap ?? snapPoint(clampedEnd, plan.gridSize, plan.snapEnabled));
      const finalEnd = shiftDown.current
        ? constrainToAngle(draftLine.start, clampedEnd)
        : baseSnapped;
      setDraftLine({ start: draftLine.start, end: finalEnd });
    } else if (tool === "wall") {
      // Detect endpoint snap before the first click too
      const { width: fw, height: fh } = floorBBox(plan.floor);
      const clamped = { x: Math.max(0, Math.min(wp.x, fw)), y: Math.max(0, Math.min(wp.y, fh)) };
      const snapThreshold = 16 / (pixelsPerInch * zoom);
      setWallEndpointSnap(altDown.current ? null : findWallEndpointSnap(clamped, snapThreshold));
    }
    if (tool === "door" || tool === "window") {
      const snapThreshold = 40 / (pixelsPerInch * zoom);
      setWallProjectionSnap(findNearestWallProjection(wp, Math.max(snapThreshold, 18)));
    } else {
      setWallProjectionSnap(null);
    }
    if (marquee) {
      setMarquee({ start: marquee.start, end: wp });
    }
    if (measure && !measure.b) {
      // live cursor, no commit
    }
  };

  const handleStageMouseUp = () => {
    isPanning.current = false;
    setIsPanningState(false);
    if (draftRect) {
      const x1 = Math.min(draftRect.start.x, draftRect.end.x);
      const y1 = Math.min(draftRect.start.y, draftRect.end.y);
      const w = Math.abs(draftRect.end.x - draftRect.start.x);
      const h = Math.abs(draftRect.end.y - draftRect.start.y);
      if (w > 4 && h > 4) {
        if (tool === "zone") {
          const palette = [
            "#7b9acc", "#a87b53", "#a8a0c8", "#8b6f47", "#6a9050",
            "#d87060", "#d8a040", "#5a6b7a", "#9bb8d8", "#b88963",
          ];
          const color = palette[plan.zones.length % palette.length];
          const name = `Zone ${plan.zones.length + 1}`;
          addZone({ kind: "rect", name, color, x: x1, y: y1, width: w, height: h });
        } else if (tool === "nonUsable") {
          addNonUsable({ kind: "rect", x: x1, y: y1, width: w, height: h });
        }
      }
      setDraftRect(null);
    }
    if (marquee && tool === "select") {
      const x1 = Math.min(marquee.start.x, marquee.end.x);
      const y1 = Math.min(marquee.start.y, marquee.end.y);
      const w = Math.abs(marquee.end.x - marquee.start.x);
      const h = Math.abs(marquee.end.y - marquee.start.y);
      if (w > 2 && h > 2) {
        const hits: string[] = [];
        for (const it of plan.placedItems) {
          const c = getCatalogItem(it.catalogId);
          if (!c) continue;
          const cx = it.x + c.width / 2;
          const cy = it.y + c.depth / 2;
          if (cx >= x1 && cx <= x1 + w && cy >= y1 && cy <= y1 + h) {
            hits.push(it.id);
          }
        }
        setSelection(hits);
      }
      setMarquee(null);
    }
  };

  // HTML5 drop from catalog / kits panel
  const onContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const onContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const active = getActiveDrag();
    if (!active) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    stage.setPointersPositions(e.nativeEvent as any);
    const wp = getWorldPoint();
    if (!wp) return;

    if (active.kind === "catalog") {
      const cat = active.item;
      const snapped = snapPoint(
        { x: wp.x - cat.width / 2, y: wp.y - cat.depth / 2 },
        plan.gridSize,
        plan.snapEnabled,
      );
      // Accessories are placed independently in world coordinates — they sit
      // on top of furniture visually (z-order) but are NOT parented, so they
      // can be selected, moved, and deleted on their own.
      addPlacedItem({
        catalogId: cat.id,
        x: snapped.x,
        y: snapped.y,
        rotation: 0,
      });
    } else if (active.kind === "kit") {
      const v = active.kit;
      const snapped = snapPoint(
        { x: wp.x - v.bbox.width / 2, y: wp.y - v.bbox.height / 2 },
        plan.gridSize,
        plan.snapEnabled,
      );
      stampKit(v.id, snapped.x, snapped.y);
    }
    clearActiveDrag();
  };

  const storeZone = plan.zones.find((z) => z.isStore) ?? null;
  let totalSqft: number;
  let occupiedSqft = 0;

  if (storeZone) {
    totalSqft = storeZone.kind === "rect"
      ? sqftFromInches(storeZone.width, storeZone.height)
      : polygonArea(storeZone.points) / 144;
    for (const it of plan.placedItems) {
      const c = getCatalogItem(it.catalogId);
      if (!c || c.isAccessory) continue;
      const cx = it.x + c.width / 2;
      const cy = it.y + c.depth / 2;
      const inside = storeZone.kind === "rect"
        ? pointInRect(cx, cy, storeZone.x, storeZone.y, storeZone.width, storeZone.height)
        : pointInPolygon({ x: cx, y: cy }, storeZone.points);
      if (inside) occupiedSqft += sqftFromInches(c.width, c.depth);
    }
  } else {
    totalSqft = plan.floor.kind === "polygon"
      ? polygonArea(plan.floor.points) / 144
      : sqftFromInches(floorWidth, floorHeight);
    for (const it of plan.placedItems) {
      const c = getCatalogItem(it.catalogId);
      if (c && !c.isAccessory) occupiedSqft += sqftFromInches(c.width, c.depth);
    }
  }
  const freeSqft = Math.max(0, totalSqft - occupiedSqft);

  // Cursor: grabbing while actively panning, grab when pan is "armed"
  // (pan tool selected or space held), otherwise default.
  const panArmed = tool === "pan";
  const cursor = isPanningState ? "grabbing" : panArmed ? "grab" : "default";

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        background: "#eef2f6",
        cursor,
      }}
      onDragOver={onContainerDragOver}
      onDrop={onContainerDrop}
      onAuxClick={(e) => {
        // Suppress middle-click "paste" / autoscroll fallback in some browsers
        if (e.button === 1) e.preventDefault();
      }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDblClick={() => {
          if ((tool === "zonePolygon" || tool === "nonUsablePolygon") && draftPolygon && draftPolygon.length >= 3) {
            commitPolygon(draftPolygon);
          }
        }}
      >
        <Layer ref={layerRef}>
          <FloorLayer floor={plan.floor} pixelsPerInch={pixelsPerInch} />
          {refHtmlImage && refImage?.visible && (() => {
            const wPx = refImage.realWidthFt * 12 * pixelsPerInch;
            const hPx = (refHtmlImage.naturalHeight / refHtmlImage.naturalWidth) * wPx;
            return (
              <KonvaImage
                image={refHtmlImage}
                x={0}
                y={0}
                width={wPx}
                height={hPx}
                opacity={refImage.opacity}
                listening={false}
              />
            );
          })()}
          <GridLayer
            floor={plan.floor}
            gridSize={plan.gridSize}
            pixelsPerInch={pixelsPerInch}
            visible={plan.showGrid}
          />
          <ZonesLayer
            zones={plan.zones}
            nonUsable={plan.nonUsable}
            pixelsPerInch={pixelsPerInch}
            selectedIds={selectionIds}
            onSelect={(id, additive) =>
              additive ? addToSelection(id) : setSelection([id])
            }
            toolIsSelect={tool === "select"}
            gridSize={plan.gridSize}
            snapEnabled={plan.snapEnabled}
            zoneEditMode={zoneEditMode}
            hideLabels
            onSnapGuides={setSnapGuides}
          />
          <NonUsableLayer
            regions={plan.nonUsable}
            zones={plan.zones}
            pixelsPerInch={pixelsPerInch}
            selectedIds={selectionIds}
            onSelect={(id, additive) =>
              additive ? addToSelection(id) : setSelection([id])
            }
            toolIsSelect={tool === "select"}
            gridSize={plan.gridSize}
            snapEnabled={plan.snapEnabled}
            nonUsableEditMode={nonUsableEditMode}
            hideLabels
            onSnapGuides={setSnapGuides}
          />
          <WallsLayer
            walls={plan.walls}
            pixelsPerInch={pixelsPerInch}
            selectedIds={selectionIds}
            onSelect={(id, additive) =>
              additive ? addToSelection(id) : setSelection([id])
            }
          />
          <DoorsWindowsLayer
            doors={plan.doors ?? []}
            windows={plan.windows ?? []}
            walls={plan.walls}
            pixelsPerInch={pixelsPerInch}
            selectedIds={selectionIds}
            onSelect={(id, additive) =>
              additive ? addToSelection(id) : setSelection([id])
            }
            toolIsSelect={tool === "select"}
            onUpdateDoor={updateDoor}
            onUpdateWindow={updateWindow}
          />
          <ItemsLayer
            plan={plan}
            pixelsPerInch={pixelsPerInch}
            selectionIds={selectionIds}
            onSelect={(id, additive) =>
              additive ? addToSelection(id) : setSelection([id])
            }
          />
          {/* Labels always on top of all shapes and placed items */}
          <LabelsOverlay
            zones={plan.zones}
            nonUsable={plan.nonUsable}
            pixelsPerInch={pixelsPerInch}
            showLabels={plan.showLabels}
          />
          {/* Alignment snap guides — visible while dragging zones / non-usable regions */}
          {snapGuides.length > 0 && (
            <Group listening={false}>
              {snapGuides.map((g, i) => (
                <Line
                  key={i}
                  points={
                    g.axis === "x"
                      ? [g.at * pixelsPerInch, g.from * pixelsPerInch, g.at * pixelsPerInch, g.to * pixelsPerInch]
                      : [g.from * pixelsPerInch, g.at * pixelsPerInch, g.to * pixelsPerInch, g.at * pixelsPerInch]
                  }
                  stroke="#e05c00"
                  strokeWidth={1.5}
                  dash={[6, 4]}
                  listening={false}
                />
              ))}
            </Group>
          )}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            resizeEnabled={false}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={5}
            anchorSize={8}
            borderStroke="#1f6feb"
            borderStrokeWidth={1.5}
            anchorStroke="#1f6feb"
            anchorFill="#ffffff"
            rotateAnchorOffset={28}
          />
          <Transformer
            ref={zoneTransformerRef}
            rotateEnabled={false}
            resizeEnabled
            enabledAnchors={[
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
              "top-center",
              "middle-right",
              "bottom-center",
              "middle-left",
            ]}
            anchorSize={10}
            borderStroke="#1f6feb"
            borderStrokeWidth={1.5}
            anchorStroke="#1f6feb"
            anchorFill="#ffffff"
          />
          <Transformer
            ref={nonUsableTransformerRef}
            rotateEnabled={false}
            resizeEnabled
            enabledAnchors={[
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
              "top-center",
              "middle-right",
              "bottom-center",
              "middle-left",
            ]}
            anchorSize={10}
            borderStroke="#e67e22"
            borderStrokeWidth={1.5}
            anchorStroke="#e67e22"
            anchorFill="#ffffff"
          />
          {/* Draft rect (zone/non-usable) */}
          {draftRect && (() => {
            const draftW = Math.abs(draftRect.end.x - draftRect.start.x);
            const draftH = Math.abs(draftRect.end.y - draftRect.start.y);
            const draftX = Math.min(draftRect.start.x, draftRect.end.x) * pixelsPerInch;
            const draftY = Math.min(draftRect.start.y, draftRect.end.y) * pixelsPerInch;
            const draftPxW = draftW * pixelsPerInch;
            const draftPxH = draftH * pixelsPerInch;
            const draftSqft = sqftFromInches(draftW, draftH);
            return (
              <Group listening={false}>
                <Rect
                  x={draftX}
                  y={draftY}
                  width={draftPxW}
                  height={draftPxH}
                  fill={tool === "zone" ? "rgba(31,111,235,0.15)" : "rgba(154,165,177,0.3)"}
                  stroke="#1f6feb"
                  strokeWidth={1}
                  dash={[6, 4]}
                />
                <Text
                  x={draftX + 4}
                  y={draftY + 4}
                  text={`${feetInches(draftW, { compact: true })} × ${feetInches(draftH, { compact: true })}`}
                  fontSize={11}
                  fill="#1a1f26"
                />
                <Text
                  x={draftX + draftPxW - 4}
                  y={draftY + draftPxH - 13}
                  text={formatSqft(draftSqft)}
                  fontSize={11}
                  fill="#1a1f26"
                  align="right"
                  width={Math.max(30, draftPxW - 8)}
                  offsetX={Math.max(30, draftPxW - 8)}
                />
              </Group>
            );
          })()}
          {/* Marquee */}
          {marquee && (
            <Rect
              x={Math.min(marquee.start.x, marquee.end.x) * pixelsPerInch}
              y={Math.min(marquee.start.y, marquee.end.y) * pixelsPerInch}
              width={Math.abs(marquee.end.x - marquee.start.x) * pixelsPerInch}
              height={Math.abs(marquee.end.y - marquee.start.y) * pixelsPerInch}
              fill="rgba(31,111,235,0.08)"
              stroke="#1f6feb"
              strokeWidth={1}
              dash={[4, 3]}
              listening={false}
            />
          )}
          {/* Draft polygon (zone or non-usable free-form) */}
          {draftPolygon && draftPolygon.length > 0 && (
            <Group listening={false}>
              {(() => {
                const polyColor = tool === "nonUsablePolygon" ? "#6b7785" : "#1f6feb";
                const pts = draftPolygon.flatMap((p) => [
                  p.x * pixelsPerInch,
                  p.y * pixelsPerInch,
                ]);
                const cursor = hoverWorld;
                const rubber =
                  cursor && draftPolygon.length > 0
                    ? [
                        draftPolygon[draftPolygon.length - 1].x * pixelsPerInch,
                        draftPolygon[draftPolygon.length - 1].y * pixelsPerInch,
                        cursor.x * pixelsPerInch,
                        cursor.y * pixelsPerInch,
                      ]
                    : null;
                return (
                  <>
                    {draftPolygon.length >= 2 && (
                      <Line points={pts} stroke={polyColor} strokeWidth={2} />
                    )}
                    {rubber && (
                      <Line
                        points={rubber}
                        stroke={polyColor}
                        strokeWidth={1.5}
                        dash={[5, 4]}
                      />
                    )}
                    {draftPolygon.map((p, i) => (
                      <Circle
                        key={i}
                        x={p.x * pixelsPerInch}
                        y={p.y * pixelsPerInch}
                        radius={i === 0 ? 5 : 3}
                        fill={i === 0 ? "white" : polyColor}
                        stroke={polyColor}
                        strokeWidth={2}
                      />
                    ))}
                  </>
                );
              })()}
            </Group>
          )}
          {/* Wall endpoint snap indicator */}
          {tool === "wall" && wallEndpointSnap && (
            <Group listening={false}>
              <Circle
                x={wallEndpointSnap.x * pixelsPerInch}
                y={wallEndpointSnap.y * pixelsPerInch}
                radius={9}
                stroke="#22c55e"
                strokeWidth={2}
                fill="rgba(34,197,94,0.15)"
              />
              <Circle
                x={wallEndpointSnap.x * pixelsPerInch}
                y={wallEndpointSnap.y * pixelsPerInch}
                radius={3}
                fill="#22c55e"
              />
              <Line
                points={[
                  (wallEndpointSnap.x - 14 / pixelsPerInch) * pixelsPerInch,
                  wallEndpointSnap.y * pixelsPerInch,
                  (wallEndpointSnap.x + 14 / pixelsPerInch) * pixelsPerInch,
                  wallEndpointSnap.y * pixelsPerInch,
                ]}
                stroke="#22c55e"
                strokeWidth={1.5}
                listening={false}
              />
              <Line
                points={[
                  wallEndpointSnap.x * pixelsPerInch,
                  (wallEndpointSnap.y - 14 / pixelsPerInch) * pixelsPerInch,
                  wallEndpointSnap.x * pixelsPerInch,
                  (wallEndpointSnap.y + 14 / pixelsPerInch) * pixelsPerInch,
                ]}
                stroke="#22c55e"
                strokeWidth={1.5}
                listening={false}
              />
            </Group>
          )}
          {/* Wall projection snap indicator (door/window tool) */}
          {(tool === "door" || tool === "window") && wallProjectionSnap && (
            <Group listening={false}>
              <Circle
                x={wallProjectionSnap.x * pixelsPerInch}
                y={wallProjectionSnap.y * pixelsPerInch}
                radius={10}
                stroke={tool === "door" ? "#f59e0b" : "#06b6d4"}
                strokeWidth={2}
                fill={tool === "door" ? "rgba(245,158,11,0.15)" : "rgba(6,182,212,0.15)"}
              />
              <Circle
                x={wallProjectionSnap.x * pixelsPerInch}
                y={wallProjectionSnap.y * pixelsPerInch}
                radius={3}
                fill={tool === "door" ? "#f59e0b" : "#06b6d4"}
              />
            </Group>
          )}
          {/* Draft wall */}
          {draftLine && (
            <Group listening={false}>
              <Line
                points={[
                  draftLine.start.x * pixelsPerInch,
                  draftLine.start.y * pixelsPerInch,
                  draftLine.end.x * pixelsPerInch,
                  draftLine.end.y * pixelsPerInch,
                ]}
                stroke="#1f6feb"
                strokeWidth={3}
                dash={[6, 4]}
              />
              <Circle
                x={draftLine.start.x * pixelsPerInch}
                y={draftLine.start.y * pixelsPerInch}
                radius={3}
                fill="#1f6feb"
              />
            </Group>
          )}
          {/* Measure */}
          {measure && (
            <Group listening={false}>
              <Circle
                x={measure.a.x * pixelsPerInch}
                y={measure.a.y * pixelsPerInch}
                radius={3}
                fill="#d97706"
              />
              {(() => {
                const end = measure.b ?? hoverWorld ?? measure.a;
                const d = distance(measure.a, end);
                return (
                  <>
                    <Line
                      points={[
                        measure.a.x * pixelsPerInch,
                        measure.a.y * pixelsPerInch,
                        end.x * pixelsPerInch,
                        end.y * pixelsPerInch,
                      ]}
                      stroke="#d97706"
                      strokeWidth={2}
                      dash={[6, 4]}
                    />
                    <Circle
                      x={end.x * pixelsPerInch}
                      y={end.y * pixelsPerInch}
                      radius={3}
                      fill="#d97706"
                    />
                    <Text
                      x={(measure.a.x + end.x) / 2 * pixelsPerInch + 6}
                      y={(measure.a.y + end.y) / 2 * pixelsPerInch - 14}
                      text={feetInches(d, { compact: true })}
                      fontSize={13}
                      fill="#d97706"
                      fontStyle="bold"
                    />
                  </>
                );
              })()}
            </Group>
          )}
        </Layer>
      </Stage>

      {/* HUD */}
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid #c0cad4",
          borderRadius: 6,
          padding: "8px 12px",
          fontSize: 12,
          color: "#2d3742",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          minWidth: 200,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{plan.name}</div>
        <div style={{ fontSize: 10, color: "#7a9bc0", marginBottom: 4 }}>
          ✓ Auto-saved · {new Date(plan.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div>Floor: {feetInches(floorWidth, { compact: true })} × {feetInches(floorHeight, { compact: true })}</div>
        {storeZone ? (
          <>
            <div style={{ color: "#15803d", fontWeight: 600 }}>Store: {formatSqft(totalSqft)}</div>
            <div>Occupied: {formatSqft(occupiedSqft)}</div>
            <div>Free: {formatSqft(freeSqft)}</div>
          </>
        ) : (
          <>
            <div>Total: {formatSqft(totalSqft)}</div>
            <div>Occupied: {formatSqft(occupiedSqft)}</div>
            <div>Free: {formatSqft(freeSqft)}</div>
          </>
        )}
        {plan.zones.length > 0 && (
          <>
            <div style={{ marginTop: 6, fontWeight: 600 }}>Zones</div>
            {plan.zones.map((z) => {
              const zoneSqft =
                z.kind === "polygon"
                  ? polygonArea(z.points) / 144
                  : sqftFromInches(z.width, z.height);
              return (
                <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      background: z.color,
                      border: z.isStore ? "2px solid #15803d" : "1px solid #aaa",
                    }}
                  />
                  <span style={{ fontWeight: z.isStore ? 600 : 400, color: z.isStore ? "#15803d" : undefined }}>
                    {z.isStore ? "★ " : ""}{z.name}: {formatSqft(zoneSqft)}
                  </span>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "#6b7785", marginTop: 2 }}>
              Total zones: {formatSqft(plan.zones.reduce((sum, z) =>
                sum + (z.kind === "polygon" ? polygonArea(z.points) / 144 : sqftFromInches(z.width, z.height)), 0
              ))}
            </div>
          </>
        )}
        {plan.nonUsable.length > 0 && (
          <>
            <div style={{ marginTop: 6, fontWeight: 600 }}>Non-usable</div>
            {plan.nonUsable.map((n) => {
              const nuSqft = n.kind === "rect"
                ? sqftFromInches(n.width, n.height)
                : polygonArea(n.points) / 144;
              return (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      background: "repeating-linear-gradient(45deg,#9aa5b1 0,#9aa5b1 2px,#dde3ea 0,#dde3ea 6px)",
                      border: "1px solid #6b7785",
                    }}
                  />
                  <span>{n.label ?? "Non-usable"}: {formatSqft(nuSqft)}</span>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "#6b7785", marginTop: 2 }}>
              Total non-usable: {formatSqft(plan.nonUsable.reduce((s, n) =>
                s + (n.kind === "rect" ? sqftFromInches(n.width, n.height) : polygonArea(n.points) / 144), 0
              ))}
            </div>
          </>
        )}
      </div>

      {/* Cursor position HUD */}
      {hoverWorld && (
        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid #c0cad4",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 11,
            color: "#2d3742",
            fontFamily: "monospace",
          }}
        >
          x {feetInches(hoverWorld.x, { compact: true })} · y {feetInches(hoverWorld.y, { compact: true })} · zoom {(zoom * 100).toFixed(0)}%
        </div>
      )}

      {/* Ruler overlays */}
      {showRuler && (
        <CanvasRuler
          width={width}
          height={height}
          pan={pan}
          zoom={zoom}
          pixelsPerInch={pixelsPerInch}
        />
      )}

      {/* Scale bar */}
      {showRuler && (
        <ScaleBar pixelsPerInch={pixelsPerInch} zoom={zoom} scaleRatio={scaleRatio} />
      )}

      {/* Tool hint */}
      {tool !== "select" && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(31,111,235,0.92)",
            color: "white",
            padding: "6px 14px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {tool === "pan" && "Drag anywhere to pan the canvas — V to switch back to Select"}
          {tool === "zone" && "Click-drag to draw a rectangular department zone"}
          {tool === "zonePolygon" && "Click vertices to draw a polygon zone — click first point or double-click to close · Enter commits · Esc cancels"}
          {tool === "nonUsable" && "Click-drag to mark non-usable area"}
          {tool === "nonUsablePolygon" && "Click vertices to draw a free-form non-usable area — click first point or double-click to close · Enter commits · Esc cancels"}
          {tool === "wall" && "Click two points to draw a wall · Hold Shift for straight walls (0°/45°/90°) · Hold Alt to bypass snap"}
          {tool === "door" && "Click on a wall to place a door (36\" default width)"}
          {tool === "window" && "Click on a wall to place a window (36\" default width)"}
          {tool === "measure" && "Click two points to measure distance"}
          {tool === "delete" && "Click items to delete"}
          {tool !== "zonePolygon" && tool !== "pan" && " — Esc to cancel"}
        </div>
      )}
    </div>
  );
}
