export type Fit = "contain" | "cover" | "blur";
export type OutFormat = "mp4" | "webm" | "gif";
export type Quality = "low" | "medium" | "high";
export type EngineChoice = "auto" | "browser" | "server";

/** Same option names as the HTTP API (see api/app/main.py). */
export interface RenderOptions {
  width: number;
  height: number;
  fps: number;
  duration: number;
  fit: Fit;
  background: string;
  transition: "none" | "crossfade";
  transition_duration: number;
  format: OutFormat;
  quality: Quality;
  animate: boolean;
}

export const defaultOptions: RenderOptions = {
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 2,
  fit: "blur",
  background: "#000000",
  transition: "crossfade",
  transition_duration: 0.5,
  format: "mp4",
  quality: "medium",
  animate: true,
};

export interface Item {
  id: string;
  file: File;
  /** Small preview, or null if the browser cannot decode this format. */
  thumb: string | null;
  /** true once we know the browser can decode it, false if it cannot. */
  browserOk: boolean | null;
}

export interface Progress {
  stage: "upload" | "render" | "download";
  value: number; // 0..1
  label?: string;
}

export interface RenderResult {
  blob: Blob;
  engine: "browser" | "server";
  skipped: string[];
}
