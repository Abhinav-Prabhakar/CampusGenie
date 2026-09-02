// Copies maplibre-gl's ESM web-worker files into public/ so the browser can
// load them with correct MIME types.
//
// maplibre-gl v6 derives its worker URL from import.meta.url, which is not a
// real http(s) URL under Next's bundlers. maplibre then resolves the worker
// against the page origin, the dev server answers with HTML, and the map
// renders blank ("non-JavaScript MIME type" console error). Setting
// config.WORKER_URL (see DirectionsMap.tsx) to a served copy fixes it.
//
// The worker is an ES module whose only import is ./maplibre-gl-shared.mjs
// (a leaf module), so exactly two files are needed.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(root, "package.json"));

const pkg = require.resolve("maplibre-gl/package.json");
const dist = join(dirname(pkg), "dist");
const outDir = join(root, "public", "maplibre");

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(dist)) {
  console.error(`[copy-maplibre-worker] maplibre-gl not found at ${dist}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
for (const file of files) {
  copyFileSync(join(dist, file), join(outDir, file));
}
console.log(`[copy-maplibre-worker] copied ${files.join(", ")} -> public/maplibre (maplibre-gl ${require("maplibre-gl/package.json").version})`);
