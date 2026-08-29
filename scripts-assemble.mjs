import { mkdirSync, copyFileSync, writeFileSync, existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const dist = join(root, "dist");
const out = join(root, "build");
mkdirSync(out, { recursive: true });

// 1) Bundle each referenced entry into a SINGLE self-contained JS file.
//    Content script must be a classic script (no ESM imports) to be injectable.
const bundles = [
  { in: "src/content/content-script.ts", file: "content-script.js" },
  { in: "src/popup/popup.ts", file: "popup/popup.js" },
  { in: "src/options/options.ts", file: "options/options.js" },
];
for (const b of bundles) {
  await build({
    entryPoints: [join(root, b.in)],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome110"],
    outfile: join(out, b.file),
    logLevel: "info",
  });
}

// 2) Copy compiled background + shared + analysis tree (already ESM-friendly).
function copyDir(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const e of readdirSync(src)) {
    const s = join(src, e), d = join(dest, e);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}
copyDir(dist, out);

// 3) Static assets
copyFileSync(join(root, "popup.html"), join(out, "popup.html"));
copyFileSync(join(root, "popup.css"), join(out, "popup.css"));
copyFileSync(join(root, "options.html"), join(out, "options.html"));
copyFileSync(join(root, "options.css"), join(out, "options.css"));
mkdirSync(join(out, "icons"), { recursive: true });
copyFileSync(join(root, "manifest.json"), join(out, "manifest.json"));
for (const s of [16, 48, 128]) copyFileSync(join(root, `icons/icon${s}.png`), join(out, `icons/icon${s}.png`));

// 4) Rewrite manifest paths to final locations
const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
manifest.background.service_worker = "background/service-worker.js";
manifest.action.default_popup = "popup.html";
manifest.options_page = "options.html";
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("assembled -> build/");
