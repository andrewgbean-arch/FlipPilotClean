import assert from "node:assert/strict";
import zlib from "zlib";

/**
 * Pictures built by hand for the photo-privacy tests. They are small enough to read the bytes of, and
 * carry the hidden details a phone adds (Exif with GPS, XMP, IPTC, comments, a thumbnail) so the tests
 * can prove those are gone. The readers here (a JPEG decoder, a PNG decoder, strict walkers) are written
 * apart from the code under test on purpose: they are what says a result is still a good picture.
 */

/* ------------------------------------ bytes ----------------------------------- */

export const ascii = (text: string) => Buffer.from(text, "latin1");
export const has = (buffer: Buffer, text: string) => buffer.includes(ascii(text));

const u16 = (n: number, little = false): Buffer => {
  const b = Buffer.alloc(2);
  if (little) b.writeUInt16LE(n);
  else b.writeUInt16BE(n);
  return b;
};
const u32 = (n: number, little = false): Buffer => {
  const b = Buffer.alloc(4);
  if (little) b.writeUInt32LE(n);
  else b.writeUInt32BE(n);
  return b;
};

/** Words that appear only inside the hidden details, so finding one in a result means a leak. */
export const SECRETS = {
  make: "FlipPilotTestCamera",
  model: "Model-ZX-9000",
  software: "PhotoEditorPro 12.3",
  dateTime: "2026:10:23 12:34:56",
  artist: "Jane Q Photographer",
  copyright: "Copyright Jane Q 2026",
  owner: "OwnerNameXYZ",
  serial: "SERIAL-0042-4242",
  maker: "MAKERNOTE-SECRET-BYTES",
  xmp: "XMP-SECRET-LOCATION",
  iptc: "IPTC-SECRET-BYLINE",
  comment: "COMMENT-SECRET-TEXT",
  block: "MAKER-BLOCK-SECRET",
  text: "TEXT-CHUNK-SECRET",
  pngTime: "PNG-TIME-SECRET",
};
export const SECRET_WORDS = Object.values(SECRETS);

/* ------------------------------------ Exif ------------------------------------ */

type Entry = { tag: number; type: number; count: number; value: Buffer };

function tiffWriter(little: boolean) {
  return {
    ascii: (tag: number, text: string): Entry => ({ tag, type: 2, count: text.length + 1, value: ascii(text + "\0") }),
    short: (tag: number, n: number): Entry => ({ tag, type: 3, count: 1, value: u16(n, little) }),
    long: (tag: number, n: number): Entry => ({ tag, type: 4, count: 1, value: u32(n, little) }),
    bytes: (tag: number, values: number[]): Entry => ({ tag, type: 1, count: values.length, value: Buffer.from(values) }),
    opaque: (tag: number, data: Buffer): Entry => ({ tag, type: 7, count: data.length, value: data }),
    rationals: (tag: number, pairs: Array<[number, number]>): Entry => ({
      tag,
      type: 5,
      count: pairs.length,
      value: Buffer.concat(pairs.flatMap(([a, b]) => [u32(a, little), u32(b, little)])),
    }),
    /** One directory as it sits at offset `at`: the table, then what did not fit in the table. */
    directory(entries: Entry[], at: number, next: number): Buffer {
      const table = Buffer.alloc(2 + entries.length * 12 + 4);
      u16(entries.length, little).copy(table, 0);
      let spill = at + table.length;
      const extra: Buffer[] = [];
      entries.forEach((entry, i) => {
        const o = 2 + i * 12;
        u16(entry.tag, little).copy(table, o);
        u16(entry.type, little).copy(table, o + 2);
        u32(entry.count, little).copy(table, o + 4);
        if (entry.value.length <= 4) {
          entry.value.copy(table, o + 8);
        } else {
          u32(spill, little).copy(table, o + 8);
          const padded = entry.value.length & 1 ? Buffer.concat([entry.value, Buffer.alloc(1)]) : entry.value;
          extra.push(padded);
          spill += padded.length;
        }
      });
      u32(next, little).copy(table, 2 + entries.length * 12);
      return Buffer.concat([table, ...extra]);
    },
  };
}

export type ExifOptions = {
  little?: boolean;
  orientation?: number;
  gps?: boolean;
  thumbnail?: Buffer;
};

