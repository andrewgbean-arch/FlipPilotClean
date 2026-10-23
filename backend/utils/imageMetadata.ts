/**
 * Takes the hidden details out of a picture before it is kept.
 *
 * A phone saves more in a photo file than the picture: where it was taken (GPS), when, which phone
 * and settings, often a small copy of the shot, sometimes the name of the person or of the editing
 * program. A photo here is public once it is on a listing, so none of that may go with it.
 *
 * This works on the file's own structure and never on the picture. It walks the file block by block
 * and writes out only the blocks needed to draw it. The compressed picture data is copied byte for
 * byte, so nothing is decoded or squeezed again and the picture cannot come out looking different.
 *   JPEG  keeps the picture and its tables, the JFIF header (without any thumbnail inside it), the
 *         colour profile (APP2) and Adobe's colour flag (APP14). Exif, XMP, IPTC/Photoshop,
 *         comments, other makers' blocks and anything after the end of the picture are left out.
 *   PNG   keeps the picture and the chunks that change how it is drawn. Text, Exif, the time stamp,
 *         chunks nobody has registered and anything after the end are left out.
 *   WebP  keeps the picture, colour profile, transparency and animation. Exif and XMP are left out.
 *
 * One thing is kept on purpose: which way up the photo is. A phone often saves a photo sideways and
 * writes "turn it a quarter" in its Exif; without that the photo would show on its side. So when the
 * Exif holds an Orientation other than "normal", a new Exif block holding only that number goes back
 * in. It says nothing about who, where or when.
 *
 * A file that cannot be read this closely (damaged, cut short, or not the kind of file it claims to
 * be) is refused with UnreadableImageError. It is never kept as it came, because then its details
 * would go public.
 */

export type ImageKind = "jpg" | "png" | "webp";

/** The file is not a picture we can read all the way through. The message is fit to show a person. */
export class UnreadableImageError extends Error {
  /** What was wrong, for logs and tests. Never shown to a person. */
  readonly reason: string;

  constructor(reason: string) {
    super("That photo couldn't be read. It may be damaged. Please take it again or choose a different one.");
    this.name = "UnreadableImageError";
    this.reason = reason;
  }
}

function unreadable(reason: string): never {
  throw new UnreadableImageError(reason);
}

const startsWith = (buffer: Buffer, text: string) =>
  buffer.length >= text.length && buffer.toString("latin1", 0, text.length) === text;

/* ------------------------------ Exif orientation ------------------------------ */

/** The Orientation (1 to 8) in an Exif block laid out as a TIFF file, or null if it holds no sane one. */
function readOrientation(tiff: Buffer): number | null {
  if (tiff.length < 8) return null;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  if (!little && !(tiff[0] === 0x4d && tiff[1] === 0x4d)) return null;
  const u16 = (at: number) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at: number) => (little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  if (u16(2) !== 42) return null;

  const directory = u32(4);
  if (directory < 8 || directory + 2 > tiff.length) return null;
  const entries = u16(directory);
  for (let i = 0; i < entries; i++) {
    const entry = directory + 2 + i * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) !== 0x0112) continue;
    const type = u16(entry + 2);
    const value = type === 3 ? u16(entry + 8) : type === 4 ? u32(entry + 8) : type === 1 ? tiff[entry + 8] : 0;
    return value >= 1 && value <= 8 ? value : null;
  }
  return null;
}

/** An Exif block that holds the Orientation and nothing else. */
function orientationOnly(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write("MM", 0, "latin1");
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4); // the one directory starts right after this header
  tiff.writeUInt16BE(1, 8); // it has one entry:
  tiff.writeUInt16BE(0x0112, 10); // the Orientation,
  tiff.writeUInt16BE(3, 12); // a 16-bit number,
  tiff.writeUInt32BE(1, 14); // one of them,
  tiff.writeUInt16BE(orientation, 18); // kept in the entry itself (bytes 20 and 21 stay empty)
  tiff.writeUInt32BE(0, 22); // and there is no other directory after it
  return tiff;
}

/* ------------------------------------ JPEG ------------------------------------ */

// Tables and headers the picture cannot be decoded without: DHT, DAC, DQT, DNL, DRI, DHP, EXP.
const JPEG_TABLE_MARKERS = new Set([0xc4, 0xcc, 0xdb, 0xdc, 0xdd, 0xde, 0xdf]);

const jpegSegment = (marker: number, body: Buffer) =>
  Buffer.concat([Buffer.from([0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff]), body]);

