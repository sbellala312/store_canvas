// One-time script: adds CORS to the Azure Search index so the browser can call it directly.
// Run with: node add-cors.mjs

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

console.log("1) Fetching current index definition...");
const getRes = await fetch(`${ENDPOINT}/indexes/${INDEX}?api-version=${VERSION}`, {
  headers: { "api-key": API_KEY },
});
if (!getRes.ok) {
  console.error("Failed to GET index:", getRes.status, await getRes.text());
  process.exit(1);
}
const indexDef = await getRes.json();
console.log("   Current corsOptions:", JSON.stringify(indexDef.corsOptions ?? null));

// Inject CORS — allows the browser dev server to call Azure directly
indexDef.corsOptions = {
  allowedOrigins: ["http://localhost:5173", "http://localhost:5174"],
  maxAgeInSeconds: 300,
};

console.log("\n2) Updating index with CORS settings...");
const putRes = await fetch(`${ENDPOINT}/indexes/${INDEX}?api-version=${VERSION}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    "api-key": API_KEY,
    "Prefer": "return=minimal",
  },
  body: JSON.stringify(indexDef),
});
const putBody = await putRes.text();
console.log("   Status:", putRes.status, putRes.status === 204 || putRes.status === 200 ? "✓ Success" : "✗ Failed");
if (putBody) console.log("   Response:", putBody.slice(0, 400));

if (putRes.status === 200 || putRes.status === 204) {
  console.log("\nDone. CORS is enabled — the browser can now call Azure Search directly.");
  console.log("You can delete this file after running it.");
}
