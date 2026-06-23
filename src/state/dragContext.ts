import type { CatalogItem, Kit } from "../types/model";

type ActiveDrag =
  | { kind: "catalog"; item: CatalogItem }
  | { kind: "kit"; kit: Kit }
  | null;

let active: ActiveDrag = null;

export function setActiveDrag(d: ActiveDrag): void {
  active = d;
}

export function getActiveDrag(): ActiveDrag {
  return active;
}

export function clearActiveDrag(): void {
  active = null;
}
