#!/usr/bin/env bash


set -euo pipefail

rm -rf ./dist

function cleanup {
  rm -rf ./node_modules
  pnpm install
  if [[ -f README.md.bak ]]; then
    mv README.md.bak README.md || true
  fi
}

trap cleanup EXIT

./scripts/build-syntax.sh

node esbuild.mjs
pnpm build:webview

rm -rf ./.cache/web-tree-sitter
cp --recursive --dereference ./node_modules/web-tree-sitter ./.cache/web-tree-sitter
rm -rf ./node_modules/web-tree-sitter
mv ./.cache/web-tree-sitter ./node_modules/web-tree-sitter

# HACK: Duct-tape README
# Microsoft doesn't allow .svg in the README,
# so we copy the README to a backup, then replace the .svg with .png,
# and then restore the README after packaging.
cp README.md README.md.bak
sed -i 's/\.svg/\.png/g' README.md

vsce package --out kulala.vsix

if [[ -n "${OVSX_PAT:-}" ]]; then
  npx ovsx publish
fi
