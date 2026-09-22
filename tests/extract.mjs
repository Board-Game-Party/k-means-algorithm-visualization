/* tests/extract.mjs — pull the real <script> out of index.html into an ESM module for the tests.
   The suite therefore runs the very code a user opens in the browser, not a copy of it. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

export function build(){
  const html = readFileSync(join(root, "index.html"), "utf8");
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if(blocks.length !== 1) throw new Error(`expected exactly 1 inline <script>, found ${blocks.length}`);
  const code = blocks[0] + "\nexport const app = window.__app;\n";
  mkdirSync(join(here, ".build"), { recursive: true });
  writeFileSync(join(here, ".build", "app.mjs"), code, "utf8");
  return code.length;
}

if(process.argv[1] && process.argv[1].endsWith("extract.mjs")){
  console.log("extracted", build(), "chars -> tests/.build/app.mjs");
}
