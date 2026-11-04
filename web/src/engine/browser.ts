/**
 * Render the video entirely in the browser with WebCodecs (via mediabunny).
 * Nothing is uploaded, and the hardware encoder is used when available.
 */
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from "mediabunny";
import { decodeFrames, type DecodedFrame } from "./decode";
import type { Item, Progress, RenderOptions, RenderResult } from "./types";

export class BrowserUnsupported extends Error {}

const QUALITY = { low: QUALITY_LOW, medium: QUALITY_MEDIUM, high: QUALITY_HIGH };

function codecsFor(format: RenderOptions["format"]) {
  if (format === "mp4") return { video: "avc", audio: "aac" } as const;
  if (format === "webm") return { video: "vp9", audio: "opus" } as const;
  throw new BrowserUnsupported("GIF is rendered on the server");
}

/** Can this browser produce the requested video at all? */
export async function browserCanRender(opts: RenderOptions, withAudio: boolean): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || opts.format === "gif") return false;
  const c = codecsFor(opts.format);
  const size = even(opts);
  if (!(await canEncodeVideo(c.video, { width: size.width, height: size.height }))) return false;
  if (withAudio && !(await canEncodeAudio(c.audio))) return false;
  return true;
}

function even(o: RenderOptions) {
  return { width: o.width - (o.width % 2), height: o.height - (o.height % 2) };
}

function draw(ctx: CanvasRenderingContext2D, f: DecodedFrame, o: RenderOptions) {
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = o.background;
  ctx.fillRect(0, 0, W, H);

  const contain = Math.min(W / f.width, H / f.height);
  const cover = Math.max(W / f.width, H / f.height);

  if (o.fit === "blur") {
    const bw = f.width * cover;
    const bh = f.height * cover;
    ctx.filter = `blur(${Math.round(Math.max(W, H) / 40)}px) brightness(0.75)`;
    ctx.drawImage(f.image, (W - bw) / 2, (H - bh) / 2, bw, bh);
    ctx.filter = "none";
  }
  const s = o.fit === "cover" ? cover : contain;
  const w = f.width * s;
  const h = f.height * s;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(f.image, (W - w) / 2, (H - h) / 2, w, h);
  ctx.restore();
}

async function loadAudio(file: File, seconds: number): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const length = Math.min(buf.length, Math.round(seconds * buf.sampleRate));
    const out = new AudioBuffer({ length, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
    const fade = Math.min(length, Math.round(1.5 * buf.sampleRate));
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const data = buf.getChannelData(ch).slice(0, length);
      // Fade out over the last 1.5 s so the music does not cut off abruptly.
      for (let i = 0; i < fade; i++) data[length - 1 - i] *= i / fade;
      out.copyToChannel(data, ch);
    }
    return out;
  } finally {
    void ctx.close();
  }
}

export async function renderInBrowser(
  items: Item[],
  opts: RenderOptions,
  audio: File | null,
  onProgress: (p: Progress) => void,
  signal: AbortSignal,
): Promise<RenderResult> {
  if (!(await browserCanRender(opts, !!audio))) throw new BrowserUnsupported("WebCodecs encoder not available");
  const codecs = codecsFor(opts.format);
  const { width, height } = even(opts);

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const octx = out.getContext("2d", { alpha: false })!;
  // `work` holds the next composed image, `prev` the last one (for crossfades).
  const work = document.createElement("canvas");
  work.width = width;
  work.height = height;
  const wctx = work.getContext("2d", { alpha: false })!;
  const prev = document.createElement("canvas");
  prev.width = width;
  prev.height = height;
  const pctx = prev.getContext("2d", { alpha: false })!;

  const output = new Output({
    format: opts.format === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const video = new CanvasSource(out, { codec: codecs.video, quality: QUALITY[opts.quality], keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: opts.fps });
  let audioSource: AudioBufferSource | null = null;
  if (audio) {
    audioSource = new AudioBufferSource({ codec: codecs.audio, quality: QUALITY.high });
    output.addAudioTrack(audioSource);
  }
  await output.start();

  const frameDur = 1 / opts.fps;
  const transFrames = opts.transition === "crossfade" ? Math.round(opts.transition_duration * opts.fps) : 0;
  let t = 0;
  let hasPrev = false;
  const skipped: string[] = [];

  try {
    for (let i = 0; i < items.length; i++) {
      if (signal.aborted) throw new DOMException("cancelled", "AbortError");
      onProgress({ stage: "render", value: i / items.length, label: items[i].file.name });
      let first = true;
      try {
        for await (const frame of decodeFrames(items[i].file, opts.animate)) {
          draw(wctx, frame, opts);
          frame.close();
          if (first && hasPrev && transFrames) {
            for (let k = 1; k <= transFrames; k++) {
              octx.globalAlpha = 1;
              octx.drawImage(prev, 0, 0);
              octx.globalAlpha = k / (transFrames + 1);
              octx.drawImage(work, 0, 0);
              await video.add(t, frameDur);
              t += frameDur;
            }
            octx.globalAlpha = 1;
          }
          first = false;
          octx.drawImage(work, 0, 0);
          // A still image is a single long frame: fast to encode, same result.
          const d = frame.duration ?? Math.max(frameDur, Math.round(opts.duration * opts.fps) / opts.fps);
          await video.add(t, d);
          t += d;
          pctx.drawImage(work, 0, 0);
          hasPrev = true;
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        skipped.push(`${items[i].file.name}: ${(e as Error).message}`);
      }
    }
    if (t === 0) throw new Error("no image could be decoded");
    video.close();
    if (audio && audioSource) {
      await audioSource.add(await loadAudio(audio, t));
      audioSource.close();
    }
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }

  const buffer = (output.target as BufferTarget).buffer!;
  onProgress({ stage: "render", value: 1 });
  return {
    blob: new Blob([buffer], { type: opts.format === "mp4" ? "video/mp4" : "video/webm" }),
    engine: "browser",
    skipped,
  };
}