/** An Exif block laid out as a TIFF file, as a phone writes it: who, what, when, GPS, a thumbnail. */
export function exifTiff(opts: ExifOptions = {}): Buffer {
  const little = !!opts.little;
  const t = tiffWriter(little);

  const ifd0 = (exifAt: number, gpsAt: number, next: number) =>
    t.directory(
      [
        t.ascii(0x010f, SECRETS.make),
        t.ascii(0x0110, SECRETS.model),
        ...(opts.orientation === undefined ? [] : [t.short(0x0112, opts.orientation)]),
        t.ascii(0x0131, SECRETS.software),
        t.ascii(0x0132, SECRETS.dateTime),
        t.ascii(0x013b, SECRETS.artist),
        t.ascii(0x8298, SECRETS.copyright),
        t.long(0x8769, exifAt),
        ...(opts.gps ? [t.long(0x8825, gpsAt)] : []),
      ],
      8,
      next
    );
  const exifIfd = (at: number) =>
    t.directory(
      [
        t.ascii(0x9003, SECRETS.dateTime),
        t.opaque(0x927c, ascii(SECRETS.maker)),
        t.ascii(0xa430, SECRETS.owner),
        t.ascii(0xa431, SECRETS.serial),
      ],
      at,
      0
    );
  // Eiffel Tower: 48 51' 29.60" N, 2 17' 40.20" E.
  const gpsIfd = (at: number) =>
    t.directory(
      [
        t.bytes(0x0000, [2, 3, 0, 0]),
        t.ascii(0x0001, "N"),
        t.rationals(0x0002, [[48, 1], [51, 1], [2960, 100]]),
        t.ascii(0x0003, "E"),
        t.rationals(0x0004, [[2, 1], [17, 1], [4020, 100]]),
      ],
      at,
      0
    );
  const thumbIfd = (at: number, thumbAt: number) =>
    t.directory([t.short(0x0103, 6), t.long(0x0201, thumbAt), t.long(0x0202, opts.thumbnail?.length ?? 0)], at, 0);

  const exifAt = 8 + ifd0(0, 0, 0).length;
  const gpsAt = exifAt + exifIfd(0).length;
  const thumbIfdAt = gpsAt + (opts.gps ? gpsIfd(0).length : 0);
  const thumbAt = thumbIfdAt + (opts.thumbnail ? thumbIfd(0, 0).length : 0);
  return Buffer.concat([
    ascii(little ? "II" : "MM"),
    u16(42, little),
    u32(8, little),
    ifd0(exifAt, gpsAt, opts.thumbnail ? thumbIfdAt : 0),
    exifIfd(exifAt),
    ...(opts.gps ? [gpsIfd(gpsAt)] : []),
    ...(opts.thumbnail ? [thumbIfd(thumbIfdAt, thumbAt), opts.thumbnail] : []),
  ]);
}

/**
 * The exact bytes of an Exif block that holds only an Orientation, written out by hand from the TIFF rules:
 * byte order and magic, a directory at offset 8 with one entry (tag 0x0112, a 16-bit number, one of them, the
 * value), and no directory after it. 26 bytes.
 */
export const orientationOnlyTiff = (orientation: number) =>
  Buffer.from(["4d4d", "002a", "00000008", "0001", "0112", "0003", "00000001", `000${orientation}`, "0000", "00000000"].join(""), "hex");

