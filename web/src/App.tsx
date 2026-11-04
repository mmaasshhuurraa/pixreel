import { useEffect, useMemo, useRef, useState } from "react";
import { kindOf, probe } from "./engine/decode";
import { formatDuration, itemEstimate, totalEstimate } from "./engine/duration";
import { ACCEPT, isAccepted } from "./formats";
import { BrowserUnsupported, browserCanRender, renderInBrowser } from "./engine/browser";
// setApiUrl is used by the hidden "Where to convert" block below.
import { checkServer, getApiUrl, renderOnServer /*, setApiUrl */ } from "./engine/server";
import { defaultOptions, type EngineChoice, type Item, type Progress, type RenderOptions, type RenderResult } from "./engine/types";
import { t } from "./i18n";

const PRESETS = [
  { label: `${t.presetLandscape} 1080p`, w: 1920, h: 1080 },
  { label: `${t.presetLandscape} 720p`, w: 1280, h: 720 },
  { label: `${t.presetLandscape} 4K`, w: 3840, h: 2160 },
  { label: `${t.presetPortrait} 1080×1920`, w: 1080, h: 1920 },
  { label: `${t.presetSquare} 1080×1080`, w: 1080, h: 1080 },
];

let nextId = 0;

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [opts, setOpts] = useState<RenderOptions>(defaultOptions);
  const [audio, setAudio] = useState<File | null>(null);
  // Setters are used by the hidden "Where to convert" block below.
  const [engine /*, setEngine */] = useState<EngineChoice>("auto");
  const [apiUrl /*, setApiUrlState */] = useState(getApiUrl());
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<(RenderResult & { url: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const dragIndex = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setServerOk(null);
    const id = setTimeout(() => checkServer(apiUrl).then(setServerOk), 400);
    return () => clearTimeout(id);
  }, [apiUrl]);

  const set = <K extends keyof RenderOptions>(k: K, v: RenderOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  async function addFiles(list: FileList | File[]) {
    const all = Array.from(list);
    const files = all.filter(isAccepted);
    setRejected(all.filter((f) => !isAccepted(f)).map((f) => f.name));
    const fresh: Item[] = files.map((file) => ({
      id: String(nextId++), file, kind: kindOf(file), thumb: null, browserOk: null,
    }));
    setItems((prev) => [...prev, ...fresh]);
    for (const it of fresh) {
      const info = await probe(it.file);
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, ...info } : p)));
    }
  }

  function move(from: number, to: number) {
    setItems((prev) => {
      const next = [...prev];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  }

  const estimate = useMemo(() => totalEstimate(items, opts), [items, opts]);
  const hasVideo = items.some((i) => i.kind === "video");
  const totalLabel = `${estimate.exact ? "" : "≈ "}${formatDuration(estimate.seconds)}`;

  const needsServer = items.some((i) => i.browserOk === false);

  async function convert() {
    setError(null);
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgress({ stage: "render", value: 0 });
    try {
      let useBrowser = engine === "browser";
      if (engine === "auto") {
        useBrowser = !needsServer && (await browserCanRender(opts, !!audio));
        if (!useBrowser && !serverOk) {
          useBrowser = !needsServer && opts.format !== "gif";
          if (!useBrowser) throw new Error(t.needServer);
        }
      }
      let res: RenderResult;
      try {
        res = useBrowser
          ? await renderInBrowser(items, opts, audio, setProgress, ctrl.signal)
          : await renderOnServer(items, opts, audio, setProgress, ctrl.signal);
      } catch (e) {
        // Browser can't encode this? Retry on the server in auto mode.
        if (e instanceof BrowserUnsupported && engine === "auto" && serverOk) {
          res = await renderOnServer(items, opts, audio, setProgress, ctrl.signal);
        } else if (e instanceof BrowserUnsupported) {
          throw new Error(t.browserCannot);
        } else throw e;
      }
      setResult({ ...res, url: URL.createObjectURL(res.blob) });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  const presetIndex = PRESETS.findIndex((p) => p.w === opts.width && p.h === opts.height);
  const busy = progress !== null;

  return (
    <div className="app">
      <header>
        <h1>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={32} height={32} /> PixReel
        </h1>
        <p>{t.tagline}</p>
      </header>

      <main>
        <section className="left">
          <div
            className={`drop ${dragOver ? "over" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              if (dragIndex.current !== null) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              if (dragIndex.current !== null) return;
              e.preventDefault();
              setDragOver(false);
              void addFiles(e.dataTransfer.files);
            }}
          >
            <strong>{t.drop}</strong>
            <span>{t.dropHint}</span>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {rejected.length > 0 && (
            <p className="warn">
              {t.rejected} {rejected.join(", ")}
            </p>
          )}

          {items.length > 0 && (
            <>
              <div className="toolbar">
                <span>
                  {t.files}: {items.length} · {t.estimate} <b>{totalLabel}</b>
                </span>
                <span>
                  <button
                    className="link"
                    onClick={() =>
                      setItems((p) => [...p].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })))
                    }
                  >
                    {t.sortName}
                  </button>
                  <button className="link" onClick={() => setItems([])}>
                    {t.clear}
                  </button>
                </span>
              </div>
              <ol className="grid">
                {items.map((it, i) => (
                  <li
                    key={it.id}
                    draggable
                    onDragStart={() => (dragIndex.current = i)}
                    onDragEnd={() => (dragIndex.current = null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex.current !== null && dragIndex.current !== i) move(dragIndex.current, i);
                      dragIndex.current = null;
                    }}
                    title={it.file.name}
                  >
                    {it.thumb ? (
                      <img src={it.thumb} alt="" />
                    ) : (
                      <div className="ext">
                        {it.file.name.split(".").pop()?.toUpperCase()}
                        {it.browserOk === false && <small>{t.serverOnly}</small>}
                      </div>
                    )}
                    <span className="num">{i + 1}</span>
                    <button className="x" aria-label={t.remove} onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
                      ×
                    </button>
                    <span className="dur">
                      {it.kind === "video" && "▶ "}
                      {(() => {
                        const e = itemEstimate(it, opts);
                        if (it.browserOk === null) return "…";
                        if (!e.exact && e.seconds === 0) return "?";
                        return `${e.exact ? "" : "≈"}${formatDuration(e.seconds)}`;
                      })()}
                    </span>
                    <span className="name">{it.file.name}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {result && (
            <div className="result">
              <h2>{t.result}</h2>
              {opts.format === "gif" || result.blob.type === "image/gif" ? (
                <img src={result.url} alt="" />
              ) : (
                <video src={result.url} controls playsInline />
              )}
              <div className="row">
                <a className="btn" href={result.url} download={`pixreel.${result.blob.type.split("/")[1]}`}>
                  {t.save} ({(result.blob.size / 1048576).toFixed(1)} MB)
                </a>
                <span className="muted">
                  {t.renderedBy}
                  {result.engine === "browser" ? t.engineBrowser : t.engineServer}
                </span>
              </div>
              {result.skipped.length > 0 && (
                <p className="warn">
                  {t.skipped} {result.skipped.join("; ")}
                </p>
              )}
            </div>
          )}
        </section>

        <aside>
          <h2>{t.settings}</h2>
          <label>
            {t.size}
            <select
              value={presetIndex}
              onChange={(e) => {
                const p = PRESETS[Number(e.target.value)];
                if (p) setOpts((o) => ({ ...o, width: p.w, height: p.h }));
              }}
            >
              {PRESETS.map((p, i) => (
                <option key={i} value={i}>
                  {p.label}
                </option>
              ))}
              <option value={-1}>{t.custom}</option>
            </select>
          </label>
          <div className="pair">
            <input type="number" min={16} max={3840} value={opts.width} onChange={(e) => set("width", Number(e.target.value))} />
            ×
            <input type="number" min={16} max={3840} value={opts.height} onChange={(e) => set("height", Number(e.target.value))} />
          </div>
          <div className="pair">
            <label>
              {t.duration}
              <input type="number" min={0.04} max={60} step={0.1} value={opts.duration} onChange={(e) => set("duration", Number(e.target.value))} />
            </label>
            <label>
              {t.fps}
              <input type="number" min={1} max={60} value={opts.fps} onChange={(e) => set("fps", Number(e.target.value))} />
            </label>
          </div>
          <label>
            {t.fit}
            <select value={opts.fit} onChange={(e) => set("fit", e.target.value as RenderOptions["fit"])}>
              <option value="blur">{t.fitBlur}</option>
              <option value="contain">{t.fitContain}</option>
              <option value="cover">{t.fitCover}</option>
            </select>
          </label>
          {opts.fit === "contain" && (
            <label className="inline">
              {t.background}
              <input type="color" value={opts.background} onChange={(e) => set("background", e.target.value)} />
            </label>
          )}
          <div className="pair">
            <label>
              {t.transition}
              <select value={opts.transition} onChange={(e) => set("transition", e.target.value as RenderOptions["transition"])}>
                <option value="crossfade">{t.crossfade}</option>
                <option value="none">{t.none}</option>
              </select>
            </label>
            {opts.transition === "crossfade" && (
              <label>
                {t.transitionDuration}
                <input
                  type="number"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={opts.transition_duration}
                  onChange={(e) => set("transition_duration", Number(e.target.value))}
                />
              </label>
            )}
          </div>
          <div className="pair">
            <label>
              {t.format}
              <select value={opts.format} onChange={(e) => set("format", e.target.value as RenderOptions["format"])}>
                <option value="mp4">MP4 (H.264)</option>
                <option value="webm">WebM (VP9)</option>
                {/* GIF needs the server (api/), which is not connected yet. */}
                {/* <option value="gif">GIF</option> */}
              </select>
            </label>
            <label>
              {t.quality}
              <select value={opts.quality} onChange={(e) => set("quality", e.target.value as RenderOptions["quality"])}>
                <option value="low">{t.low}</option>
                <option value="medium">{t.medium}</option>
                <option value="high">{t.high}</option>
              </select>
            </label>
          </div>
          <label className="inline">
            <input type="checkbox" checked={opts.animate} onChange={(e) => set("animate", e.target.checked)} />
            {t.animate}
          </label>
          {hasVideo && opts.format !== "gif" && (
            <label className="inline">
              <input type="checkbox" checked={opts.video_audio} onChange={(e) => set("video_audio", e.target.checked)} />
              {t.videoAudio}
            </label>
          )}
          {opts.format !== "gif" && (
            <label>
              {t.audio}
              <input type="file" accept="audio/*" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} />
            </label>
          )}

          {/* TODO: "Where to convert" block is hidden for now; engine stays "auto".
          <fieldset>
            <legend>{t.engine}</legend>
            <div className="seg">
              {(["auto", "browser", "server"] as const).map((e) => (
                <button key={e} className={engine === e ? "on" : ""} onClick={() => setEngine(e)}>
                  {e === "auto" ? t.engineAuto : e === "browser" ? t.engineBrowser : t.engineServer}
                </button>
              ))}
            </div>
            <small className="muted">{t.engineHint}</small>
            <label>
              {t.apiUrl}
              <input
                type="url"
                placeholder="https://…hf.space"
                value={apiUrl}
                onChange={(e) => {
                  setApiUrlState(e.target.value);
                  setApiUrl(e.target.value);
                }}
              />
            </label>
            {apiUrl && (
              <small className={serverOk ? "ok" : "muted"}>
                ● {serverOk === null ? "…" : serverOk ? t.serverOk : t.serverDown}
                {serverOk && (
                  <>
                    {" · "}
                    <a href={`${apiUrl}/docs`} target="_blank" rel="noreferrer">
                      {t.apiDocs}
                    </a>
                  </>
                )}
              </small>
            )}
          </fieldset> */}

          {busy ? (
            <div className="progress">
              <div className="bar">
                <div style={{ width: `${Math.round(progress.value * 100)}%` }} />
              </div>
              <small>
                {t[progress.stage]} {Math.round(progress.value * 100)}% {progress.label ?? ""}
              </small>
              <button className="btn ghost" onClick={() => abortRef.current?.abort()}>
                {t.cancel}
              </button>
            </div>
          ) : (
            <button className="btn primary" disabled={items.length === 0} onClick={convert}>
              {t.convert}
              {items.length > 0 && ` · ${totalLabel}`}
            </button>
          )}
          {error && <p className="error">{error}</p>}
        </aside>
      </main>
    </div>
  );
}
