// Extract the original illustrations once during deployment. The reader can then
// fetch individual pages and thumbnails without downloading an entire book.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceDir = path.join(root, "scripts", "book-artwork");
const outputDir = path.join(root, "shared-book-assets");
const required = new Set();
const booksDir = path.join(root, "books");
for (const file of await readdir(booksDir)) {
  if (!file.endsWith(".html")) continue;
  const html = await readFile(path.join(booksDir, file), "utf8");
  for (const match of html.matchAll(/\/shared-book-assets\/([a-f0-9]{24}\.(?:jpeg|png|webp))/g)) {
    required.add(match[1]);
  }
}
await mkdir(outputDir, { recursive: true });
const extracted = new Set();
for (const file of await readdir(sourceDir)) {
  if (!file.endsWith(".source")) continue;
  const source = await readFile(path.join(sourceDir, file), "utf8");
  for (const match of source.matchAll(/data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)/g)) {
    const image = Buffer.from(match[2], "base64");
    const digest = createHash("sha256").update(image).digest("hex").slice(0, 24);
    const name = digest + "." + match[1];
    if (!required.has(name) || extracted.has(name)) continue;
    await writeFile(path.join(outputDir, name), image);
    extracted.add(name);
  }
}
for (const name of required) {
  if (!extracted.has(name)) throw new Error("Illustration manquante : " + name);
  await access(path.join(outputDir, name));
}
console.log(extracted.size + " illustrations originales préparées.");
