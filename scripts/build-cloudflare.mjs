import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "cloudflare-dist");
if (dirname(output) !== root || basename(output) !== "cloudflare-dist") {
  throw new Error("Refusing to prepare assets outside the generated cloudflare-dist directory.");
}
rmSync(output, { recursive: true, force: true });

function copyPath(relativePath) {
  const source = join(root, relativePath);
  const destination = join(output, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, {
    recursive: true,
    filter: path => !path.toLowerCase().endsWith(".md")
  });
}

mkdirSync(output, { recursive: true });
for (const relativePath of ["book", "pilot/config.js", "pilot/track.html", "pilot/track.js", "pilot/api.js", "pilot/assets"]) {
  copyPath(relativePath);
}

writeFileSync(join(output, "_redirects"), [
  "/ /book/ 301",
  "/index.html /book/ 301",
  "/concept /book/ 301",
  "/concept/ /book/ 301",
  "/concept/* /book/ 301",
  "/gear-care.html /book/ 301",
  "/stringing.html /book/ 301",
  "/pilot /book/ 302",
  "/pilot/ /book/ 302",
  "/pilot/index.html /book/ 302",
  "/pilot/staff.html /book/staff.html 302",
  ""
].join("\n"));

console.log(`Prepared Cloudflare static assets in ${output}`);
