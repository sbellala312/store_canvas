import type { CatalogItem } from "../types/model";

export const GLB_MODELS: CatalogItem[] = [
  {
    id: "glb-B070-31",
    name: "B070-31",
    category: "3D Models",
    subcategory: "Bedroom",
    width: 59.7,
    depth: 15.3,
    height: 36.4,
    defaultColor: "#a8a0c8",
    isAccessory: false,
    shape: "rect",
    glbUrl: "/models/B070-31-3D_1.glb",
  },
  {
    id: "glb-D583-02",
    name: "D583-02",
    category: "3D Models",
    subcategory: "Dining",
    width: 20,
    depth: 23,
    height: 34.8,
    defaultColor: "#8b6f47",
    isAccessory: false,
    shape: "rect",
    glbUrl: "/models/D583-02-3D.glb",
  },
  {
    id: "glb-T481-1",
    name: "T481-1",
    category: "3D Models",
    subcategory: "Tables",
    width: 56.1,
    depth: 42.1,
    height: 16.6,
    defaultColor: "#b88963",
    isAccessory: false,
    shape: "rect",
    glbUrl: "/models/T481-1-3D.glb",
  },
];

export const GLB_BY_ID = new Map(GLB_MODELS.map((m) => [m.id, m]));
