/** Image and video decoding in the browser. Anything that fails here is sent to the API. */
import { takenAt } from "./metadata";
import { ALL_FORMATS, AudioBufferSink, BlobSource, CanvasSink, Input } from "mediabunny";

export type Drawable = ImageBitmap | HTMLImageElement | VideoFrame | HTMLCanvasElement | OffscreenCanvas;

export interface DecodedFrame {
  image: Drawable;
  width: number;
  height: number;
  /** Frame duration in seconds for animations and video, undefined for still images. */
  duration?: number;
  close(): void;
}

export type Kind = "image" | "video";

const ANIMATED_TYPES = new Set(["image/gif", "image/webp", "image/png", "image/apng", "image/avif"]);
const VIDEO_EXT =
  /\.(mp4|m4v|mov|qt|webm|mkv|avi|wmv|asf|flv|3gp|3g2|mpg|mpeg|m2v|ts|mts|m2ts|ogv|vob|mxf|dv)$/i;

export function kindOf(file: File): Kind {
  return file.type.startsWith("video/") || VIDEO_EXT.test(file.name) ? "video" : "image";
}

function isSvg(file: File) {
  return file.type === "image/svg+xml" || /\.svgz?$/i.test(file.name);
}

function loadImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`cannot decode ${file.name}`));
    };
    img.src = url;
  });
}

export async function decodeStill(file: File): Promise<DecodedFrame> {
  if (!isSvg(file)) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img>, which knows a few more formats (e.g. ICO, HEIC in Safari) */
    }
  }
  const img = await loadImg(file);
  // SVGs without explicit size report 0x0 in some browsers.
  const w = img.naturalWidth || 1024;
  const h = img.naturalHeight || 1024;
  if (!img.naturalWidth) {
    img.width = w;
    img.height = h;
  }
  return { image: img, width: w, height: h, close: () => {} };
}

