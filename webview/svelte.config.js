import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import("@sveltejs/kit").Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: "../dist/webview",
      assets: "../dist/webview",
      precompress: false,
      strict: true,
    }),
    router: {
      type: "hash",
    },
    paths: {
      relative: true,
    },
  },
};

export default config;
