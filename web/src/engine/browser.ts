/**
 * Render the video entirely in the browser with WebCodecs (via mediabunny).
 * Nothing is uploaded, and the hardware encoder is used when available.
 */
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  MkvOutputFormat,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from "mediabunny";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { drawTransition, picker } from "./transitions";
import { plan } from "./playlist";
import { decodeFrames, decodeVideoAudio, type DecodedFrame } from "./decode";
import { MIME, type Item, type OutFormat, type Progress, type RenderOptions, type RenderResult } from "./types";

export class BrowserUnsupported extends Error {}

const QUALITY = { low: QUALITY_LOW, medium: QUALITY_MEDIUM, high: QUALITY_HIGH };

/** AVI and WMV are made from an MP4 by ffmpeg.wasm. */
const viaFfmpeg = (f: OutFormat) => f === "avi" || f === "wmv";

/** Container written by mediabunny for each output format. */
function container(f: OutFormat): "mp4" | "mov" | "mkv" | "webm" | "gif" {
  return viaFfmpeg(f) ? "mp4" : (f as "mp4" | "mov" | "mkv" | "webm" | "gif");
}

const videoCodec = (f: OutFormat) => (container(f) === "webm" ? "vp9" : "avc");

/** AAC is missing in some browsers (Firefox, Chromium on Linux); MP4/MOV/MKV can carry Opus instead. */
async function pickAudioCodec(f: OutFormat): Promise<"aac" | "opus" | null> {
  if (container(f) !== "webm" && (await canEncodeAudio("aac"))) return "aac";
  return (await canEncodeAudio("opus")) ? "opus" : null;
}

/** Can this browser produce the requested video at all? */
export async function browserCanRender(opts: RenderOptions, withAudio: boolean): Promise<boolean> {
  if (opts.format === "gif") return true;
  if (typeof VideoEncoder === "undefined") return false;
  if (viaFfmpeg(opts.format) && typeof WebAssembly === "undefined") return false;
  const size = even(opts);
  if (!(await canEncodeVideo(videoCodec(opts.format), { width: size.width, height: size.height }))) return false;
  if (withAudio && !(await pickAudioCodec(opts.format))) return false;
  return true;
}

/** Where rendered frames go: a video encoder or a GIF encoder. */
interface Sink {
  /** Adds the current content of the output canvas, shown from t for d seconds. */
  add(t: number, d: number): Promise<void>;
  finish(audio: (() => Promise<AudioBuffer>) | null): Promise<Blob>;
  cancel(): Promise<void>;
}

async function videoSink(canvas: HTMLCanvasElement, opts: RenderOptions, withAudio: boolean): Promise<Sink> {
  const c = container(opts.format);
  const format =
    c === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" })
    : c === "mov" ? new MovOutputFormat({ fastStart: "in-memory" })
    : c === "mkv" ? new MkvOutputFormat()
    : new WebMOutputFormat();
  const output = new Output({ format, target: new BufferTarget() });
  // AVI/WMV are re-encoded afterwards, so keep the intermediate MP4 near lossless.
  const quality = viaFfmpeg(opts.format) ? QUALITY_VERY_HIGH : QUALITY[opts.quality];
  const video = new CanvasSource(canvas, { codec: videoCodec(opts.format), quality, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: opts.fps });
  let audioSource: AudioBufferSource | null = null;
  if (withAudio) {
    audioSource = new AudioBufferSource({ codec: (await pickAudioCodec(opts.format))!, quality: QUALITY_HIGH });
    output.addAudioTrack(audioSource);
  }
  await output.start();
  return {
    add: (t, d) => video.add(t, d),
    async finish(audio) {
      video.close();
      if (audioSource && audio) {
        await audioSource.add(await audio());
        audioSource.close();
      }
      await output.finalize();
      return new Blob([(output.target as BufferTarget).buffer!], { type: MIME[c] });
    },
    cancel: () => output.cancel().catch(() => {}),
  };
}

function gifSink(canvas: HTMLCanvasElement): Sink {
  const ctx = canvas.getContext("2d")!;
  const gif = GIFEncoder();
  return {
    async add(t, d) {
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const palette = quantize(data, 256);
      // GIF delays are in 1/100 s; round the running time so the total stays exact.
      const delay = (Math.round((t + d) * 100) - Math.round(t * 100)) * 10;
      gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, { palette, delay });
      // Let the page breathe: quantizing big frames is heavy.
      await new Promise((r) => setTimeout(r, 0));
    },
    async finish() {
      gif.finish();
      return new Blob([gif.bytes().slice()], { type: MIME.gif });
    },
    async cancel() {},
  };
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

const RATE = 48000;

