/** Predicts the output length. Mirrors the frame math in api/app/render.py. */
import type { Item, RenderOptions } from "./types";

export interface Estimate {
  seconds: number;
  /** false when some file's length is a guess (PDF pages, unknown video length, still probing). */
  exact: boolean;
}

const frames = (s: number, fps: number) => Math.max(1, Math.round(s * fps));

export function itemEstimate(it: Item, o: RenderOptions): Estimate {
  const still = frames(o.duration, o.fps) / o.fps;
  if (it.browserOk === null) return { seconds: it.kind === "video" ? 0 : still, exact: false };
  if (it.kind === "video") {
    return it.videoDuration != null ? { seconds: it.videoDuration, exact: true } : { seconds: 0, exact: false };
  }
  if (it.pages) return { seconds: it.pages * still, exact: false };
  if (o.animate && it.frameDurations?.length) {
    return { seconds: it.frameDurations.reduce((sum, d) => sum + frames(d, o.fps), 0) / o.fps, exact: true };
  }
  // Animated GIF in a browser without ImageDecoder: we cannot tell its length.
  const unknownAnim = o.animate && it.file.type === "image/gif" && !("ImageDecoder" in globalThis);
  return { seconds: still, exact: !unknownAnim };
}

export function totalEstimate(items: Item[], o: RenderOptions): Estimate {
  let seconds = 0;
  let exact = true;
  for (const it of items) {
    const e = itemEstimate(it, o);
    seconds += e.seconds;
    exact &&= e.exact;
  }
  if (o.transition === "crossfade" && items.length > 1) {
    seconds += (items.length - 1) * (Math.round(o.transition_duration * o.fps) / o.fps);
  }
  return { seconds, exact };
}

/** 7.5 → "0:07.5", 75 → "1:15", 3725 → "1:02:05" */
export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = s < 60 && sec % 1 >= 0.05 ? sec.toFixed(1).padStart(4, "0") : String(Math.floor(sec)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