function openVideo(file: File) {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

/** Yields all frames of an animation or video, or the single frame of a still image. */
export async function* decodeFrames(file: File, animate: boolean, fps: number): AsyncGenerator<DecodedFrame> {
  if (kindOf(file) === "video") {
    yield* decodeVideo(file, fps);
    return;
  }
  const IDecoder = (globalThis as any).ImageDecoder;
  if (animate && IDecoder && ANIMATED_TYPES.has(file.type)) {
    let decoder: any;
    try {
      decoder = new IDecoder({ data: file.stream(), type: file.type });
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      if (track && track.animated && track.frameCount > 1) {
        for (let i = 0; i < track.frameCount; i++) {
          const { image } = await decoder.decode({ frameIndex: i });
          const frame = image as VideoFrame;
          yield {
            image: frame,
            width: frame.displayWidth,
            height: frame.displayHeight,
            duration: frameSeconds(frame.duration),
            close: () => frame.close(),
          };
        }
        return;
      }
    } catch {
      /* not animated or unsupported: decode as a still image */
    } finally {
      decoder?.close();
    }
  }
  yield await decodeStill(file);
}

const frameSeconds = (us: number | null | undefined) => Math.max(0.02, (us || 100_000) / 1e6);

/** Video frames resampled to the output fps. */
async function* decodeVideo(file: File, fps: number): AsyncGenerator<DecodedFrame> {
  const input = openVideo(file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new Error("video codec not supported by this browser");
    const start = await track.getFirstTimestamp();
    const end = await track.computeDuration();
    const sink = new CanvasSink(track, { poolSize: 2 });
    const step = 1 / fps;
    const times = function* () {
      for (let t = start; t < end - step / 2; t += step) yield t;
    };
    for await (const wrapped of sink.canvasesAtTimestamps(times())) {
      if (!wrapped) continue;
      const c = wrapped.canvas;
      yield { image: c, width: c.width, height: c.height, duration: step, close: () => {} };
    }
  } finally {
    input.dispose();
  }
}

/** Sound of a video clip as chunks with start times relative to the clip start. */
export async function decodeVideoAudio(file: File): Promise<{ buffer: AudioBuffer; at: number }[]> {
  const input = openVideo(file);
  try {
    const audio = await input.getPrimaryAudioTrack();
    if (!audio || !(await audio.canDecode())) return [];
    const video = await input.getPrimaryVideoTrack();
    const start = video ? await video.getFirstTimestamp() : await audio.getFirstTimestamp();
    const chunks: { buffer: AudioBuffer; at: number }[] = [];
    for await (const w of new AudioBufferSink(audio).buffers()) {
      chunks.push({ buffer: w.buffer, at: w.timestamp - start });
    }
    return chunks;
  } finally {
    input.dispose();
  }
}

export interface Probe {
  kind: Kind;
  /** Small preview, or null if the browser cannot decode this file. */
  thumb: string | null;
  browserOk: boolean;
  /** Video length in seconds; null if unknown. */
  videoDuration?: number | null;
  /** Durations of animation frames in seconds (animated GIF/WebP/APNG). */
  frameDurations?: number[];
  /** Pages of a PDF, counted roughly. */
  pages?: number;
  hasAudio?: boolean;
  /** When it was taken (EXIF / video header), ms since epoch. */
  takenAt?: number | null;
}

function thumbFrom(image: CanvasImageSource, w: number, h: number, size = 240): string {
  const scale = Math.min(1, size / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  c.getContext("2d")!.drawImage(image, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

async function animationFrames(file: File): Promise<number[] | undefined> {
  const IDecoder = (globalThis as any).ImageDecoder;
  if (!IDecoder || !ANIMATED_TYPES.has(file.type)) return undefined;
  let decoder: any;
  try {
    decoder = new IDecoder({ data: file.stream(), type: file.type });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    if (!track?.animated || track.frameCount < 2) return undefined;
    const out: number[] = [];
    for (let i = 0; i < track.frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      out.push(frameSeconds(image.duration));
      image.close();
    }
    return out;
  } catch {
    return undefined;
  } finally {
    decoder?.close();
  }
}

async function countPdfPages(file: File): Promise<number> {
  const text = new TextDecoder("latin1").decode(await file.arrayBuffer());
  const n = text.match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
  return Math.max(1, n);
}

/** Native <video> can often report the length even when it cannot be decoded here. */
function videoElementDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (d: number | null) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.preload = "metadata";
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    v.src = url;
  });
}

export async function probe(file: File): Promise<Probe> {
  const [info, date] = await Promise.all([probeMedia(file), takenAt(file)]);
  return { ...info, takenAt: date };
}

async function probeMedia(file: File): Promise<Probe> {
  if (kindOf(file) === "video") {
    const input = openVideo(file);
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track || !(await track.canDecode())) throw new Error("unsupported");
      const duration = (await track.computeDuration()) - (await track.getFirstTimestamp());
      const sink = new CanvasSink(track);
      const first = await sink.getCanvas(await track.getFirstTimestamp());
      const audio = await input.getPrimaryAudioTrack();
      return {
        kind: "video",
        browserOk: true,
        thumb: first ? thumbFrom(first.canvas, first.canvas.width, first.canvas.height) : null,
        videoDuration: duration,
        hasAudio: !!audio && (await audio.canDecode()),
      };
    } catch {
      return { kind: "video", browserOk: false, thumb: null, videoDuration: await videoElementDuration(file) };
    } finally {
      input.dispose();
    }
  }

  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    return { kind: "image", browserOk: false, thumb: null, pages: await countPdfPages(file) };
  }
  try {
    const f = await decodeStill(file);
    const thumb = thumbFrom(f.image as CanvasImageSource, f.width, f.height);
    f.close();
    return { kind: "image", browserOk: true, thumb, frameDurations: await animationFrames(file) };
  } catch {
    return { kind: "image", browserOk: false, thumb: null };
  }
}
