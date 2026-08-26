import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const runtimeFiles = Object.freeze([
  "index.html", "privacy.html", "favicon.svg", "styles.css", "styles-brand.css", "app.js",
  "agreements.mjs", "core.mjs", "data-contract.mjs", "agreement-engine.mjs", "fruit-ledger.mjs",
  "wish-engine.mjs", "wish-icons.mjs", "backup.mjs", "safety.mjs", "config.mjs", "state-invariants.mjs",
]);
const assetFiles = Object.freeze([
  "bubu-avatar.webp", "bubu-today.webp", "bubu-fruit.webp", "bubu-rest.webp",
  "bubu-growth-1.webp", "bubu-growth-2.webp", "bubu-growth-3.webp", "bubu-growth-4.webp", "bubu-growth-5.webp",
]);

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "assets"), { recursive: true });
for (const file of runtimeFiles) await cp(path.join(root, file), path.join(output, file));
for (const file of assetFiles) await cp(path.join(root, "assets", file), path.join(output, "assets", file));

const appPath = path.join(output, "app.js");
let productionApp = await readFile(appPath, "utf8");
productionApp = productionApp
  .replace('const demoAccess = APP_CONFIG.environment === "development" ? globalThis.__YLB_DEMO_ACCESS__ || null : null;', "const demoAccess = null;")
  .replace(/\n  if \(action === "demo".*?return seedDemo\(\);/, "")
  .replace(/\nasync function seedDemo\(\) \{.*?\nasync function activateFromMagicLink/s, "\nasync function activateFromMagicLink");
await writeFile(appPath, productionApp);

const actual = (await listFiles(output)).sort();
const expected = [...runtimeFiles, ...assetFiles.map((file) => `assets/${file}`)].sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Production manifest mismatch:\n${actual.join("\n")}`);
for (const file of actual.filter((name) => /\.(?:js|mjs|html)$/.test(name))) {
  const text = await readFile(path.join(output, file), "utf8");
  if (/BB-ALL-0001|BB-S[1-6]-0001/.test(text)) throw new Error(`Demo activation code leaked into ${file}`);
  if (/demo-access\.mjs|__YLB_DEMO_ACCESS__|seedDemo/.test(text)) throw new Error(`Development branch leaked into ${file}`);
}
console.log(`Production build ready: ${actual.length} allowlisted files; demo, tests, docs and design sources excluded.`);

async function listFiles(directory, prefix = "") {
  const outputFiles = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) outputFiles.push(...await listFiles(path.join(directory, entry.name), relative));
    else outputFiles.push(relative);
  }
  return outputFiles;
}
