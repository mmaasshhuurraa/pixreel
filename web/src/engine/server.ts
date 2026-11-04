/** Client for the PixReel HTTP API (api/). */
import type { Item, Progress, RenderOptions, RenderResult } from "./types";

const STORAGE_KEY = "pixreel.apiUrl";

export function getApiUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved.replace(/\/+$/, "");
  } catch {
    /* storage may be blocked */
  }
  return (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
}

export function setApiUrl(url: string) {
  try {
    if (url) localStorage.setItem(STORAGE_KEY, url);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function checkServer(base = getApiUrl()): Promise<boolean> {
  if (!base) return false;
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch {
    return false;
  }
}

function upload(url: string, body: FormData, onProgress: (v: number) => void, signal: AbortSignal): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status < 300 ? resolve(xhr.response) : reject(new Error(xhr.response?.detail ?? `HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error("network error: server unreachable"));
    signal.addEventListener("abort", () => {
      xhr.abort();
      reject(new DOMException("cancelled", "AbortError"));
    });
    xhr.send(body);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function renderOnServer(
  items: Item[],
  opts: RenderOptions,
  audio: File[],
  onProgress: (p: Progress) => void,
  signal: AbortSignal,
): Promise<RenderResult> {
  const base = getApiUrl();
  if (!base) throw new Error("API URL is not configured");

  const form = new FormData();
  for (const it of items) form.append("files", it.file, it.file.name);
  for (const track of audio) form.append("audio", track, track.name);
  for (const [k, v] of Object.entries(opts)) form.append(k, String(v));

  const job = await upload(`${base}/v1/jobs`, form, (v) => onProgress({ stage: "upload", value: v }), signal);

  let status = job;
  while (status.status === "queued" || status.status === "processing") {
    await sleep(1000);
    if (signal.aborted) {
      void fetch(`${base}/v1/jobs/${job.id}`, { method: "DELETE" });
      throw new DOMException("cancelled", "AbortError");
    }
    const r = await fetch(`${base}/v1/jobs/${job.id}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    status = await r.json();
    onProgress({ stage: "render", value: status.progress, label: status.message });
  }
  if (status.status !== "done") throw new Error(status.error ?? "conversion failed");

  onProgress({ stage: "download", value: 0 });
  const r = await fetch(`${base}${status.result.url}`, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob = await r.blob();
  void fetch(`${base}/v1/jobs/${job.id}`, { method: "DELETE" });
  return { blob, engine: "server", skipped: status.result.skipped ?? [] };
}
