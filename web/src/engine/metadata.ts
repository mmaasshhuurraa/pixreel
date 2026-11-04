/**
 * When a photo or video was taken, for sorting by date.
 * JPEG: EXIF DateTimeOriginal. MP4/MOV: creation time of the movie header.
 * Returns milliseconds since epoch, or null when the file carries no date.
 */

export async function takenAt(file: File): Promise<number | null> {
  try {
    const name = file.name.toLowerCase();
    if (/\.(jpe?g|jfif)$/.test(name) || file.type === "image/jpeg") return await jpegDate(file);
    if (/\.(mp4|m4v|mov)$/.test(name)) return await mp4Date(file);
  } catch {
    /* unreadable metadata: fall back to the file date */
  }
  return null;
}

/** Date for sorting: when it was taken, else when the file was last changed. */
export const sortDate = (it: { takenAt?: number | null; file: File }) => it.takenAt ?? it.file.lastModified;

async function jpegDate(file: File): Promise<number | null> {
  const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  if (buf.getUint16(0) !== 0xffd8) return null;
  let off = 2;
  while (off + 4 < buf.byteLength) {
    const marker = buf.getUint16(off);
    const size = buf.getUint16(off + 2);
    // APP1 with "Exif\0\0"
    if (marker === 0xffe1 && buf.getUint32(off + 4) === 0x45786966) return exifDate(buf, off + 10);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;
    off += 2 + size;
  }
  return null;
}

function exifDate(v: DataView, tiff: number): number | null {
  const le = v.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => v.getUint16(tiff + o, le);
  const u32 = (o: number) => v.getUint32(tiff + o, le);

  const readIfd = (ifd: number) => {
    const tags = new Map<number, number>(); // tag -> offset of its value field
    const n = u16(ifd);
    for (let i = 0; i < n; i++) tags.set(u16(ifd + 2 + i * 12), ifd + 2 + i * 12 + 8);
    return tags;
  };
  const ascii = (valueField: number) => {
    const at = u32(valueField);
    let s = "";
    for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(tiff + at + i));
    return s;
  };
  const parse = (s: string) => {
    const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(s);
    if (!m || m[1] === "0000") return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  };

  const ifd0 = readIfd(u32(4));
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr !== undefined) {
    const exif = readIfd(u32(exifPtr));
    for (const tag of [0x9003, 0x9004]) {
      const f = exif.get(tag);
      const d = f !== undefined ? parse(ascii(f)) : null;
      if (d) return d;
    }
  }
  const dt = ifd0.get(0x0132);
  return dt !== undefined ? parse(ascii(dt)) : null;
}

/** Walks MP4/MOV boxes (reading only headers) to moov/mvhd. */
async function mp4Date(file: File): Promise<number | null> {
  const read = async (pos: number, len: number) => new DataView(await file.slice(pos, pos + len).arrayBuffer());
  const find = async (start: number, end: number, type: string) => {
    let pos = start;
    while (pos + 8 <= end) {
      const h = await read(pos, 16);
      let size = h.getUint32(0);
      const name = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7));
      let header = 8;
      if (size === 1) {
        size = Number(h.getBigUint64(8));
        header = 16;
      } else if (size === 0) size = end - pos;
      if (size < header) return null;
      if (name === type) return { start: pos + header, end: pos + size };
      pos += size;
    }
    return null;
  };
  const moov = await find(0, file.size, "moov");
  if (!moov) return null;
  const mvhd = await find(moov.start, moov.end, "mvhd");
  if (!mvhd) return null;
  const v = await read(mvhd.start, 12);
  const secs = v.getUint8(0) === 1 ? Number(v.getBigUint64(4)) : v.getUint32(4);
  if (!secs) return null;
  // Seconds since 1904-01-01 UTC.
  return (secs - 2082844800) * 1000;
}