/** The tags in the first directory of an Exif block, and where its next directory is: what is left of it. */
export function exifSummary(tiff: Buffer): { tags: number[]; values: Record<number, number>; next: number } {
  const little = tiff.toString("latin1", 0, 2) === "II";
  assert.ok(little || tiff.toString("latin1", 0, 2) === "MM", "an Exif block starts with its byte order");
  const r16 = (at: number) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const r32 = (at: number) => (little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  assert.equal(r16(2), 42, "the TIFF magic number");
  const dir = r32(4);
  const tags: number[] = [];
  const values: Record<number, number> = {};
  for (let i = 0; i < r16(dir); i++) {
    const entry = dir + 2 + i * 12;
    tags.push(r16(entry));
    if (r16(entry + 2) === 3) values[r16(entry)] = r16(entry + 8);
  }
  return { tags, values, next: r32(dir + 2 + tags.length * 12) };
}

/* ------------------------------------ JPEG ------------------------------------ */

export const jpegSeg = (marker: number, body: Buffer) =>
  Buffer.concat([Buffer.from([0xff, marker]), u16(body.length + 2), body]);

/** The hidden details a phone's JPEG can carry, each as one segment. */
export const exifSeg = (opts: ExifOptions = {}) => jpegSeg(0xe1, Buffer.concat([ascii("Exif\0\0"), exifTiff(opts)]));
export const xmpSeg = () =>
  jpegSeg(
    0xe1,
    Buffer.concat([
      ascii("http://ns.adobe.com/xap/1.0/\0"),
      ascii(`<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description exif:GPSLatitude="48,51.493N" dc:creator="${SECRETS.xmp}"/></rdf:RDF></x:xmpmeta>`),
    ])
  );
export const iptcSeg = () => {
  const dataset = Buffer.concat([Buffer.from([0x1c, 0x02, 0x50]), u16(SECRETS.iptc.length), ascii(SECRETS.iptc)]);
  const padded = dataset.length & 1 ? Buffer.concat([dataset, Buffer.alloc(1)]) : dataset;
  return jpegSeg(0xed, Buffer.concat([ascii("Photoshop 3.0\0"), ascii("8BIM"), u16(0x0404), Buffer.alloc(2), u32(dataset.length), padded]));
};
export const commentSeg = () => jpegSeg(0xfe, ascii(SECRETS.comment));
export const makerSeg = (marker = 0xe7) => jpegSeg(marker, ascii(`Maker\0${SECRETS.block}`));
export const mpfSeg = () => jpegSeg(0xe2, Buffer.concat([ascii("MPF\0"), ascii(SECRETS.block)]));
export const jfxxSeg = () => jpegSeg(0xe0, Buffer.concat([ascii("JFXX\0"), Buffer.from([0x10]), ascii(SECRETS.block)]));

export const ICC_BODY = Buffer.concat([ascii("ICC_PROFILE\0"), Buffer.from([1, 1]), ascii("pretend colour profile, kept as it is")]);
export const iccSeg = () => jpegSeg(0xe2, ICC_BODY);
export const ADOBE_BODY = Buffer.concat([ascii("Adobe"), u16(100), u16(0), u16(0), Buffer.from([1])]);
export const adobeSeg = () => jpegSeg(0xee, ADOBE_BODY);

/** JFIF with 300 dots per inch, and optionally a little RGB thumbnail inside it. */
export const THUMB_PIXELS = Buffer.alloc(12, 0xab);
export const jfifSeg = (thumbnail = false) =>
  jpegSeg(
    0xe0,
    Buffer.concat([
      ascii("JFIF\0"),
      Buffer.from([1, 2, 1]),
      u16(300),
      u16(300),
      Buffer.from(thumbnail ? [2, 2] : [0, 0]),
      thumbnail ? THUMB_PIXELS : Buffer.alloc(0),
    ])
  );

/* A 16 x 16 grey picture made of four 8 x 8 blocks, each a flat shade, with every part written out by hand. */

export const GRAY_BLOCKS = [200, 100, 50, 250];
const DC_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_BITS = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const AC_VALUES = [0x00]; // only "end of block": a flat block has nothing else

/** Canonical Huffman codes (JPEG annex C) from a table's counts and symbols. */
function huffmanCodes(bits: number[], values: number[]): Map<number, { code: number; length: number }> {
  const codes = new Map<number, { code: number; length: number }>();
  let code = 0;
  let k = 0;
  for (let length = 1; length <= 16; length++) {
    for (let i = 0; i < bits[length - 1]; i++) codes.set(values[k++], { code: code++, length });
    code <<= 1;
  }
  return codes;
}

function encodeScan(shades: number[]): Buffer {
  const dc = huffmanCodes(DC_BITS, DC_VALUES);
  const ac = huffmanCodes(AC_BITS, AC_VALUES);
  const bits: number[] = [];
  const put = (code: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((code >> i) & 1);
  };
  let previous = 0;
  for (const shade of shades) {
    const level = (shade - 128) * 8; // the block's DC value when every quantiser step is 1
    const diff = level - previous;
    previous = level;
    const size = diff === 0 ? 0 : Math.abs(diff).toString(2).length;
    put(dc.get(size)!.code, dc.get(size)!.length);
    if (size > 0) put(diff >= 0 ? diff : diff + (1 << size) - 1, size);
    put(ac.get(0)!.code, ac.get(0)!.length);
  }
  while (bits.length % 8) bits.push(1);
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0);
    bytes.push(byte);
    if (byte === 0xff) bytes.push(0x00); // a data byte of 0xFF is always followed by 0x00
  }
  return Buffer.from(bytes);
}

