import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
if (!/^\d+(\.\d+){0,3}$/.test(pkg.version)) {
  throw new Error(`"${pkg.version}" is not a valid Chrome extension version`);
}
const path = new URL("../dist/manifest.json", import.meta.url);
const manifest = JSON.parse(readFileSync(path, "utf8"));
manifest.version = pkg.version;
writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
