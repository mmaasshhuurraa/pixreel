/**
 * AVI and WMV via ffmpeg.wasm (loaded on first use, ~32 MB, served from this site).
 * The video is first rendered to MP4 with WebCodecs, then transcoded here.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";
import type { RenderOptions } from "./types";

let instance: Promise<FFmpeg> | null = null;

function load(): Promise<FFmpeg> {
  instance ??= (async () => {
    const ff = new FFmpeg();
    await ff.load({ coreURL, wasmURL });
    return ff;
  })().catch((e) => {
    instance = null;
    throw e;
  });
  return instance;
}

const AVI_Q = { low: 8, medium: 5, high: 3 };
const WMV_BPP = { low: 0.05, medium: 0.1, high: 0.18 };

export async function transcode(
  mp4: Blob,
  opts: RenderOptions,
  hasAudio: boolean,
  onProgress: (v: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  const ff = await load();
  const onAbort = () => ff.terminate();
  signal.addEventListener("abort", onAbort);
  const progress = ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)));
  ff.on("progress", progress);
  try {
    await ff.writeFile("in.mp4", new Uint8Array(await mp4.arrayBuffer()));
    const out = `out.${opts.format}`;
    const video =
      opts.format === "avi"
        ? ["-c:v", "mpeg4", "-vtag", "xvid", "-q:v", String(AVI_Q[opts.quality])]
        : ["-c:v", "wmv2", "-b:v", String(Math.round(opts.width * opts.height * opts.fps * WMV_BPP[opts.quality]))];
    const audio = !hasAudio
      ? ["-an"]
      : opts.format === "avi"
        ? ["-c:a", "libmp3lame", "-b:a", "192k"]
        : ["-c:a", "wmav2", "-b:a", "192k"];
    const code = await ff.exec(["-i", "in.mp4", ...video, ...audio, out]);
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
    const data = (await ff.readFile(out)) as Uint8Array;
    await ff.deleteFile("in.mp4");
    await ff.deleteFile(out);
    return new Blob([data.slice()], { type: opts.format === "avi" ? "video/x-msvideo" : "video/x-ms-wmv" });
  } finally {
    ff.off("progress", progress);
    signal.removeEventListener("abort", onAbort);
    if (signal.aborted) instance = null;
  }
}