/** Mix clip sound (at its place in the video) and the music playlist into one buffer. */
async function mixAudio(
  seconds: number,
  music: File[],
  clips: { file: File; start: number; length: number }[],
  opts: RenderOptions,
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(seconds * RATE)), RATE);
  const clipGain = ctx.createGain();
  clipGain.gain.value = opts.video_volume;
  clipGain.connect(ctx.destination);
  for (const clip of clips) {
    for (const chunk of await decodeVideoAudio(clip.file)) {
      if (chunk.at >= clip.length) break;
      const src = ctx.createBufferSource();
      src.buffer = chunk.buffer;
      src.connect(clipGain);
      const offset = Math.max(0, -chunk.at);
      src.start(clip.start + Math.max(0, chunk.at), offset, Math.max(0, clip.length - chunk.at - offset));
    }
  }
  if (music.length) {
    const buffers: (AudioBuffer | null)[] = [];
    for (const f of music) buffers.push(await ctx.decodeAudioData(await f.arrayBuffer()).catch(() => null));
    const placed = plan(
      buffers.map((b) => b?.duration ?? 0),
      opts.music_transition,
      opts.music_transition_duration,
      opts.music_loop ? seconds : undefined,
    ).filter((p) => p.start < seconds);

    // Master: music volume, fade out over the last 1.5 s.
    const master = ctx.createGain();
    const volume = opts.music_volume;
    const fadeAt = Math.max(0, seconds - 1.5);
    master.gain.setValueAtTime(volume, 0);
    master.gain.setValueAtTime(volume, fadeAt);
    master.gain.linearRampToValueAtTime(0, seconds);
    master.connect(ctx.destination);

    for (const p of placed) {
      const src = ctx.createBufferSource();
      src.buffer = buffers[p.index]!;
      const g = ctx.createGain();
      const end = p.start + p.length;
      g.gain.setValueAtTime(p.fadeIn ? 0 : 1, p.start);
      if (p.fadeIn) g.gain.linearRampToValueAtTime(1, p.start + p.fadeIn);
      if (p.fadeOut) {
        g.gain.setValueAtTime(1, end - p.fadeOut);
        g.gain.linearRampToValueAtTime(0, end);
      }
      src.connect(g).connect(master);
      src.start(p.start, 0, p.length);
    }
  }
  return ctx.startRendering();
}

export async function renderInBrowser(
  items: Item[],
  opts: RenderOptions,
  audio: File[],
  onProgress: (p: Progress) => void,
  signal: AbortSignal,
): Promise<RenderResult> {
  const isGif = opts.format === "gif";
  const clipSound = !isGif && opts.video_audio && items.some((i) => i.kind === "video" && i.hasAudio);
  const music = isGif ? [] : audio;
  const withAudio = music.length > 0 || clipSound;
  if (!(await browserCanRender(opts, withAudio))) {
    throw new BrowserUnsupported("encoder not available");
  }
  const { width, height } = even(opts);
  const canvas = (ctxOpts: CanvasRenderingContext2DSettings) => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return [c, c.getContext("2d", ctxOpts)!] as const;
  };
  const [out, octx] = canvas({ alpha: false, willReadFrequently: isGif });
  // `work` holds the next composed image, `prev` the last one (for transitions).
  const [work, wctx] = canvas({ alpha: false });
  const [prev, pctx] = canvas({ alpha: false });

  const sink = isGif ? gifSink(out) : await videoSink(out, opts, withAudio);

  const frameDur = 1 / opts.fps;
  const transFrames = opts.transition !== "none" ? Math.round(opts.transition_duration * opts.fps) : 0;
  const nextEffect = picker(opts.transition);
  let t = 0;
  let hasPrev = false;
  const skipped: string[] = [];
  const clips: { file: File; start: number; length: number }[] = [];
  // AVI/WMV spend the last part of the work in ffmpeg.
  const share = viaFfmpeg(opts.format) ? 0.6 : 1;
  let blob: Blob;

  try {
    for (let i = 0; i < items.length; i++) {
      if (signal.aborted) throw new DOMException("cancelled", "AbortError");
      onProgress({ stage: "render", value: (i / items.length) * share, label: items[i].file.name });
      let first = true;
      let clipStart = 0;
      try {
        for await (const frame of decodeFrames(items[i].file, opts.animate, opts.fps)) {
          draw(wctx, frame, opts);
          frame.close();
          const effect = first && hasPrev && transFrames ? nextEffect() : null;
          if (effect) {
            for (let k = 1; k <= transFrames; k++) {
              drawTransition(octx, effect, prev, work, k / (transFrames + 1));
              await sink.add(t, frameDur);
              t += frameDur;
            }
          }
          if (first) clipStart = t;
          first = false;
          octx.drawImage(work, 0, 0);
          // A still image is a single long frame: fast to encode, same result.
          // Whole output frames, same as the server, so the length matches the estimate.
          const d = Math.max(1, Math.round((frame.duration ?? opts.duration) * opts.fps)) / opts.fps;
          await sink.add(t, d);
          t += d;
          pctx.drawImage(work, 0, 0);
          hasPrev = true;
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        skipped.push(`${items[i].file.name}: ${(e as Error).message}`);
      }
      if (!first && clipSound && items[i].kind === "video" && items[i].hasAudio) {
        clips.push({ file: items[i].file, start: clipStart, length: t - clipStart });
      }
    }
    if (t === 0) throw new Error("no file could be decoded");
    onProgress({ stage: "render", value: 0.99 * share, label: withAudio ? "audio" : "" });
    blob = await sink.finish(withAudio ? () => mixAudio(t, music, clips, opts) : null);
  } catch (e) {
    await sink.cancel();
    throw e;
  }

  if (viaFfmpeg(opts.format)) {
    onProgress({ stage: "render", value: share, label: opts.format.toUpperCase() });
    const { transcode } = await import("./ffmpeg");
    blob = await transcode(blob, opts, withAudio, (v) => onProgress({
      stage: "render", value: share + (1 - share) * v, label: opts.format.toUpperCase(),
    }), signal);
  }
  onProgress({ stage: "render", value: 1 });
  return { blob, engine: "browser", skipped };
}