/** The parts of the grey picture, so a test can put other segments between them. */
export function grayJpegParts(shades = GRAY_BLOCKS) {
  const dqt = jpegSeg(0xdb, Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, 1)]));
  const sof = jpegSeg(0xc0, Buffer.concat([Buffer.from([8]), u16(16), u16(16), Buffer.from([1, 1, 0x11, 0])]));
  const dhtDc = jpegSeg(0xc4, Buffer.concat([Buffer.from([0x00, ...DC_BITS, ...DC_VALUES])]));
  const dhtAc = jpegSeg(0xc4, Buffer.concat([Buffer.from([0x10, ...AC_BITS, ...AC_VALUES])]));
  const sos = jpegSeg(0xda, Buffer.from([1, 1, 0x00, 0, 63, 0]));
  return { dqt, sof, dhtDc, dhtAc, sos, scan: encodeScan(shades) };
}

export const SOI = Buffer.from([0xff, 0xd8]);
export const EOI = Buffer.from([0xff, 0xd9]);

/** A whole JPEG: start, the given segments in order, end. */
export const jpegFile = (...parts: Buffer[]) => Buffer.concat([SOI, ...parts, EOI]);

/** The grey picture with `extra` segments right after the start, and `trailer` after the end. */
export function grayJpeg(extra: Buffer[] = [], trailer: Buffer = Buffer.alloc(0), shades = GRAY_BLOCKS): Buffer {
  const p = grayJpegParts(shades);
  return Buffer.concat([jpegFile(...extra, p.dqt, p.sof, p.dhtDc, p.dhtAc, p.sos, p.scan), trailer]);
}

export type JpegPart = { marker: number; body: Buffer };

/**
 * Every segment of a JPEG in order. The compressed data of each scan comes as one part with marker -1.
 * Strict: the file must start and end as a JPEG does, with nothing after the end marker.
 */
export function jpegSegments(file: Buffer): JpegPart[] {
  assert.equal(file[0], 0xff, "starts with FF");
  assert.equal(file[1], 0xd8, "starts with D8");
  const parts: JpegPart[] = [];
  let pos = 2;
  for (;;) {
    assert.equal(file[pos], 0xff, `a marker is expected at byte ${pos}`);
    const marker = file[pos + 1];
    pos += 2;
    if (marker === 0xd9) {
      assert.equal(pos, file.length, "nothing may follow the end marker");
      parts.push({ marker, body: Buffer.alloc(0) });
      return parts;
    }
    const length = file.readUInt16BE(pos);
    assert.ok(length >= 2 && pos + length <= file.length, `segment ${marker.toString(16)} fits in the file`);
    parts.push({ marker, body: file.subarray(pos + 2, pos + length) });
    pos += length;
    if (marker === 0xda) {
      // The data runs to the next marker. An 0xFF inside it is followed by 0x00 (a data byte) or a restart
      // marker; repeated 0xFF bytes are padding (libjpeg skips them the same way).
      let end = pos;
      for (;;) {
        const ff = file.indexOf(0xff, end);
        assert.ok(ff >= 0, "picture data is followed by a marker");
        let next = ff + 1;
        while (file[next] === 0xff) next++;
        const code = file[next];
        if (code === 0x00 || (code >= 0xd0 && code <= 0xd7)) {
          end = next + 1;
          continue;
        }
        end = ff;
        break;
      }
      parts.push({ marker: -1, body: file.subarray(pos, end) });
      pos = end;
    }
  }
}

export const jpegMarkers = (file: Buffer) => jpegSegments(file).filter((p) => p.marker !== -1).map((p) => p.marker);

