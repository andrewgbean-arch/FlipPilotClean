/**
 * Reads a picture's width and height from its own header bytes (PNG, JPEG or
 * WebP), without decoding it, so an advertiser's ready-made full-page design can
 * be checked to really be portrait and big enough before it is kept. Anything it
 * can't read returns null and is refused.
 */

export type ImageSize = { width: number; height: number };

function png(b: Buffer): ImageSize | null {
  // 8-byte signature, then the IHDR chunk: length(4) "IHDR"(4) width(4) height(4)
  if (b.length < 24 || b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function jpeg(b: Buffer): ImageSize | null {
  let i = 2; // after FFD8
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    let marker = b[i + 1];
    while (marker === 0xff && i + 2 < b.length) {
      i += 1;
      marker = b[i + 1];
    }
    // Start-of-frame markers carry the size (not DHT C4, JPG C8, DAC CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    const length = b.readUInt16BE(i + 2);
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

function webp(b: Buffer): ImageSize | null {
  if (b.length < 30) return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") {
    return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  }
  if (kind === "VP8 ") {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

export function imageSize(buffer: Buffer, type: "jpg" | "png" | "webp"): ImageSize | null {
  try {
    const size = type === "png" ? png(buffer) : type === "jpg" ? jpeg(buffer) : webp(buffer);
    return size && size.width > 0 && size.height > 0 ? size : null;
  } catch {
    return null;
  }
}
