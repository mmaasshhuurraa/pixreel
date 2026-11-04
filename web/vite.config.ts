import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };

// BASE_PATH is "/pixreel/" on GitHub Pages and "/" everywhere else.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  // Shown in the page footer.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // ffmpeg.wasm starts its own worker; pre-bundling breaks that in dev mode.
  optimizeDeps: { exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"] },
});