/** Decodes the grey picture above (and only that kind of picture) the way any decoder would. */
export function decodeGrayJpeg(file: Buffer): { width: number; height: number; pixels: number[][] } {
  const parts = jpegSegments(file);
  const one = (marker: number) => {
    const found = parts.filter((p) => p.marker === marker);
    assert.equal(found.length, 1, `exactly one segment ${marker.toString(16)}`);
    return found[0].body;
  };
  const quantiser = one(0xdb)[1];
  const frame = one(0xc0);
  const height = frame.readUInt16BE(1);
  const width = frame.readUInt16BE(3);

  const tables = new Map<number, Map<string, number>>(); // class and id -> "length:code" -> symbol
  for (const dht of parts.filter((p) => p.marker === 0xc4)) {
    const bits = [...dht.body.subarray(1, 17)];
    const total = bits.reduce((a, b) => a + b, 0);
    const codes = huffmanCodes(bits, [...dht.body.subarray(17, 17 + total)]);
    const map = new Map<string, number>();
    for (const [symbol, { code, length }] of codes) map.set(`${length}:${code}`, symbol);
    tables.set(dht.body[0], map);
  }
  const dcTable = tables.get(0x00);
  const acTable = tables.get(0x10);
  assert.ok(dcTable && acTable, "both Huffman tables are in the file");

  const scan = parts.filter((p) => p.marker === -1);
  assert.equal(scan.length, 1, "one scan");
  const data: number[] = [];
  for (let i = 0; i < scan[0].body.length; i++) {
    data.push(scan[0].body[i]);
    if (scan[0].body[i] === 0xff) {
      assert.equal(scan[0].body[i + 1], 0x00, "stuffed zero after FF");
      i++;
    }
  }
  let bitPos = 0;
  const bit = () => {
    assert.ok(bitPos < data.length * 8, "ran out of picture data");
    const value = (data[bitPos >> 3] >> (7 - (bitPos & 7))) & 1;
    bitPos++;
    return value;
  };
  const symbol = (table: Map<string, number>) => {
    let code = 0;
    for (let length = 1; length <= 16; length++) {
      code = (code << 1) | bit();
      const found = table.get(`${length}:${code}`);
      if (found !== undefined) return found;
    }
    throw new Error("no such Huffman code");
  };

  const blocksAcross = width / 8;
  const pixels: number[][] = Array.from({ length: height }, () => new Array<number>(width).fill(0));
  let dc = 0;
  for (let block = 0; block < blocksAcross * (height / 8); block++) {
    const size = symbol(dcTable);
    let diff = 0;
    if (size > 0) {
      let raw = 0;
      for (let i = 0; i < size; i++) raw = (raw << 1) | bit();
      diff = raw >= 1 << (size - 1) ? raw : raw - ((1 << size) - 1);
    }
    dc += diff;
    assert.equal(symbol(acTable), 0x00, "a flat block ends straight after its DC value");
    const shade = Math.min(255, Math.max(0, Math.round((dc * quantiser) / 8) + 128));
    const x0 = (block % blocksAcross) * 8;
    const y0 = Math.floor(block / blocksAcross) * 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) pixels[y0 + y][x0 + x] = shade;
  }
  while (bitPos < data.length * 8) assert.equal(bit(), 1, "only 1-bits pad the last byte");
  return { width, height, pixels };
}

/** What decodeGrayJpeg should return for a picture of these four shades. */
export const expectedPixels = (shades = GRAY_BLOCKS) =>
  Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => shades[(y >> 3) * 2 + (x >> 3)]));

/** Taken from a real encoder (ffmpeg): 16 x 16, with JFIF, a comment, one quantiser table, standard Huffman tables. */
export const REAL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACBAQExATFhYWFhYWGhgaGxsbGhoaGhsbGx0dHSIiIh0dHRsbHR0gICIiJSYlIyMiIyYmKCgoMDAuLjg4OkVFU//EAGwAAQEBAAAAAAAAAAAAAAAAAAUDBwEBAQAAAAAAAAAAAAAAAAAAAAYQAAEDAwMEAwEBAAAAAAAAAAECERIDIQQAFFExMkEiUiMzYRMRAAIBAwUBAQEAAAAAAAAAAAIBEhEhAwQAMSJBYXEF/8AAEQgAEAAQAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8Ay4muuqpFPwJHtAAAckqVYD+k6tibzHrMj1VELf6ymDH3kXRG/V2e3XTOMQVZVNpKV/iQh2Kwi6gDy3F+NI01oGLtoNU/TbyMgg1Zwl8oeO9rtpl/ragyOMkJEPWTcRJVk7j1HjhL6t0GfTjLKLJlFZR/a1FhSjuQ+Xt49//Z",
  "base64"
);

/* ------------------------------------- PNG ------------------------------------ */

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function pngChunk(type: string, data: Buffer = Buffer.alloc(0)): Buffer {
  const body = Buffer.concat([ascii(type), data]);
  return Buffer.concat([u32(data.length), body, u32(crc32(body))]);
}

