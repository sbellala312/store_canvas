export type Inches = number;
export type ID = string;

export interface CatalogItem {
  id: ID;
  name: string;
  category: string;
  subcategory: string;
  width: Inches;
  depth: Inches;
  height?: Inches;
  defaultColor: string;
  isAccessory: boolean;
  shape: "rect" | "circle";
  seriesName?: string;
  imageUrl?: string;
  friendlyDimensions?: string;
  price?: number;
  allImages?: string[];
  glbUrl?: string;
}

export interface Point {
  x: Inches;
  y: Inches;
}

export type FloorShape =
  | { kind: "rect"; width: Inches; height: Inches }
  | { kind: "polygon"; points: Point[]; bbox: { width: Inches; height: Inches } };

export interface ZoneRect {
  id: ID;
  kind: "rect";
  name: string;
  color: string;
  x: Inches;
  y: Inches;
  width: Inches;
  height: Inches;
  isStore?: boolean;
}

export interface ZonePolygon {
  id: ID;
  kind: "polygon";
  name: string;
  color: string;
  points: Point[];
  isStore?: boolean;
}

export type Zone = ZoneRect | ZonePolygon;

export interface NonUsableRect {
  id: ID;
  kind: "rect";
  x: Inches;
  y: Inches;
  width: Inches;
  height: Inches;
  label?: string;
  color?: string;
}

export interface NonUsablePolygon {
  id: ID;
  kind: "polygon";
  points: Point[];
  label?: string;
  color?: string;
}

export type NonUsableRegion = NonUsableRect | NonUsablePolygon;

export interface Wall {
  id: ID;
  x1: Inches;
  y1: Inches;
  x2: Inches;
  y2: Inches;
  thickness: Inches;
}

export interface Door {
  id: ID;
  x: Inches;        // center of opening
  y: Inches;
  angle: number;    // wall direction in radians
  width: Inches;    // opening width (default 36")
  swing: "left" | "right";
  kind: "single" | "double";
  wallId?: ID;
}

export interface Window {
  id: ID;
  x: Inches;        // center of opening
  y: Inches;
  angle: number;    // wall direction in radians
  width: Inches;    // opening width (default 36")
  wallId?: ID;
}

export interface PlacedItem {
  id: ID;
  catalogId: ID;
  x: Inches;
  y: Inches;
  rotation: number;
  color?: string;
  parentId?: ID;
  // Embedded render spec so the item always draws even if the catalog cache is
  // evicted (e.g. localStorage quota). Populated on placement; see planStore.
  spec?: CatalogItem;
  sku?: string;
  vendor?: string;
  pricePoint?: string;
  tags?: string[];
  labelPosition?: "center" | "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  labelFontSize?: number;
  labelRotation?: number;
  labelCalloutOffset?: { dx: number; dy: number };
  labelCalloutOpacity?: number;
}

export interface Kit {
  id: ID;
  name: string;
  items: Array<{
    catalogId: ID;
    dx: Inches;
    dy: Inches;
    rotation: number;
    color?: string;
    parentIndex?: number;
  }>;
  bbox: { width: Inches; height: Inches };
}

/** A pinned distance measurement between two world-space points (inches). */
export interface Measurement {
  id: ID;
  ax: Inches;
  ay: Inches;
  bx: Inches;
  by: Inches;
}

export interface FloorPlan {
  id: ID;
  name: string;
  /** Optional folder for organizing plans. When unset, the plan is grouped by
   *  its name prefix (text before " - " or "_"). */
  folder?: string;
  createdAt: number;
  updatedAt: number;
  floor: FloorShape;
  gridSize: Inches;
  snapEnabled: boolean;
  showGrid: boolean;
  showLabels: boolean;
  zones: Zone[];
  nonUsable: NonUsableRegion[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  placedItems: PlacedItem[];
  /** Pinned distance measurements. Optional so older plans don't break. */
  measurements?: Measurement[];
  /** Whether pinned measurements are visible on the canvas. Optional, defaults to true. */
  showMeasurements?: boolean;
}

export type Tool =
  | "select"
  | "pan"
  | "zone"
  | "zonePolygon"
  | "nonUsable"
  | "nonUsablePolygon"
  | "wall"
  | "door"
  | "window"
  | "measure"
  | "delete";

export interface DraftRect {
  x: Inches;
  y: Inches;
  width: Inches;
  height: Inches;
}

export interface DraftLine {
  x1: Inches;
  y1: Inches;
  x2: Inches;
  y2: Inches;
}
