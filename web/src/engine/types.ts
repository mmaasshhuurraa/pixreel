import type { Kind, Probe } from "./decode";
import type { TransitionChoice } from "./transitions";
import type { MusicTransition } from "./playlist";

export type Fit = "contain" | "cover" | "blur";
export type OutFormat = "mp4" | "mov" | "webm" | "mkv" | "avi" | "wmv" | "gif";

export const MIME: Record<OutFormat, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  gif: "image/gif",
};
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
  transition: TransitionChoice;
  transition_duration: number;
  format: OutFormat;
  quality: Quality;
  animate: boolean;
  video_audio: boolean;
  music_transition: MusicTransition;
  music_transition_duration: number;
  music_loop: boolean;
  music_volume: number; // 0..2
  video_volume: number; // 0..2
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
  video_audio: false,
  music_transition: "crossfade",
  music_transition_duration: 2,
  music_loop: false,
  music_volume: 1,
  video_volume: 1,
};

export interface Track {
  id: string;
  file: File;
  /** Seconds; undefined while reading, null if unknown. */
  duration?: number | null;
}

export interface Item extends Partial<Omit<Probe, "browserOk" | "thumb" | "kind">> {
  id: string;
  file: File;
  kind: Kind;
  /** Small preview, or null if the browser cannot decode this format. */
  thumb: string | null;
  /** null while probing, then whether the browser can decode it. */
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
