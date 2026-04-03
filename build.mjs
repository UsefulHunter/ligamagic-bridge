// build.mjs — Script de build com esbuild
// Compila todos os entrypoints TypeScript para a pasta dist/
// e copia os arquivos estáticos (manifest, popup.html, ícones).

import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";

const watch = process.argv.includes("--watch");

/** Entrypoints: cada um vira um bundle JS independente */
const entryPoints = [
  { in: "src/content/scryfall.ts",  out: "content/scryfall" },
  { in: "src/content/moxfield.ts",  out: "content/moxfield" },
  { in: "src/content/edhrec.ts",    out: "content/edhrec" },
  { in: "src/content/archidekt.ts", out: "content/archidekt" },
  { in: "src/popup/popup.ts",       out: "popup" },
];

const buildOptions = {
  entryPoints,
  bundle: true,
  outdir: "dist",
  format: "iife",        // IIFE é o formato correto para content scripts e popups
  target: "chrome120",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  logLevel: "info",
};

/** Copia arquivos estáticos para dist/ */
function copyStatics() {
  fs.mkdirSync("dist/content", { recursive: true });
  fs.mkdirSync("dist/icons", { recursive: true });

  // manifest.json
  fs.copyFileSync("public/manifest.json", "dist/manifest.json");

  // popup.html
  fs.copyFileSync("src/popup/popup.html", "dist/popup.html");

  // Ícones (se existirem)
  const iconsDir = "public/icons";
  if (fs.existsSync(iconsDir)) {
    for (const file of fs.readdirSync(iconsDir)) {
      fs.copyFileSync(
        path.join(iconsDir, file),
        path.join("dist/icons", file)
      );
    }
  }

  console.log("✓ Arquivos estáticos copiados para dist/");
}

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  copyStatics();
  await ctx.watch();
  console.log("👁  Watching for changes...");
} else {
  await esbuild.build(buildOptions);
  copyStatics();
  console.log("✅ Build completo → dist/");
}