function stripJpeg(src: Buffer): Buffer {
  if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) unreadable("jpeg: no start marker");

  const out: Buffer[] = [src.subarray(0, 2)];
  let pos = 2;
  let sawFrame = false;
  let sawScan = false;
  let sawExif = false;

  for (;;) {
    // What comes next is always a marker: 0xFF, which may be repeated as padding, then its code.
    if (src[pos] !== 0xff) unreadable("jpeg: expected a marker");
    while (src[pos] === 0xff) pos++;
    if (pos >= src.length) unreadable("jpeg: ends inside a marker");
    const marker = src[pos++];

    if (marker === 0xd9) {
      if (!sawScan) unreadable("jpeg: no picture data");
      out.push(Buffer.from([0xff, 0xd9]));
      return Buffer.concat(out); // whatever follows the end of the picture is not kept
    }
    // These carry no length and have no place between segments.
    if (marker === 0x00 || marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      unreadable("jpeg: marker out of place");
    }

    if (pos + 2 > src.length) unreadable("jpeg: ends inside a segment");
    const length = src.readUInt16BE(pos);
    if (length < 2 || pos + length > src.length) unreadable("jpeg: a segment runs past the end");
    const body = src.subarray(pos + 2, pos + length);
    const whole = src.subarray(pos - 2, pos + length); // the 0xFF, the code, the length and the body
    pos += length;

    if (marker === 0xda) {
      if (!sawFrame) unreadable("jpeg: picture data before its header");
      sawScan = true;
      out.push(whole);
      // The compressed data runs to the next real marker. Inside it an 0xFF is followed by 0x00 (it
      // was a data byte) or by a restart marker (0xD0 to 0xD7); anything else ends it. A progressive
      // picture has several of these, with tables between them.
      let stop = pos;
      for (;;) {
        const ff = src.indexOf(0xff, stop);
        if (ff < 0) unreadable("jpeg: picture data runs off the end");
        let next = ff + 1;
        while (src[next] === 0xff) next++;
        if (next >= src.length) unreadable("jpeg: picture data runs off the end");
        const code = src[next];
        if (code === 0x00 || (code >= 0xd0 && code <= 0xd7)) {
          stop = next + 1;
          continue;
        }
        stop = ff;
        break;
      }
      out.push(src.subarray(pos, stop));
      pos = stop;
      continue;
    }

    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      sawFrame = true; // the picture's size and make-up
      out.push(whole);
    } else if (JPEG_TABLE_MARKERS.has(marker)) {
      out.push(whole);
    } else if (marker === 0xe0) {
      // JFIF: keep its version and pixel density, without any little picture it may carry inside.
      if (body.length >= 14 && startsWith(body, "JFIF\0")) {
        out.push(Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), body.subarray(0, 12), Buffer.alloc(2)]));
      }
    } else if (marker === 0xe1) {
      // Exif, XMP and every other kind of APP1 go. Of the Exif only the Orientation comes back,
      // in the place the Exif was, and only when it isn't "normal".
      if (!sawExif && startsWith(body, "Exif\0\0")) {
        sawExif = true;
        const orientation = readOrientation(body.subarray(6));
        if (orientation && orientation > 1) {
          out.push(jpegSegment(0xe1, Buffer.concat([Buffer.from("Exif\0\0", "latin1"), orientationOnly(orientation)])));
        }
      }
    } else if (marker === 0xe2) {
      if (startsWith(body, "ICC_PROFILE\0")) out.push(whole); // colour; other APP2 (multi-picture index) goes
    } else if (marker === 0xee) {
      if (startsWith(body, "Adobe")) out.push(whole); // says how to read the colours
    } else if ((marker >= 0xe3 && marker <= 0xef) || marker === 0xfe) {
      // IPTC and Photoshop (APP13), makers' blocks, comments: not kept.
    } else {
      unreadable("jpeg: a marker this check does not know");
    }
  }
}

/* ------------------------------------- PNG ------------------------------------ */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_NEEDED = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
// Extra chunks that change how the picture is drawn (colour, transparency, background, animation).
const PNG_KEPT = new Set([
  "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "bKGD", "hIST", "pHYs", "sPLT",
  "cICP", "mDCV", "cLLI", "acTL", "fcTL", "fdAT",
]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(...parts: Buffer[]): number {
  let c = 0xffffffff;
  for (const part of parts) for (const byte of part) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(head.subarray(4), data), 0);
  return Buffer.concat([head, data, tail]);
}