/** A tiny RGB picture, every pixel different, so any change to its data shows. */
export function tinyPngPixels(width: number, height: number): Buffer {
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) rgb[(y * width + x) * 3 + c] = (x * 40 + y * 70 + c * 90 + 13) & 0xff;
  return rgb;
}

export function pngIhdr(width: number, height: number): Buffer {
  return pngChunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])]));
}
export function pngIdat(width: number, height: number): Buffer {
  const rgb = tinyPngPixels(width, height);
  const rows = Array.from({ length: height }, (_, y) => Buffer.concat([Buffer.from([0]), rgb.subarray(y * width * 3, (y + 1) * width * 3)]));
  return pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows)));
}

/** A valid PNG; `afterHeader` and `beforeEnd` are extra chunks, `trailer` is junk after the end. */
export function tinyPng(opts: { width?: number; height?: number; afterHeader?: Buffer[]; beforeEnd?: Buffer[]; trailer?: Buffer } = {}): Buffer {
  const width = opts.width ?? 4;
  const height = opts.height ?? 3;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngIhdr(width, height),
    ...(opts.afterHeader ?? []),
    pngIdat(width, height),
    ...(opts.beforeEnd ?? []),
    pngChunk("IEND"),
    opts.trailer ?? Buffer.alloc(0),
  ]);
}

/** Every chunk in order. Strict: signature, each checksum, header first, end last, nothing after. */
export function pngChunks(file: Buffer): Array<{ type: string; data: Buffer }> {
  assert.ok(file.subarray(0, 8).equals(PNG_SIGNATURE), "PNG signature");
  const chunks: Array<{ type: string; data: Buffer }> = [];
  let pos = 8;
  while (pos < file.length) {
    const length = file.readUInt32BE(pos);
    const type = file.toString("latin1", pos + 4, pos + 8);
    assert.ok(pos + 12 + length <= file.length, `chunk ${type} fits in the file`);
    const data = file.subarray(pos + 8, pos + 8 + length);
    assert.equal(file.readUInt32BE(pos + 8 + length), crc32(file.subarray(pos + 4, pos + 8 + length)), `checksum of ${type}`);
    chunks.push({ type, data });
    pos += 12 + length;
    if (type === "IEND") assert.equal(pos, file.length, "nothing may follow IEND");
  }
  assert.equal(chunks[0].type, "IHDR", "header first");
  assert.equal(chunks[chunks.length - 1].type, "IEND", "end last");
  return chunks;
}

/** Taken from a real encoder (ffmpeg): 16 x 16, with the chunks IHDR, pHYs, IDAT, IEND. */
export const REAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAABAAAAAQBPJcTWAAABGElEQVR4nGOsZ/jHgA00IrH/MfxnYGBg+s/EwMDAwkAiYIFQ8xkc8CiyB9vAYM9IgQ300iDGcJ6BgWFLgzIDA8NvJpCUed0NBgYGIQZQ+NzylsFiQ3tLO8OfOZUNFz4yMExsMpnYNTG/LJ+BgaGupo6BYd7UqddY6sC694NVH6hnYPidY7+PgcGW4fBhu3V1DP/qk4PrIUaVMG21Y1Cwo4anDT8yJCTo/fDSyq+cgSzu8fpQdnYINWw4z89wfv2lw4cFGBjsGBgOwcV3iNrtWPWKMhtUNzEUFYWtZD+4YMFLUYZDE5tM1nLMzS/LN2Vgqqupu+UNDlY0A/r6VgWGiickiMf+kWVgYIBEAgMDQ1NLU3enTHa2FgD36FN0VMo8DQAAAABJRU5ErkJggg==",
  "base64"
);

/** Decodes a picture made by tinyPng: inflates it and takes the row filters off (only filter 0 is used). */
export function decodePng(file: Buffer): { width: number; height: number; rgb: Buffer } {
  const chunks = pngChunks(file);
  const header = chunks[0].data;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  assert.deepEqual([...header.subarray(8)], [8, 2, 0, 0, 0], "8-bit RGB, no interlace");
  const raw = zlib.inflateSync(Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data)));
  assert.equal(raw.length, height * (1 + width * 3), "inflated size is one filter byte plus the pixels per row");
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * (1 + width * 3)], 0, "row filter is none");
    raw.copy(rgb, y * width * 3, y * (1 + width * 3) + 1, (y + 1) * (1 + width * 3));
  }
  return { width, height, rgb };
}

