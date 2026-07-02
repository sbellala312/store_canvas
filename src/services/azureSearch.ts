import type { CatalogItem } from "../types/model";
import { addToCatalogCache } from "../data/catalog";

// Requests go through Vite's dev proxy (/azure-search → real endpoint).
// Eliminates CORS entirely — no Azure Search CORS config required.
const PROXY_BASE = "/azure-search";
const API_KEY  = import.meta.env.VITE_SEARCH_API_KEY as string;
const INDEX    = import.meta.env.VITE_SEARCH_INDEX_NAME_RETAIL as string;
const API_VERSION = "2023-11-01";

// Category → canvas color mapping. Add entries as real category names become known.
const CATEGORY_COLORS: Record<string, string> = {
  bedroom: "#a8a0c8",
  "living room": "#7b9acc",
  "dining room": "#8b6f47",
  dining: "#8b6f47",
  "home office": "#5a6b7a",
  office: "#5a6b7a",
  "accent & display": "#d87060",
  accent: "#d87060",
  entertainment: "#6e5840",
  outdoor: "#6a9050",
  patio: "#6a9050",
  kids: "#90c090",
  youth: "#90c090",
  mattress: "#c8d8e8",
  accessories: "#f0d870",
  rugs: "#d4c5a5",
};

const FALLBACK_COLORS = ["#7b9acc", "#a8a0c8", "#8b6f47", "#6a9050", "#d87060", "#5a6b7a", "#c8a870"];

function categoryColor(cat: string): string {
  const key = cat.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(k)) return v;
  }
  // Deterministic fallback by hashing the category name
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