function stripPng(src: Buffer): Buffer {
  if (src.length < 8 + 12 || !src.subarray(0, 8).equals(PNG_SIGNATURE)) unreadable("png: bad signature");

  const out: Buffer[] = [PNG_SIGNATURE];
  let orientation: number | null = null;
  let chunks = 0;
  let sawPicture = false;
  let finished = false;

  for (let pos = 8; pos + 12 <= src.length; ) {
    const length = src.readUInt32BE(pos);
    const end = pos + 12 + length; // length, name, data, checksum
    if (length > 0x7fffffff || end > src.length) unreadable("png: a chunk runs past the end");
    const type = src.toString("latin1", pos + 4, pos + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) unreadable("png: bad chunk name");
    if (chunks++ === 0 && (type !== "IHDR" || length !== 13)) unreadable("png: no header chunk first");

    if (PNG_NEEDED.has(type) || PNG_KEPT.has(type)) {
      out.push(src.subarray(pos, end));
      if (type === "IDAT") sawPicture = true;
    } else if (type === "eXIf") {
      if (orientation === null) orientation = readOrientation(src.subarray(pos + 8, pos + 8 + length));
    } else if ((type.charCodeAt(0) & 0x20) === 0) {
      unreadable("png: a required chunk this check does not know"); // a decoder could not draw it either
    }
    // Everything else (text, XMP, time stamp, unregistered chunks) is not kept.

    pos = end;
    if (type === "IEND") {
      finished = true; // whatever follows is not kept
      break;
    }
  }
  if (!finished || !sawPicture) unreadable("png: no picture data or no end");

  // Right after the header chunk, which is out[1].
  if (orientation !== null && orientation > 1) out.splice(2, 0, pngChunk("eXIf", orientationOnly(orientation)));
  return Buffer.concat(out);
}

/* ------------------------------------- WebP ----------------------------------- */

function webpChunk(id: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.write(id, 0, "latin1");
  head.writeUInt32LE(data.length, 4);
  return Buffer.concat(data.length & 1 ? [head, data, Buffer.alloc(1)] : [head, data]);
}

function stripWebp(src: Buffer): Buffer {
  if (src.length < 20 || !startsWith(src, "RIFF") || src.toString("latin1", 8, 12) !== "WEBP") {
    unreadable("webp: not a WebP file");
  }
  const end = 8 + src.readUInt32LE(4);
  if (end > src.length || end < 20) unreadable("webp: the stated size does not fit the file");

  const kept: Buffer[] = [];
  let extended: Buffer | null = null; // a copy of the extended header's contents, whose flags are redone below
  let orientation: number | null = null;
  let sawPicture = false;

  for (let pos = 12; pos + 8 <= end; ) {
    const id = src.toString("latin1", pos, pos + 4);
    const size = src.readUInt32LE(pos + 4);
    const dataEnd = pos + 8 + size;
    if (dataEnd > end) unreadable("webp: a block runs past the end");
    const data = src.subarray(pos + 8, dataEnd);
    pos = dataEnd + (size & 1); // blocks are padded to an even length

    if (kept.length === 0 && id !== "VP8X" && id !== "VP8 " && id !== "VP8L") unreadable("webp: no picture first");
    if (id === "VP8X") {
      if (kept.length > 0 || size < 10) unreadable("webp: bad extended header");
      extended = Buffer.from(data);
      kept.push(Buffer.alloc(0)); // its place; filled in once the flags are known
    } else if (id === "VP8 " || id === "VP8L" || id === "ANMF") {
      sawPicture = true;
      kept.push(webpChunk(id, data));
    } else if (id === "ICCP" || id === "ANIM" || id === "ALPH") {
      kept.push(webpChunk(id, data));
    } else if (id === "EXIF") {
      if (orientation === null) orientation = readOrientation(startsWith(data, "Exif\0\0") ? data.subarray(6) : data);
    }
    // XMP and any block nobody has registered are not kept.
  }
  if (!sawPicture) unreadable("webp: no picture data");

  // The extended header says which extra blocks are there, so it must now say none, except the
  // Orientation block if one goes back. (A plain file has no room for either.)
  if (extended) {
    const keepsOrientation = orientation !== null && orientation > 1;
    extended[0] = (extended[0] & ~(0x08 | 0x04)) | (keepsOrientation ? 0x08 : 0);
    kept[0] = webpChunk("VP8X", extended);
    if (keepsOrientation) kept.push(webpChunk("EXIF", orientationOnly(orientation as number)));
  }

  const body = Buffer.concat([Buffer.from("WEBP", "latin1"), ...kept]);
  const head = Buffer.alloc(8);
  head.write("RIFF", 0, "latin1");
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

/* ------------------------------------------------------------------------------ */

/**
 * The picture with everything but the picture taken out (see the top of this file). Returns a new
 * buffer and leaves the one it was given alone. Throws UnreadableImageError for a file it can't read.
 */
export function stripImageMetadata(buffer: Buffer, kind: ImageKind): Buffer {
  if (kind === "jpg") return stripJpeg(buffer);
  if (kind === "png") return stripPng(buffer);
  return stripWebp(buffer);
}
