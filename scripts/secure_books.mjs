import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const guard = '<script>window.KM_BOOK_EMBED=(()=>{try{return new URLSearchParams(location.search).get("embed")==="1"&&window.self!==window.top&&new URL(document.referrer).origin===location.origin}catch{return false}})();if(!window.KM_BOOK_EMBED)document.write(\'<script src="../km-access-gate.js?v=all-books-protected-2"><\\/script>\');else document.documentElement.classList.add("embed-book")</script>';

for (const folder of ["books", "uploads"]) {
  const contentDir = path.join(projectRoot, folder);
  for (const name of fs.readdirSync(contentDir).filter((file) => file.endsWith(".html"))) {
    const filePath = path.join(contentDir, name);
    let source = fs.readFileSync(filePath, "utf8");
    source = source.replace(/<script>window\.KM_BOOK_EMBED=.*?<\/script>\s*/s, "");
    if (!source.includes("<head>")) throw new Error(`Balise <head> absente : ${folder}/${name}`);
    source = source.replace("<head>", `<head>\n${guard}`);
    fs.writeFileSync(filePath, source, "utf8");
    process.stdout.write(`Protégé : ${folder}/${name}\n`);
  }
}
