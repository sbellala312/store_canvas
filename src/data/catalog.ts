import type { CatalogItem } from "../types/model";

export const CATALOG: CatalogItem[] = [
  // Living Room
  { id: "lr-sofa-3", name: "3-Seat Sofa", category: "Living Room", subcategory: "Sofas", width: 84, depth: 38, height: 34, defaultColor: "#7b9acc", isAccessory: false, shape: "rect" },
  { id: "lr-loveseat", name: "Loveseat", category: "Living Room", subcategory: "Sofas", width: 60, depth: 38, height: 34, defaultColor: "#7b9acc", isAccessory: false, shape: "rect" },
  { id: "lr-recliner", name: "Recliner", category: "Living Room", subcategory: "Chairs", width: 40, depth: 40, height: 40, defaultColor: "#9bb8d8", isAccessory: false, shape: "rect" },
  { id: "lr-coffee", name: "Coffee Table", category: "Living Room", subcategory: "Tables", width: 48, depth: 24, height: 18, defaultColor: "#a87b53", isAccessory: false, shape: "rect" },
  { id: "lr-end", name: "End Table", category: "Living Room", subcategory: "Tables", width: 24, depth: 24, height: 24, defaultColor: "#b88963", isAccessory: false, shape: "rect" },
  { id: "lr-tv", name: "TV Stand", category: "Living Room", subcategory: "Storage", width: 60, depth: 18, height: 24, defaultColor: "#6e5840", isAccessory: false, shape: "rect" },
  { id: "lr-rug", name: "Area Rug", category: "Living Room", subcategory: "Rugs", width: 96, depth: 120, height: 1, defaultColor: "#d4c5a5", isAccessory: false, shape: "rect" },

  // Bedroom
  { id: "bd-king", name: "King Bed", category: "Bedroom", subcategory: "Beds", width: 80, depth: 84, height: 36, defaultColor: "#a8a0c8", isAccessory: false, shape: "rect" },
  { id: "bd-queen", name: "Queen Bed", category: "Bedroom", subcategory: "Beds", width: 64, depth: 84, height: 36, defaultColor: "#a8a0c8", isAccessory: false, shape: "rect" },
  { id: "bd-nightstand", name: "Nightstand", category: "Bedroom", subcategory: "Tables", width: 24, depth: 16, height: 26, defaultColor: "#b88963", isAccessory: false, shape: "rect" },
  { id: "bd-dresser", name: "Dresser", category: "Bedroom", subcategory: "Storage", width: 60, depth: 18, height: 36, defaultColor: "#6e5840", isAccessory: false, shape: "rect" },
  { id: "bd-chest", name: "Chest", category: "Bedroom", subcategory: "Storage", width: 36, depth: 18, height: 48, defaultColor: "#6e5840", isAccessory: false, shape: "rect" },
  { id: "bd-mirror", name: "Mirror", category: "Bedroom", subcategory: "Decor", width: 40, depth: 2, height: 60, defaultColor: "#c8d8e8", isAccessory: false, shape: "rect" },

  // Dining
  { id: "dn-table-6", name: "Dining Table (6)", category: "Dining", subcategory: "Tables", width: 72, depth: 40, height: 30, defaultColor: "#8b6f47", isAccessory: false, shape: "rect" },
  { id: "dn-chair", name: "Dining Chair", category: "Dining", subcategory: "Chairs", width: 20, depth: 20, height: 36, defaultColor: "#a07b58", isAccessory: false, shape: "rect" },
  { id: "dn-buffet", name: "Buffet", category: "Dining", subcategory: "Storage", width: 60, depth: 18, height: 36, defaultColor: "#6e5840", isAccessory: false, shape: "rect" },

  // Office
  { id: "of-desk", name: "Desk", category: "Office", subcategory: "Desks", width: 60, depth: 30, height: 30, defaultColor: "#5a6b7a", isAccessory: false, shape: "rect" },
  { id: "of-chair", name: "Office Chair", category: "Office", subcategory: "Chairs", width: 24, depth: 24, height: 40, defaultColor: "#444b55", isAccessory: false, shape: "rect" },
  { id: "of-bookcase", name: "Bookcase", category: "Office", subcategory: "Storage", width: 36, depth: 14, height: 72, defaultColor: "#6e5840", isAccessory: false, shape: "rect" },

  // Accessories (small, often round)
  { id: "ac-lamp", name: "Table Lamp", category: "Accessories", subcategory: "Lighting", width: 12, depth: 12, height: 24, defaultColor: "#f0d870", isAccessory: true, shape: "circle" },
  { id: "ac-vase", name: "Vase", category: "Accessories", subcategory: "Decor", width: 8, depth: 8, height: 14, defaultColor: "#d87060", isAccessory: true, shape: "circle" },
  { id: "ac-pillow", name: "Decorative Pillow", category: "Accessories", subcategory: "Soft Goods", width: 18, depth: 18, height: 6, defaultColor: "#c89060", isAccessory: true, shape: "rect" },
  { id: "ac-centerpiece", name: "Centerpiece", category: "Accessories", subcategory: "Decor", width: 16, depth: 16, height: 8, defaultColor: "#d8a040", isAccessory: true, shape: "circle" },
  { id: "ac-plant", name: "Floor Plant", category: "Accessories", subcategory: "Decor", width: 18, depth: 18, height: 48, defaultColor: "#6a9050", isAccessory: true, shape: "circle" },
];

export const CATALOG_BY_ID = new Map(CATALOG.map((i) => [i.id, i]));

export function getCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG_BY_ID.get(id);
}

export function groupedCatalog(): Record<string, Record<string, CatalogItem[]>> {
  const out: Record<string, Record<string, CatalogItem[]>> = {};
  for (const item of CATALOG) {
    out[item.category] ??= {};
    out[item.category][item.subcategory] ??= [];
    out[item.category][item.subcategory].push(item);
  }
  return out;
}
