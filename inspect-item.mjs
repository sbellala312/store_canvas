// Fetch all index records for a given ItemSKU and print every field.
// Usage: node inspect-item.mjs A600085115

import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync(new URL(".env", import.meta.url), "utf8")
    .split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const ENDPOINT = env.VITE_SEARCH_ENDPOINT || "https://searchcatalog.search.windows.net";
const API_KEY  = env.VITE_SEARCH_API_KEY;
const INDEX    = env.VITE_SEARCH_INDEX_NAME_RETAIL || "product-catalog-index-retail";
const VERSION  = "2023-11-01";

if (!API_KEY) { console.error("Missing VITE_SEARCH_API_KEY in .env"); process.exit(1); }

const sku = process.argv[2];
if (!sku) { console.error("Usage: node inspect-item.mjs <SKU>"); process.exit(1); }

const res = await fetch(`${ENDPOINT}/indexes/${INDEX}/docs/search?api-version=${VERSION}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "api-key": API_KEY },
  body: JSON.stringify({
    search: "*",
    filter: `ItemSKU eq '${sku}'`,
    top: 20,
  }),
});

if (!res.ok) { console.error("HTTP", res.status, await res.text()); process.exit(1); }

const data = await res.json();
const records = data.value ?? [];

console.log(`\n=== ${records.length} record(s) found for ItemSKU = "${sku}" ===\n`);

records.forEach((r, i) => {
  console.log(`--- Record ${i + 1} ---`);
  // Print every field sorted alphabetically
  const fields = Object.keys(r).filter(k => !k.startsWith("@")).sort();
  const longest = Math.max(...fields.map(f => f.length));
  for (const f of fields) {
    const val = r[f];
    const display = val === null ? "null" : typeof val === "object" ? JSON.stringify(val) : String(val);
    console.log(`  ${f.padEnd(longest + 2)} ${display}`);
  }
  console.log();
});

// Print a summary of all field names and their types (from first record)
if (records.length > 0) {
  console.log("=== All field names in this index (from first record) ===");
  const fields = Object.keys(records[0]).filter(k => !k.startsWith("@")).sort();
  for (const f of fields) {
    const val = records[0][f];
    const type = val === null ? "null" : typeof val;
    console.log(`  ${f} (${type})`);
  }
}
