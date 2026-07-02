// Quick Azure Search credential test — run with: node test-connection.mjs
// No dependencies needed (uses Node 18+ built-in fetch).

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

async function get(path) {
  const res = await fetch(`${ENDPOINT}${path}`, { headers: { "api-key": API_KEY } });
  return { status: res.status, body: await res.text() };
}

async function post(path, body) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": API_KEY },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.text() };
}

console.log("=== Azure Search connection test ===\n");

// 1. List all indexes (works with admin key; 403 = query-only key)
console.log("1) Listing all indexes...");
const list = await get(`/indexes?api-version=${VERSION}`);
console.log("   Status:", list.status);
console.log("   Body  :", list.body.slice(0, 600));
console.log();

// 2. Search the target index
console.log(`2) Searching index "${INDEX}"...`);
const search = await post(`/indexes/${INDEX}/docs/search?api-version=${VERSION}`, {
  search: "*",
  top: 2,
});
console.log("   Status:", search.status);
console.log("   Body  :", search.body.slice(0, 800));
console.log();
