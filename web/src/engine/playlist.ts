/** Lay out background music tracks on the timeline. Mirrors api/app/playlist.py. */

export type MusicTransition = "none" | "crossfade" | "gap";

export interface Placed {
  index: number; // which track
  start: number; // seconds on the video timeline
  length: number; // seconds of the track that play
  fadeIn: number;
  fadeOut: number;
}

/**
 * mode: "none" back to back, "crossfade" overlap by `seconds`, "gap" silence of `seconds`.
 * With `until`, the list repeats until that time is covered.
 */
export function plan(durations: number[], mode: MusicTransition, seconds: number, until?: number): Placed[] {
  const n = durations.length;
  if (!n || durations.every((d) => !(d > 0))) return [];
  const out: Placed[] = [];
  for (let i = 0; i < n || until !== undefined; i++) {
    const index = i % n;
    const length = durations[index];
    if (!(length > 0)) continue;
    let start = 0;
    let fadeIn = 0;
    const prev = out[out.length - 1];
    if (prev) {
      const prevEnd = prev.start + prev.length;
      if (mode === "crossfade") {
        const x = Math.max(0, Math.min(seconds, prev.length / 2, length / 2));
        prev.fadeOut = x;
        fadeIn = x;
        start = prevEnd - x;
      } else start = mode === "gap" ? prevEnd + seconds : prevEnd;
    }
    out.push({ index, start, length, fadeIn, fadeOut: 0 });
    if (until !== undefined && start + length >= until) break;
  }
  return out;
}

export function totalLength(durations: number[], mode: MusicTransition, seconds: number): number {
  const p = plan(durations, mode, seconds);
  return p.length ? p[p.length - 1].start + p[p.length - 1].length : 0;
}

/** Length of an audio file from its metadata (fast, no full decode). */
export function audioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (d: number | null) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    a.preload = "metadata";
    a.onloadedmetadata = () => finish(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => finish(null);
    setTimeout(() => finish(null), 8000);
    a.src = url;
  });
}
