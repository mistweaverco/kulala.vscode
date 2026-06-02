#!/usr/bin/env bash


set -euo pipefail

rm -rf ./dist

./scripts/build-syntax.sh

node esbuild.mjs

rm -rf ./.cache/web-tree-sitter
cp --recursive --dereference ./node_modules/web-tree-sitter ./.cache/web-tree-sitter
rm -rf ./node_modules/web-tree-sitter
mv ./.cache/web-tree-sitter ./node_modules/web-tree-sitter

vsce package --out kulala.vsix

rm -rf ./node_modules

pnpm install
