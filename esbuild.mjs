import * as esbuild from "esbuild";

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

if (watch) {
  await ctx.watch();
  console.log("watching extension...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
