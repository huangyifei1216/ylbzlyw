import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const names = ["avatar", "today", "fruit", "rest", "growth-1", "growth-2", "growth-3", "growth-4", "growth-5"];
const root = new URL("../assets/", import.meta.url);
let total = 0;
const hashes = new Map();

for (const name of names) {
  const url = new URL(`bubu-${name}.webp`, root);
  const file = await readFile(url);
  const size = (await stat(url)).size;
  total += size;
  assert.ok(size <= 180 * 1024, `${name} exceeds 180KB`);
  if (["avatar", "today"].includes(name)) assert.ok(size <= 120 * 1024, `${name} exceeds the 120KB first-screen budget`);
  hashes.set(name, createHash("sha256").update(file).digest("hex"));
}

assert.ok(total <= 1.5 * 1024 * 1024, "all production Bubu assets must stay below 1.5MB");
assert.equal(new Set(hashes.values()).size, names.length, "all nine Bubu production assets must be independent files");
assert.equal(new Set([1, 2, 3, 4, 5].map((level) => hashes.get(`growth-${level}`))).size, 5, "five growth assets must be visually distinct files");

const productionFiles = ["index.html", "app.js", "styles.css", "styles-brand.css"];
const productionText = (await Promise.all(productionFiles.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")))).join("\n");
assert.doesNotMatch(productionText, /bubu-character-sheet\.png/);
assert.doesNotMatch(productionText, /assets\/bubu-[^"')]+\.png/);

console.log(`Asset checks passed: 9 independent WebP files, 5 distinct growth hashes, ${(total / 1024).toFixed(1)}KB total, no character-sheet production reference.`);
