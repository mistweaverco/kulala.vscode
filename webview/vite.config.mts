import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  optimizeDeps: {
    include: ["monaco-editor"],
  },
  worker: {
    format: "es",
  },
  build: {
    // Monaco is large; keep chunks manageable for webview loading.
    chunkSizeWarningLimit: 3000,
  },
});
