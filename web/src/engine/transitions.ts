/** Transition effects between two canvases. Mirrors api/app/transitions.py. */

export const TRANSITIONS = [
  "crossfade", "fadeblack", "fadewhite",
  "slideleft", "slideright", "slideup", "slidedown",
  "wipeleft", "wiperight", "wipeup", "wipedown",
  "zoom", "circle",
] as const;

export type Effect = (typeof TRANSITIONS)[number];
export type TransitionChoice = "none" | "random" | Effect;

const smooth = (p: number) => p * p * (3 - 2 * p);

/** Draws the frame at progress p (0..1) of the transition from a to b. */
export function drawTransition(
  ctx: CanvasRenderingContext2D,
  effect: Effect,
  a: HTMLCanvasElement,
  b: HTMLCanvasElement,
  p: number,
) {
  const { width: W, height: H } = ctx.canvas;
  const e = smooth(p);
  ctx.save();
  ctx.globalAlpha = 1;
  const clipRect = (x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  };
  switch (effect) {
    case "crossfade":
      ctx.drawImage(a, 0, 0);
      ctx.globalAlpha = p;
      ctx.drawImage(b, 0, 0);
      break;
    case "fadeblack":
    case "fadewhite": {
      ctx.fillStyle = effect === "fadeblack" ? "#000" : "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = p < 0.5 ? 1 - 2 * p : 2 * p - 1;
      ctx.drawImage(p < 0.5 ? a : b, 0, 0);
      break;
    }
    case "slideleft": {
      const off = Math.round(W * e);
      ctx.drawImage(a, -off, 0);
      ctx.drawImage(b, W - off, 0);
      break;
    }
    case "slideright": {
      const off = Math.round(W * e);
      ctx.drawImage(a, off, 0);
      ctx.drawImage(b, off - W, 0);
      break;
    }
    case "slideup": {
      const off = Math.round(H * e);
      ctx.drawImage(a, 0, -off);
      ctx.drawImage(b, 0, H - off);
      break;
    }
    case "slidedown": {
      const off = Math.round(H * e);
      ctx.drawImage(a, 0, off);
      ctx.drawImage(b, 0, off - H);
      break;
    }
    case "wipeleft":
    case "wiperight":
    case "wipeup":
    case "wipedown": {
      ctx.drawImage(a, 0, 0);
      const ow = Math.round(W * e);
      const oh = Math.round(H * e);
      if (effect === "wipeleft") clipRect(W - ow, 0, ow, H);
      if (effect === "wiperight") clipRect(0, 0, ow, H);
      if (effect === "wipeup") clipRect(0, H - oh, W, oh);
      if (effect === "wipedown") clipRect(0, 0, W, oh);
      ctx.drawImage(b, 0, 0);
      break;
    }
    case "circle": {
      ctx.drawImage(a, 0, 0);
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, (e * Math.hypot(W, H)) / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(b, 0, 0);
      break;
    }
    case "zoom": {
      ctx.drawImage(a, 0, 0);
      const s = 0.5 + 0.5 * e;
      const w = Math.round(W * s);
      const h = Math.round(H * s);
      ctx.globalAlpha = p;
      ctx.drawImage(b, Math.floor((W - w) / 2), Math.floor((H - h) / 2), w, h);
      break;
    }
  }
  ctx.restore();
}

/** Returns the effect for each next transition; "random" picks a new one every time. */
export function picker(choice: TransitionChoice): () => Effect | null {
  if (choice === "none") return () => null;
  if (choice === "random") return () => TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];
  return () => choice;
}
