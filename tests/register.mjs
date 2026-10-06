import * as nodeModule from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const [major, minor] = process.versions.node.split(".").map(Number);
const runsTypeScript = major >= 24 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18);
if (!runsTypeScript) {
  console.error(
    `npm test needs Node 22.18+ or 23.6+ to run TypeScript directly; this is Node ${process.versions.node}.`,
  );
  process.exit(1);
}

process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:1/test";
delete process.env.VOYAGE_API_KEY;
delete process.env.CRON_SECRET;

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts"];
const NODE_MODULES = `${path.sep}node_modules${path.sep}`;

function locate(base) {
  for (const suffix of CANDIDATES) {
    const file = base + suffix;
    if (existsSync(file) && statSync(file).isFile()) return pathToFileURL(file).href;
  }
  return null;
}

function localBase(specifier, parentURL) {
  if (specifier.startsWith("@/")) return path.join(SRC, specifier.slice(2));
  if (!/^\.\.?\//.test(specifier) || !parentURL?.startsWith("file:")) return null;
  const parent = fileURLToPath(parentURL);
  if (parent.includes(NODE_MODULES)) return null;
  return path.join(path.dirname(parent), specifier);
}

nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    const base = localBase(specifier, context.parentURL);
    const url = base && locate(base);
    return nextResolve(url ?? specifier, context);
  },
});
