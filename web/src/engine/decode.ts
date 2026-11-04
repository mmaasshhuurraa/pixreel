/** Image decoding in the browser. Anything that fails here is sent to the API. */

export type Drawable = ImageBitmap | HTMLImageElement | VideoFrame;

export interface DecodedFrame {
  image: Drawable;
  width: number;
  height: number;
  /** Frame duration in seconds for animations, undefined for still images. */
  duration?: number;
  close(): void;
}

const ANIMATED_TYPES = new Set(["image/gif", "image/webp", "image/png", "image/apng", "image/avif"]);

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

/** Yields all frames of an animation, or the single frame of a still image. */
export async function* decodeFrames(file: File, animate: boolean): AsyncGenerator<DecodedFrame> {
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
            duration: Math.max(0.02, (frame.duration ?? 100_000) / 1e6),
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

/** Returns a small preview data URL, or null if the browser cannot decode the file. */
export async function makeThumb(file: File, size = 240): Promise<string | null> {
  try {
    const f = await decodeStill(file);
    const scale = Math.min(1, size / Math.max(f.width, f.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(f.width * scale));
    c.height = Math.max(1, Math.round(f.height * scale));
    c.getContext("2d")!.drawImage(f.image, 0, 0, c.width, c.height);
    f.close();
    return c.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}