/* ------------------------------------- WebP ----------------------------------- */

export const webpChunkBytes = (id: string, data: Buffer) =>
  Buffer.concat([ascii(id), u32(data.length, true), data, data.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);

/** A WebP file from chunks in order, with the right sizes. */
export const webpFile = (...chunks: Buffer[]) => {
  const body = Buffer.concat([ascii("WEBP"), ...chunks]);
  return Buffer.concat([ascii("RIFF"), u32(body.length, true), body]);
};

/** Every chunk in order. Strict: sizes agree with the file, padding is there and empty, nothing is left over. */
export function webpChunks(file: Buffer): Array<{ id: string; data: Buffer }> {
  assert.equal(file.toString("latin1", 0, 4), "RIFF", "RIFF");
  assert.equal(file.toString("latin1", 8, 12), "WEBP", "WEBP");
  assert.equal(file.readUInt32LE(4), file.length - 8, "the stated size is the file's size less 8");
  const chunks: Array<{ id: string; data: Buffer }> = [];
  let pos = 12;
  while (pos < file.length) {
    assert.ok(pos + 8 <= file.length, "a chunk header fits");
    const id = file.toString("latin1", pos, pos + 4);
    const size = file.readUInt32LE(pos + 4);
    assert.ok(pos + 8 + size <= file.length, `chunk ${id} fits`);
    chunks.push({ id, data: file.subarray(pos + 8, pos + 8 + size) });
    pos += 8 + size;
    if (size & 1) {
      assert.equal(file[pos], 0, `chunk ${id} is followed by its zero pad byte`);
      pos++;
    }
  }
  return chunks;
}

/** Real WebP files from a real encoder (ffmpeg with libwebp), 16 x 16. */
export const WEBP_LOSSY = Buffer.from(
  "UklGRt4AAABXRUJQVlA4INIAAADwAwCdASoQABAAAoBCJbACdEYAZYB5UnsM/tERsH6xGAGs9amFl/IAAP715XiDUsHwG7+/2byy152Ohj6+QlcmxxHfXncYbLF/cWDAaAJcafwx0nY982j1cXeDzlplR5rVH6E8l8gkiwrGv5LH5kzS//xYm4gwL974f+qMWpLzyEYIKYDFYQZ+Av/5Ntpbjz/xG7vL9dNdCP8p3YpD/8B96/rGdvkck7wYf0wts4f/rDJlt2tee02+7b/u2K5Jf/Jurhlhplh48jkGLM5a7uKAAAA=",
  "base64"
);
export const WEBP_LOSSLESS = Buffer.from(
  "UklGRjYCAABXRUJQVlA4TCkCAAAvD8ADAGfkKJIk1arHzM/BO//bd/C9fLeshHnAhiPbdtNGsqyUmWkDnfJyOuxCu5CejJlRthtJtlVl3uXh7p4RswsPWT0Rmbvz5Mv8BxB3RCAKJwUQOBosoD8ITAABBgg0AgIOHBExIOgI5SD22iISI21vYjFyP2VMhsIGvwJ5BkqkWjMS2T4GaGGTYNsPVzCArKAKvC9ey5TLqkhGJfc7HGuAEiqgSqgFnQgPwjgCRiAH/YP+QwUwATQILEQgG9dRqBt5Wa/OevhLRrKImS2iLUiTnD+V0BaIVrBFZFUUGqFHrtFp3OrYbFXu2oI3RfwTlQU/7Ki8wB/bZmus3Y8kFwE4SIEyAkkxyAhbzU1GKBAHgaTEeUpciYBv4I+4dQITSZuH7+rLHMM4oJRiKsMpor2II5yNQDlGwkGkRSAAB3K058j0pfiPDL+ZbbdSBUer5djuq/wXBkuD69IZHn4LbD4Tt0vEAEGSZNPWs23btm0b38b7tm1u2v8vYV5E/9W2bcPQU+oh3O/hxBGQNBtfkFweXwAAwscHeDLdvya4/FYVAGqNJtTblbFxrqDqBQCPyz10ljojo//i8wdC4ZjNYS8Wur1P/mBmeW5+gI3ms6sbt3flCHlhmk5ZHBBZS2ui97dn6sS+ToXBzxydTil6KAubcXKhVVvxh1fDa3n/m0v9+grp+MO5+OZv/ypoezsaJfq3lbRkc8vw89GnlEy6fXYwS8DlmJO7AA==",
  "base64"
);
export const WEBP_ALPHA = Buffer.from(
  "UklGRqYAAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSAoAAAABB9C/iAhERP8DVlA4IHYAAABQBACdASoQABAAAoBCJbACdJIB/AMoBtAH8Auv/0AP4BvAH+q/4HWABKgAAP7wslP+Bq//AS7//g2TrEDBAhvIVjNFPGjcVfAbSQKJSE9Oqglvv/1z982YCozf//Ogvlp784vf/5z+utsOnF79TOrjbf0l0AAA",
  "base64"
);
export const WEBP_ANIMATED = Buffer.from(
  "UklGRggCAABXRUJQVlA4WAoAAAASAAAADwAADwAAQU5JTQYAAAD/////AABBTk1G6gAAAAAAAAAAAA8AAA8AAMgAAABWUDgg0gAAAPADAJ0BKhAAEAACgEIlsAJ0RgBlgHlSewz+0RGwfrEYAaz1qYWX8gAA/vXleINSwfAbv7/ZvLLXnY6GPr5CVybHEd9edxhssX9xYMBoAlxp/DHSdj3zaPVxd4POWmVHmtUfoTyXyCSLCsa/ksfmTNL//FibiDAv3vh/6oxakvPIRggpgMVhBn4C//k22luPP/Ebu8v1010I/yndikP/wH3r+sZ2+RyTvBh/TC2zh/+sMmW3a157Tb7tv+7Yrkl/8m6uGWGmWHjyOQYszlru4oAAAEFOTUbqAAAAAAAAAAAADwAADwAAyAAAAFZQOCDSAAAA8AMAnQEqEAAQAAKAQiWwAnRGAGWAeVJ7DP7REbB+sRgBrPWphZfyAAD+9eV4g1LB8Bu/v9m8stedjoY+vkJXJscR3953GGyxf3FgwGgCXGn8MdJ2PfNo9XF3g85aZUea1R+hPJfIJIsKxr+Sx+ZM0v/8WJuIMC/e+H/qjFqS88hGCCmAxWEGfgL/+TbaW48/8Ru7y/XTXQj/Kd2KQ//Afev6xnb5HJO8GH9MLbOH/6wyZbdrXntNvu2/7tiuSX/ybq4ZYaZYePI5BizOWu7igAAA",
  "base64"
);

/** An already extended WebP with chunks added at the end and the given flag bits switched on in its VP8X. */
export function addWebpChunks(file: Buffer, add: Array<{ id: string; data: Buffer }>, flagBits: number): Buffer {
  const chunks = webpChunks(file);
  assert.equal(chunks[0].id, "VP8X", "an extended file");
  const header = Buffer.from(chunks[0].data);
  header[0] |= flagBits;
  return webpFile(
    webpChunkBytes("VP8X", header),
    ...chunks.slice(1).map((c) => webpChunkBytes(c.id, c.data)),
    ...add.map((c) => webpChunkBytes(c.id, c.data))
  );
}

/** A plain (not extended) WebP made extended, so it can carry extra chunks: VP8X, then the picture. */
export function extendedWebp(plain: Buffer, extra: { icc?: Buffer; exif?: Buffer; xmp?: Buffer; unknown?: Buffer; flags?: number } = {}): Buffer {
  const [picture] = webpChunks(plain);
  const flags = (extra.flags ?? 0) | (extra.icc ? 0x20 : 0) | (extra.exif ? 0x08 : 0) | (extra.xmp ? 0x04 : 0);
  const canvas = Buffer.concat([Buffer.from([flags, 0, 0, 0]), Buffer.from([15, 0, 0]), Buffer.from([15, 0, 0])]); // 16 x 16
  return webpFile(
    webpChunkBytes("VP8X", canvas),
    ...(extra.icc ? [webpChunkBytes("ICCP", extra.icc)] : []),
    webpChunkBytes(picture.id, picture.data),
    ...(extra.exif ? [webpChunkBytes("EXIF", extra.exif)] : []),
    ...(extra.xmp ? [webpChunkBytes("XMP ", extra.xmp)] : []),
    ...(extra.unknown ? [webpChunkBytes("JUNK", extra.unknown)] : [])
  );
}
