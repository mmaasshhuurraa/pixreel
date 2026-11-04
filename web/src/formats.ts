/**
 * File types the site accepts. Only formats verified to open in the browser are on;
 * the rest need the server (api/), which is not connected yet.
 * To enable a format: uncomment it here, check it end to end, and update `dropHint` in i18n.ts.
 */
export const IMAGE_EXTS = [
  "jpg", "jpeg", "jfif", "png", "apng", "webp", "gif", "bmp", "avif", "svg", "ico",
  // Server only (not checked in the browser yet):
  // "heic", "heif", "jxl", "tif", "tiff", "psd", "tga", "qoi", "dds", "jp2",
  // "exr", "hdr", "xcf", "pdf",
  // "cr2", "cr3", "nef", "arw", "dng", "orf", "raf", "rw2", "pef", "srw",
];

export const VIDEO_EXTS = [
  "mp4", "m4v", "mov", "webm", "mkv",
  // Server only (not checked in the browser yet):
  // "avi", "wmv", "flv", "3gp", "mpg", "mpeg", "ts", "mts", "m2ts", "ogv",
];

const ALL = new Set([...IMAGE_EXTS, ...VIDEO_EXTS]);

export const ACCEPT = [...ALL].map((e) => `.${e}`).join(",");

export function isAccepted(file: File): boolean {
  return ALL.has(file.name.split(".").pop()?.toLowerCase() ?? "");
}