// Parse Ashley "ItemFriendlyDimension" strings like:
//   '80"W x 38"D x 34"H'  |  '80W x 38D x 34H'  |  '80 x 38 x 34'
function parseDimensions(dim: string | null | undefined): { width: number; depth: number; height?: number } {
  if (!dim) return { width: 36, depth: 36 };

  const wMatch = dim.match(/(\d+(?:\.\d+)?)\s*"?\s*W/i);
  const dMatch = dim.match(/(\d+(?:\.\d+)?)\s*"?\s*D/i);
  const hMatch = dim.match(/(\d+(?:\.\d+)?)\s*"?\s*H/i);
  if (wMatch && dMatch) {
    return {
      width: parseFloat(wMatch[1]),
      depth: parseFloat(dMatch[1]),
      height: hMatch ? parseFloat(hMatch[1]) : undefined,
    };
  }

  // Fallback: unlabeled "N x N x N"
  const parts = dim.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:[x×]\s*(\d+(?:\.\d+)?))?/i);
  if (parts) {
    return {
      width: parseFloat(parts[1]),
      depth: parseFloat(parts[2]),
      height: parts[3] ? parseFloat(parts[3]) : undefined,
    };
  }

  return { width: 36, depth: 36 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDoc(doc: Record<string, any>): CatalogItem | null {
  // ItemSKU is the product identifier; one SKU may have multiple index records (one per image).
  // We filter to mainImage records in the query so each SKU appears once.
  const sku: string = doc.ItemSKU ?? doc.itemSKU ?? doc.item_sku ?? "";
  const name: string = sku || doc.ProductName || doc.name || "";
  if (!name) return null;

  const category: string = doc.Category ?? doc.category ?? "Uncategorized";
  const subcategory: string = doc.SubCategory ?? doc.subcategory ?? doc.ProductType ?? category;

  // Prefer the pre-parsed numeric inch fields; fall back to parsing the friendly string.
  // Field name is ItemFriendlyDimensions (plural) — note the 's'.
  const numW = doc.ItemProductWidthIn ?? doc.ItemWidthIn;
  const numD = doc.ItemProductDepthIn ?? doc.ItemDepthIn;
  const numH = doc.ItemProductHeightIn ?? doc.ItemHeightIn;
  const dims =
    numW && numD
      ? { width: Number(numW), depth: Number(numD), height: numH ? Number(numH) : undefined }
      : parseDimensions(doc.ItemFriendlyDimensions ?? doc.ItemFriendlyDimension ?? doc.Dimensions);

  // Resolve image URL and full image list from AllImages array; fall back to file_path.
  let imageUrl: string | undefined;
  let allImages: string[] | undefined;
  const rawImages = doc.AllImages ?? doc.allImages;
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    allImages = rawImages.map(String);
    imageUrl = allImages[0];
  } else if (typeof rawImages === "string" && rawImages.startsWith("http")) {
    imageUrl = rawImages;
    allImages = [rawImages];
  } else if (doc.file_path) {
    imageUrl = String(doc.file_path);
    allImages = [imageUrl];
  }

  return {
    id: sku || String(doc.id),
    name,
    category,
    subcategory,
    width: dims.width,
    depth: dims.depth,
    height: dims.height,
    defaultColor: categoryColor(category),
    isAccessory: false,
    shape: "rect",
    seriesName: doc.ItemSeriesName ?? doc.SeriesName ?? undefined,
    imageUrl,
    allImages,
    friendlyDimensions: doc.ItemFriendlyDimensions ?? doc.ItemFriendlyDimension ?? undefined,
    price: doc.Price != null ? Number(doc.Price)
      : doc.FobArcPrice != null ? Number(doc.FobArcPrice)
      : undefined,
  };
}

export async function searchAshleyCatalog(query: string, top = 100): Promise<CatalogItem[]> {
  if (!API_KEY || !INDEX) {
    console.warn("[AzureSearch] Missing env vars — check .env and restart Vite");
    return [];
  }

  const url = `${PROXY_BASE}/indexes/${INDEX}/docs/search?api-version=${API_VERSION}`;
  console.log("[AzureSearch] POST", url);

  const body: Record<string, unknown> = {
    search: query.trim() || "*",
    top,
    // mainImage eq true keeps one record per ItemSKU (the primary image record).
    // If this filter causes a 400 error, the field name may differ — check console output.
    filter: "mainImage eq true",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": API_KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[AzureSearch] Error response:", res.status, text);

    // 404 means wrong index name — list available indexes and include them in the error
    if (res.status === 404) {
      const available = await listIndexes();
      const hint = available.length
        ? `Indexes on this service:\n• ${available.join("\n• ")}`
        : `Index list unavailable (HTTP ${res.status} — key may be query-only).\nCheck Azure Portal → Search service → Indexes for the correct name.`;
      throw new Error(
        `Index "${INDEX}" not found.\n\n${hint}\n\nIf you just edited vite.config.ts, restart Vite (Ctrl+C → npm run dev).`
      );
    }

    // If the filter field name is wrong, retry without the filter so we can at least see raw data
    if (res.status === 400 && text.includes("mainImage")) {
      console.warn("[AzureSearch] 'mainImage' filter failed — retrying without filter. Check field name.");
      return searchWithoutFilter(query, top);
    }
    throw new Error(`Azure Search ${res.status}: ${text || "(empty body)"}`);
  }

  const data: { value: Record<string, unknown>[] } = await res.json();
  logSample(data.value);

  const items = data.value.map(mapDoc).filter((x): x is CatalogItem => x !== null);
  addToCatalogCache(items);
  return items;
}

// Fallback search without the mainImage filter — used to explore raw field names
async function searchWithoutFilter(query: string, top: number): Promise<CatalogItem[]> {
  const url = `${PROXY_BASE}/indexes/${INDEX}/docs/search?api-version=${API_VERSION}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": API_KEY },
    body: JSON.stringify({ search: query.trim() || "*", top }),
  });
  if (!res.ok) throw new Error(`Azure Search ${res.status}: ${await res.text()}`);
  const data: { value: Record<string, unknown>[] } = await res.json();
  logSample(data.value);

  // Client-side deduplicate by ItemSKU when filter is unavailable
  const seen = new Set<string>();
  const items: CatalogItem[] = [];
  for (const doc of data.value) {
    const sku = String(doc.ItemSKU ?? doc.itemSKU ?? doc.id ?? "");
    if (sku && seen.has(sku)) continue;
    seen.add(sku);
    const item = mapDoc(doc);
    if (item) items.push(item);
  }
  addToCatalogCache(items);
  return items;
}

// Lists all indexes in the service — called on 404 to surface the correct index name.
async function listIndexes(): Promise<string[]> {
  try {
    const res = await fetch(`${PROXY_BASE}/indexes?api-version=${API_VERSION}`, {
      headers: { "api-key": API_KEY },
    });
    const text = await res.text();
    console.log(`[AzureSearch] listIndexes → HTTP ${res.status}`, text.slice(0, 300));
    if (!res.ok) return [];
    const data: { value: { name: string }[] } = JSON.parse(text);
    const names = data.value?.map((i) => i.name) ?? [];
    console.log("[AzureSearch] Available indexes:", names);
    return names;
  } catch (e) {
    console.warn("[AzureSearch] listIndexes error:", e);
    return [];
  }
}

function logSample(records: Record<string, unknown>[]): void {
  if (!records?.length) {
    console.log("[AzureSearch] No records returned");
    return;
  }
  console.log(`[AzureSearch] ${records.length} records returned`);
  console.log("[AzureSearch] Available fields:", Object.keys(records[0]));
  console.log("[AzureSearch] Sample record 1:", records[0]);
  if (records[1]) console.log("[AzureSearch] Sample record 2:", records[1]);
}
