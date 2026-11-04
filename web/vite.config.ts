import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH is "/pixreel/" on GitHub Pages and "/" everywhere else.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  // ffmpeg.wasm starts its own worker; pre-bundling breaks that in dev mode.
  optimizeDeps: { exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"] },
});
