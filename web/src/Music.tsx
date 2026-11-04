import { useRef } from "react";
import { formatDuration } from "./engine/duration";
import { audioDuration, type MusicTransition } from "./engine/playlist";
import type { RenderOptions, Track } from "./engine/types";
import { t } from "./i18n";
import Volume from "./Volume";

const AUDIO_ACCEPT = "audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac";

let nextId = 0;

interface Props {
  tracks: Track[];
  setTracks: (f: (prev: Track[]) => Track[]) => void;
  opts: RenderOptions;
  set: <K extends keyof RenderOptions>(k: K, v: RenderOptions[K]) => void;
  /** Total length of the music playlist (without repeat), or null if unknown. */
  musicSeconds: number | null;
  videoSeconds: number;
  short: boolean;
}

export default function Music({ tracks, setTracks, opts, set, musicSeconds, videoSeconds, short }: Props) {
  const input = useRef<HTMLInputElement>(null);

  async function add(list: FileList) {
    const fresh: Track[] = Array.from(list).map((file) => ({ id: `m${nextId++}`, file }));
    setTracks((p) => [...p, ...fresh]);
    for (const tr of fresh) {
      const duration = await audioDuration(tr.file);
      setTracks((p) => p.map((x) => (x.id === tr.id ? { ...x, duration } : x)));
    }
  }

  function move(i: number, dir: -1 | 1) {
    setTracks((p) => {
      const next = [...p];
      const j = i + dir;
      if (j < 0 || j >= next.length) return p;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <fieldset className="music">
      <legend>{t.audio}</legend>
      {tracks.length > 0 && (
        <ol className="tracks">
          {tracks.map((tr, i) => (
            <li key={tr.id}>
              <span className="tname" title={tr.file.name}>
                {i + 1}. {tr.file.name}
              </span>
              <span className="tdur">
                {tr.duration === undefined ? "…" : tr.duration === null ? "?" : formatDuration(tr.duration)}
              </span>
              <button className="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="up">
                ↑
              </button>
              <button className="icon" disabled={i === tracks.length - 1} onClick={() => move(i, 1)} aria-label="down">
                ↓
              </button>
              <button className="icon" onClick={() => setTracks((p) => p.filter((x) => x.id !== tr.id))} aria-label={t.remove}>
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
      <button className="btn small" onClick={() => input.current?.click()}>
        {t.addMusic}
      </button>
      <input
        ref={input}
        type="file"
        accept={AUDIO_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void add(e.target.files);
          e.target.value = "";
        }}
      />

      {tracks.length > 1 && (
        <div className="pair">
          <label>
            {t.musicTransition}
            <select value={opts.music_transition} onChange={(e) => set("music_transition", e.target.value as MusicTransition)}>
              <option value="crossfade">{t.musicCrossfade}</option>
              <option value="none">{t.musicNone}</option>
              <option value="gap">{t.musicGap}</option>
            </select>
          </label>
          {opts.music_transition !== "none" && (
            <label>
              {opts.music_transition === "gap" ? t.musicGapLength : t.musicCrossfadeLength}
              <input
                type="number"
                min={0.1}
                max={30}
                step={0.5}
                value={opts.music_transition_duration}
                onChange={(e) => set("music_transition_duration", Number(e.target.value))}
              />
            </label>
          )}
        </div>
      )}
      {tracks.length > 0 && (
        <>
          <Volume label={t.musicVolume} value={opts.music_volume} onChange={(v) => set("music_volume", v)} />
          <label className="inline">
            <input type="checkbox" checked={opts.music_loop} onChange={(e) => set("music_loop", e.target.checked)} />
            {t.musicLoop}
          </label>
          <p className={`summary ${short ? "short" : ""}`}>
            {t.musicTotal} <b>{musicSeconds === null ? "?" : formatDuration(musicSeconds)}</b> · {t.videoTotal}{" "}
            <b>{formatDuration(videoSeconds)}</b>
            {short && <span className="hint">{t.musicShort}</span>}
            {!short && musicSeconds !== null && musicSeconds > videoSeconds + 0.05 && (
              <span className="hint muted">{t.musicLong}</span>
            )}
          </p>
        </>
      )}
    </fieldset>
  );
}
