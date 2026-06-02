import * as fs from "node:fs";
import * as path from "node:path";
import * as esbuild from "esbuild";

const DAISYUI_SRC = path.join("node_modules", "daisyui", "dist", "full.css");
const DAISYUI_DEST = path.join("dist", "media", "daisyui.css");

function copyDaisyUiCss() {
  if (!fs.existsSync(DAISYUI_SRC)) {
    throw new Error(`Missing daisyui stylesheet: ${DAISYUI_SRC}`);
  }
  fs.mkdirSync(path.dirname(DAISYUI_DEST), { recursive: true });
  fs.copyFileSync(DAISYUI_SRC, DAISYUI_DEST);
}

const watch = process.argv.includes("--watch");
const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode", "web-tree-sitter"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: !watch,
});

copyDaisyUiCss();

if (watch) {
  await ctx.watch();
  console.log("watching...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
