import "./setupEnv";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";
import { UnreadableImageError, stripImageMetadata } from "../utils/imageMetadata";
import { UPLOADS_DIR, saveUpload, trySaveUpload, uploadsBy } from "../utils/uploadStore";
import { imageSize } from "../utils/imageSize";
import registerUploadsRoute from "../routes/uploads";
import { storeArtwork, storeImage } from "../routes/adverts";
import * as F from "./imageFixtures";

// A photo here is public once it is on a listing, so what a phone hides inside it (where it was taken, which phone,
// a thumbnail of the whole shot) must never be kept. These prove it for JPEG, PNG and WebP: the hidden details go, the
// picture is the same bytes, which way up it is survives, and a file that can't be read closely is refused, not kept.

const strip = stripImageMetadata;
const isRefusal = (err: unknown) =>
  err instanceof UnreadableImageError && /couldn't be read/.test(err.message) && !/jpeg|png|webp|marker|chunk|byte/i.test(err.message);
const refused = (file: Buffer, kind: "jpg" | "png" | "webp", label: string) =>
  assert.throws(() => strip(file, kind), isRefusal, `${label} must be refused with the person-friendly message`);
const noSecrets = (file: Buffer, label: string) => {
  for (const word of F.SECRET_WORDS) assert.ok(!F.has(file, word), `${label}: "${word}" must be gone`);
};

/* ------------------------------------ JPEG ------------------------------------ */

// What an out-of-date, uncropped copy of the shot would look like if left in the Exif.
const THUMBNAIL = F.grayJpeg([], undefined, [10, 10, 10, 10]);
const EVERYTHING = () => [
  F.jfifSeg(true),
  F.exifSeg({ gps: true, thumbnail: THUMBNAIL }),
  F.xmpSeg(),
  F.iptcSeg(),
  F.commentSeg(),
  F.makerSeg(),
  F.mpfSeg(),
  F.jfxxSeg(),
];
const MOTION_VIDEO = Buffer.concat([F.ascii("MOTION-PHOTO-VIDEO"), F.ascii(F.SECRETS.block)]);

describe("a JPEG", () => {
  test("everything a phone hides in it goes, and the picture is still whole", () => {
    const dirty = F.grayJpeg(EVERYTHING(), MOTION_VIDEO);
    const before = Buffer.from(dirty);
    const clean = strip(dirty, "jpg");

    assert.ok(dirty.equals(before), "the buffer it was given is left alone");
    assert.deepEqual([...clean.subarray(0, 2)], [0xff, 0xd8], "still starts with FFD8");
    assert.deepEqual([...clean.subarray(clean.length - 2)], [0xff, 0xd9], "still ends with FFD9");
    assert.ok(clean.length < dirty.length, "it is smaller");

    noSecrets(clean, "jpeg");
    for (const text of ["Exif", "ns.adobe.com", "Photoshop", "8BIM", "JFXX", "MPF", "MOTION-PHOTO"]) {
      assert.ok(!F.has(clean, text), `"${text}" must be gone`);
    }
    assert.ok(!clean.includes(THUMBNAIL), "the thumbnail inside the Exif is gone");
    assert.ok(!clean.includes(F.THUMB_PIXELS), "the thumbnail inside the JFIF header is gone");
    assert.deepEqual(F.jpegMarkers(clean), [0xe0, 0xdb, 0xc0, 0xc4, 0xc4, 0xda, 0xd9], "only the JFIF header and what draws the picture are left");

    // It decodes, to the same shades.
    const decoded = F.decodeGrayJpeg(clean);
    assert.deepEqual(decoded.pixels, F.expectedPixels(), "decoded picture is the picture that went in");
    assert.deepEqual(imageSize(clean, "jpg"), imageSize(dirty, "jpg"), "same size");

    // The tables, the frame header and the picture data are the very same bytes as in a file that never had any extras.
    const plain = F.jpegSegments(F.grayJpeg()).map((p) => [p.marker, p.body.toString("hex")]);
    const kept = F.jpegSegments(clean).filter((p) => p.marker !== 0xe0).map((p) => [p.marker, p.body.toString("hex")]);
    assert.deepEqual(kept, plain, "picture data and tables untouched");
  });

  test("the JFIF header keeps its density but loses any thumbnail inside it", () => {
    const clean = strip(F.grayJpeg([F.jfifSeg(true)]), "jpg");
    const jfif = F.jpegSegments(clean)[0];
    assert.equal(jfif.marker, 0xe0);
    assert.equal(jfif.body.length, 14, "the plain 16-byte header, with nothing after it");
    assert.deepEqual([...jfif.body.subarray(5, 8)], [1, 2, 1], "version and units kept");
    assert.equal(jfif.body.readUInt16BE(8), 300, "density kept");
    assert.deepEqual([...jfif.body.subarray(12)], [0, 0], "no thumbnail");
  });

  test("the colour profile and Adobe's colour flag stay, so the colours do not change", () => {
    const withColour = F.grayJpeg([F.jfifSeg(), F.iccSeg(), F.adobeSeg()]);
    const clean = strip(withColour, "jpg");
    assert.ok(clean.equals(withColour), "nothing to take out, so it comes out byte for byte the same");
    assert.deepEqual(F.jpegMarkers(clean).slice(0, 3), [0xe0, 0xe2, 0xee]);
  });

  test("a second colour-profile block of another kind (a multi-picture index) goes", () => {
    const clean = strip(F.grayJpeg([F.iccSeg(), F.mpfSeg()]), "jpg");
    assert.deepEqual(F.jpegMarkers(clean).slice(0, 2), [0xe2, 0xdb]);
    assert.ok(F.jpegSegments(clean)[0].body.equals(F.ICC_BODY), "the profile itself is untouched");
  });

  test("a block in Adobe's slot that is not Adobe's colour flag goes", () => {
    const notAdobe = F.jpegSeg(0xee, F.ascii(`Other ${F.SECRETS.block}`));
    const clean = strip(F.grayJpeg([F.adobeSeg(), notAdobe]), "jpg");
    assert.deepEqual(F.jpegMarkers(clean).slice(0, 2), [0xee, 0xdb], "Adobe's flag kept, the other block gone");
    assert.ok(F.jpegSegments(clean)[0].body.equals(F.ADOBE_BODY), "Adobe's flag untouched");
    noSecrets(clean, "non-Adobe APP14");
  });

  test("the restart interval and every other table or header a decoder needs stay", () => {
    const p = F.grayJpegParts();
    const restartInterval = F.jpegSeg(0xdd, Buffer.from([0x00, 0x08]));
    const arithmetic = F.jpegSeg(0xcc, Buffer.from([0x00, 0x10]));
    const lineCount = F.jpegSeg(0xdc, Buffer.from([0x00, 0x10]));
    const hierarchy = F.jpegSeg(0xde, Buffer.from([8, 0, 16, 0, 16, 1, 1, 0x11, 0]));
    const expansion = F.jpegSeg(0xdf, Buffer.from([0x11]));
    const file = F.jpegFile(restartInterval, arithmetic, p.dqt, p.sof, p.dhtDc, p.dhtAc, hierarchy, expansion, p.sos, p.scan, lineCount);
    assert.ok(strip(file, "jpg").equals(file), "nothing to take out, so the same bytes come back");
  });

  test("a file from a real encoder loses only its comment, and its picture data is the same bytes", () => {
    const before = F.jpegSegments(F.REAL_JPEG);
    assert.deepEqual(F.jpegMarkers(F.REAL_JPEG), [0xe0, 0xfe, 0xdb, 0xc4, 0xc0, 0xda, 0xd9], "the sample is as expected");
    const clean = strip(F.REAL_JPEG, "jpg");
    assert.deepEqual(F.jpegMarkers(clean), [0xe0, 0xdb, 0xc4, 0xc0, 0xda, 0xd9], "the encoder's comment is gone");
    const hex = (parts: F.JpegPart[]) => parts.filter((p) => p.marker !== 0xfe).map((p) => [p.marker, p.body.toString("hex")]);
    assert.deepEqual(hex(F.jpegSegments(clean)), hex(before), "everything else is the same bytes");
    assert.deepEqual(imageSize(clean, "jpg"), { width: 16, height: 16 });
  });

  test("stripping twice changes nothing more", () => {
    const once = strip(F.grayJpeg(EVERYTHING(), MOTION_VIDEO), "jpg");
    assert.ok(strip(once, "jpg").equals(once), "idempotent");
  });

  describe("which way up it is", () => {
    test("an Orientation other than normal is kept, alone, in either byte order, where the Exif was", () => {
      for (const little of [false, true]) {
        for (let orientation = 2; orientation <= 8; orientation++) {
          const dirty = F.grayJpeg([F.jfifSeg(), F.exifSeg({ orientation, gps: true, little, thumbnail: THUMBNAIL }), F.xmpSeg()]);
          const clean = strip(dirty, "jpg");
          const label = `orientation ${orientation}, ${little ? "little" : "big"}-endian`;
          assert.deepEqual(F.jpegMarkers(clean).slice(0, 3), [0xe0, 0xe1, 0xdb], `${label}: JFIF, then one Exif block, then the tables`);
          const exif = F.jpegSegments(clean)[1];
          assert.equal(exif.body.length, 32, `${label}: the Exif block is the smallest there can be`);
          assert.equal(exif.body.toString("latin1", 0, 6), "Exif\0\0");
          assert.deepEqual(F.exifSummary(exif.body.subarray(6)), { tags: [0x0112], values: { 0x0112: orientation }, next: 0 }, `${label}: only the Orientation`);
          assert.ok(exif.body.subarray(6).equals(F.orientationOnlyTiff(orientation)), `${label}: exactly the bytes of an Orientation-only block`);
          noSecrets(clean, label);
          assert.deepEqual(F.decodeGrayJpeg(clean).pixels, F.expectedPixels(), `${label}: picture data untouched`);
        }
      }
    });

    test("it stays in the place the Exif was (before the JFIF header if that is how the phone wrote it)", () => {
      const clean = strip(F.grayJpeg([F.exifSeg({ orientation: 6, gps: true }), F.jfifSeg()]), "jpg");
      assert.deepEqual(F.jpegMarkers(clean).slice(0, 3), [0xe1, 0xe0, 0xdb]);
    });

    test("a normal, missing, impossible or unreadable Orientation leaves no Exif at all", () => {
      const garbled = F.jpegSeg(0xe1, Buffer.concat([F.ascii("Exif\0\0"), F.ascii("MM"), Buffer.from([0, 42, 0xff, 0xff, 0xff, 0xf0, 0, 5])]));
      const truncated = F.jpegSeg(0xe1, Buffer.concat([F.ascii("Exif\0\0"), F.exifTiff({ orientation: 6, gps: true }).subarray(0, 20)]));
      const notTiff = Buffer.from(F.exifTiff({ orientation: 6, gps: true }));
      notTiff.writeUInt16BE(43, 2); // a TIFF block's magic number is 42
      const wrongMagic = F.jpegSeg(0xe1, Buffer.concat([F.ascii("Exif\0\0"), notTiff]));
      const cases: Array<[string, Buffer]> = [
        ["a block without the TIFF magic number", wrongMagic],
        ["orientation 1", F.exifSeg({ orientation: 1, gps: true })],
        ["no orientation", F.exifSeg({ gps: true })],
        ["orientation 0", F.exifSeg({ orientation: 0, gps: true })],
        ["orientation 9", F.exifSeg({ orientation: 9, gps: true })],
        ["orientation 255", F.exifSeg({ orientation: 255, gps: true })],
        ["a directory pointing outside the block", garbled],
        ["an Exif block cut short", truncated],
      ];
      for (const [label, segment] of cases) {
        const clean = strip(F.grayJpeg([F.jfifSeg(), segment]), "jpg");
        assert.deepEqual(F.jpegMarkers(clean).slice(0, 2), [0xe0, 0xdb], `${label}: no Exif left`);
        noSecrets(clean, label);
      }
    });

    test("an Orientation stored as another whole-number type is still honoured", () => {
      const asByte = Buffer.from(["4d4d", "002a", "00000008", "0001", "0112", "0001", "00000001", "06000000", "00000000"].join(""), "hex");
      const asLong = Buffer.from(["4d4d", "002a", "00000008", "0001", "0112", "0004", "00000001", "00000006", "00000000"].join(""), "hex");
      for (const [label, tiff] of [["a byte", asByte], ["a long", asLong]] as const) {
        const clean = strip(F.grayJpeg([F.jpegSeg(0xe1, Buffer.concat([F.ascii("Exif\0\0"), tiff]))]), "jpg");
        assert.ok(F.jpegSegments(clean)[0].body.subarray(6).equals(F.orientationOnlyTiff(6)), `${label}: written back as the standard 16-bit number`);
      }
    });

    test("only the first Exif block counts, and a second one cannot bring its own details back", () => {
      const clean = strip(F.grayJpeg([F.exifSeg({ orientation: 3 }), F.exifSeg({ orientation: 6, gps: true })]), "jpg");
      const exifs = F.jpegSegments(clean).filter((p) => p.marker === 0xe1);
      assert.equal(exifs.length, 1);
      assert.equal(F.exifSummary(exifs[0].body.subarray(6)).values[0x0112], 3);
      noSecrets(clean, "two Exif blocks");
    });
  });

  describe("pictures built in unusual but valid ways", () => {
    const parts = F.grayJpegParts();

    test("a picture in several scans (progressive) keeps every scan, and a block between scans still goes", () => {
      const sof2 = Buffer.from(parts.sof);
      sof2[1] = 0xc2; // progressive
      const scan1 = Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56]);
      const scan2 = Buffer.from([0x78, 0xff, 0x00, 0xff, 0xd7, 0x9a]);
      const dirty = F.jpegFile(parts.dqt, sof2, parts.dhtDc, parts.sos, scan1, F.exifSeg({ gps: true }), F.xmpSeg(), parts.dhtAc, parts.sos, scan2);
      const expected = F.jpegFile(parts.dqt, sof2, parts.dhtDc, parts.sos, scan1, parts.dhtAc, parts.sos, scan2);
      assert.ok(strip(dirty, "jpg").equals(expected), "both scans and their tables survive, the block between them does not");
    });

    test("bytes in the picture data that look like markers do not end it early", () => {
      // 0xFF 0x00 is a data byte, 0xFF 0xD0-0xD7 are restart markers, 0xFF 0xFF 0x00 is padding then a data byte
      // (libjpeg reads it so), and 0xFF 0xFF before the end is padding.
      const data = Buffer.from([0x12, 0xff, 0x00, 0xff, 0x00, 0xff, 0xd0, 0xff, 0xd7, 0x34, 0xff, 0xff, 0x00, 0x56]);
      const dirty = Buffer.concat([F.SOI, F.exifSeg({ gps: true }), parts.dqt, parts.sof, parts.dhtDc, parts.dhtAc, parts.sos, data, Buffer.from([0xff, 0xff, 0xd9])]);
      const expected = F.jpegFile(parts.dqt, parts.sof, parts.dhtDc, parts.dhtAc, parts.sos, data);
      assert.ok(strip(dirty, "jpg").equals(expected), "the picture data comes through exactly, markers and padding inside it included");
    });

    test("padding bytes before a marker are fine, and are not kept", () => {
      const dirty = Buffer.concat([F.SOI, Buffer.from([0xff, 0xff]), parts.dqt, parts.sof, parts.dhtDc, parts.dhtAc, parts.sos, parts.scan, F.EOI]);
      assert.ok(strip(dirty, "jpg").equals(F.grayJpeg()), "the same picture as one that never had the padding");
    });

    test("a photo with a picture hidden after its end (a motion photo's video) is cut at the end", () => {
      const clean = strip(F.grayJpeg([], Buffer.concat([F.SOI, F.exifSeg({ gps: true }), F.ascii("ftypmp4 more video")])), "jpg");
      assert.ok(clean.equals(F.grayJpeg()), "just the picture, ending at its own end marker");
    });
  });

  describe("a file that cannot be read all the way through is refused", () => {
    const p = F.grayJpegParts();
    const body = [p.dqt, p.sof, p.dhtDc, p.dhtAc];
    const cases: Array<[string, Buffer]> = [
      ["an empty file", Buffer.alloc(0)],
      ["only the start marker", F.SOI],
      ["not a picture at all", F.ascii("this is plainly text, and nowhere near a picture")],
      ["a PNG sent as a JPEG", F.tinyPng()],
      ["a stray byte between segments", Buffer.concat([F.SOI, p.dqt, Buffer.from([0x00]), p.sof, p.dhtDc, p.dhtAc, p.sos, p.scan, F.EOI])],
      ["a segment longer than the file", Buffer.concat([F.SOI, Buffer.from([0xff, 0xe1, 0xff, 0xff, 0x41, 0x42]), ...body, p.sos, p.scan, F.EOI])],
      ["a segment length of 1", Buffer.concat([F.SOI, Buffer.from([0xff, 0xe1, 0x00, 0x01]), ...body, p.sos, p.scan, F.EOI])],
      ["picture data before the frame header", Buffer.concat([F.SOI, p.dqt, p.dhtDc, p.dhtAc, p.sos, p.scan, F.EOI])],
      ["no picture data at all", F.jpegFile(...body)],
      ["picture data that never ends", Buffer.concat([F.SOI, ...body, p.sos, Buffer.from([0x12, 0x34, 0x56])])],
      ["a reserved marker", Buffer.concat([F.SOI, Buffer.from([0xff, 0x02, 0x00, 0x04, 0x00, 0x00]), ...body, p.sos, p.scan, F.EOI])],
      ["a JPEG-LS extension marker", Buffer.concat([F.SOI, Buffer.from([0xff, 0xf8, 0x00, 0x04, 0x00, 0x00]), ...body, p.sos, p.scan, F.EOI])],
      ["a second start marker", Buffer.concat([F.SOI, F.SOI, ...body, p.sos, p.scan, F.EOI])],
      ["a restart marker between segments", Buffer.concat([F.SOI, Buffer.from([0xff, 0xd0]), ...body, p.sos, p.scan, F.EOI])],
      ["a file that stops in the middle of a marker", Buffer.concat([F.SOI, p.dqt, Buffer.from([0xff])])],
    ];
    for (const [label, file] of cases) {
      test(label, () => refused(file, "jpg", label));
    }

    test("a file cut short anywhere before its end marker, however long it was", () => {
      const whole = F.grayJpeg(EVERYTHING());
      for (let length = 0; length < whole.length; length++) refused(whole.subarray(0, length), "jpg", `a cut at ${length} of ${whole.length}`);
    });

    test("the reason says what was wrong, but the message to show a person is always the same", () => {
      let reason = "";
      let message = "";
      try {
        strip(F.grayJpeg().subarray(0, 40), "jpg");
      } catch (err) {
        reason = (err as UnreadableImageError).reason;
        message = (err as UnreadableImageError).message;
      }
      assert.match(reason, /^jpeg: /);
      assert.equal(message, "That photo couldn't be read. It may be damaged. Please take it again or choose a different one.");
    });
  });
});

/* ------------------------------------- PNG ------------------------------------ */

const pngText = () => F.pngChunk("tEXt", F.ascii(`Comment\0${F.SECRETS.text}`));
const pngCompressedText = () => F.pngChunk("zTXt", Buffer.concat([F.ascii("Comment\0"), Buffer.from([0]), zlib.deflateSync(F.ascii(F.SECRETS.text))]));
const pngXmp = () =>
  F.pngChunk("iTXt", Buffer.concat([F.ascii("XML:com.adobe.xmp\0"), Buffer.from([0, 0]), F.ascii("\0\0"), F.ascii(`<x:xmpmeta>${F.SECRETS.xmp}</x:xmpmeta>`)]));
const pngExif = (opts: F.ExifOptions = { gps: true }) => F.pngChunk("eXIf", F.exifTiff(opts));
const pngTime = () => F.pngChunk("tIME", Buffer.from([0x07, 0xea, 10, 23, 12, 34, 56]));
const pngPrivate = () => F.pngChunk("caBX", F.ascii(F.SECRETS.block)); // where content credentials are kept
const PNG_DRAWING_CHUNKS = [
  F.pngChunk("gAMA", Buffer.alloc(4, 1)),
  F.pngChunk("cHRM", Buffer.alloc(32, 2)),
  F.pngChunk("sRGB", Buffer.alloc(1)),
  F.pngChunk("iCCP", Buffer.concat([F.ascii("icc\0"), Buffer.from([0]), zlib.deflateSync(F.ascii("pretend profile"))])),
  F.pngChunk("sBIT", Buffer.alloc(3, 8)),
  F.pngChunk("bKGD", Buffer.alloc(6, 3)),
  F.pngChunk("tRNS", Buffer.alloc(6, 4)),
  F.pngChunk("pHYs", Buffer.alloc(9, 5)),
  F.pngChunk("hIST", Buffer.alloc(4, 6)),
  F.pngChunk("sPLT", Buffer.concat([F.ascii("palette\0"), Buffer.from([8]), Buffer.alloc(6, 7)])),
  F.pngChunk("cICP", Buffer.from([1, 13, 0, 1])),
  F.pngChunk("mDCV", Buffer.alloc(24, 8)),
  F.pngChunk("cLLI", Buffer.alloc(8, 9)),
];
const pngTypes = (file: Buffer) => F.pngChunks(file).map((c) => c.type);

describe("a PNG", () => {
  test("its text, XMP, Exif, time stamp and unregistered chunks go, with anything after the end", () => {
    const extras = {
      afterHeader: [pngText(), pngCompressedText(), pngXmp(), pngExif({ gps: true, thumbnail: THUMBNAIL }), pngTime(), pngPrivate()],
      beforeEnd: [pngText(), pngPrivate()],
    };
    const dirty = F.tinyPng({ ...extras, trailer: F.ascii(`${F.SECRETS.block} left after the end`) });
    const clean = strip(dirty, "png");
    assert.equal(pngTypes(F.tinyPng(extras)).length, 11, "the sample has all the extras");
    assert.deepEqual(pngTypes(clean), ["IHDR", "IDAT", "IEND"], "only the header, the picture and the end are left");
    assert.deepEqual([...clean.subarray(0, 8)], [...F.PNG_SIGNATURE]);
    noSecrets(clean, "png");
    assert.ok(!clean.includes(THUMBNAIL), "no thumbnail");
    assert.ok(clean.equals(F.tinyPng()), "the result is the picture on its own, byte for byte");

    const decoded = F.decodePng(clean);
    assert.deepEqual([decoded.width, decoded.height], [4, 3]);
    assert.ok(decoded.rgb.equals(F.tinyPngPixels(4, 3)), "it decodes to the same pixels");
    assert.deepEqual(imageSize(clean, "png"), imageSize(dirty, "png"), "same size");
  });

  test("the chunks that change how it is drawn stay, as the same bytes, in the same order", () => {
    const dirty = F.tinyPng({ afterHeader: [PNG_DRAWING_CHUNKS[0], pngText(), ...PNG_DRAWING_CHUNKS.slice(1)] });
    const clean = strip(dirty, "png");
    assert.deepEqual(pngTypes(clean), ["IHDR", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "bKGD", "tRNS", "pHYs", "hIST", "sPLT", "cICP", "mDCV", "cLLI", "IDAT", "IEND"]);
    assert.ok(clean.equals(F.tinyPng({ afterHeader: PNG_DRAWING_CHUNKS })), "and nothing else changed");
  });

  test("animation chunks stay", () => {
    const animation = [F.pngChunk("acTL", Buffer.alloc(8, 1)), F.pngChunk("fcTL", Buffer.alloc(26, 2))];
    const frames = [F.pngChunk("fcTL", Buffer.alloc(26, 3)), F.pngChunk("fdAT", Buffer.alloc(12, 4))];
    const dirty = F.tinyPng({ afterHeader: [...animation, pngText()], beforeEnd: [...frames, pngXmp()] });
    assert.deepEqual(pngTypes(strip(dirty, "png")), ["IHDR", "acTL", "fcTL", "IDAT", "fcTL", "fdAT", "IEND"]);
  });

  test("a file from a real encoder comes out byte for byte the same", () => {
    assert.deepEqual(pngTypes(F.REAL_PNG), ["IHDR", "pHYs", "IDAT", "IEND"], "the sample is as expected");
    assert.ok(strip(F.REAL_PNG, "png").equals(F.REAL_PNG), "nothing to take out, so the same bytes come back");
  });

  test("stripping twice changes nothing more", () => {
    const once = strip(F.tinyPng({ afterHeader: [pngExif({ orientation: 6, gps: true }), pngText()] }), "png");
    assert.ok(strip(once, "png").equals(once), "idempotent");
  });

  test("an Orientation other than normal is kept, alone, right after the header, with a good checksum", () => {
    for (const little of [false, true]) {
      for (const orientation of [2, 3, 4, 5, 6, 7, 8]) {
        const clean = strip(F.tinyPng({ beforeEnd: [pngExif({ orientation, gps: true, little, thumbnail: THUMBNAIL }), pngText()] }), "png");
        const label = `orientation ${orientation}, ${little ? "little" : "big"}-endian`;
        assert.deepEqual(pngTypes(clean), ["IHDR", "eXIf", "IDAT", "IEND"], label);
        const exif = F.pngChunks(clean)[1].data; // pngChunks has checked every checksum, the new one included
        assert.equal(exif.length, 26, `${label}: smallest possible`);
        assert.deepEqual(F.exifSummary(exif), { tags: [0x0112], values: { 0x0112: orientation }, next: 0 }, label);
        assert.ok(exif.equals(F.orientationOnlyTiff(orientation)), `${label}: exactly the bytes of an Orientation-only block`);
        noSecrets(clean, label);
        assert.ok(F.decodePng(clean).rgb.equals(F.tinyPngPixels(4, 3)), `${label}: same pixels`);
      }
    }
  });

  test("a normal, missing or impossible Orientation leaves no Exif", () => {
    for (const opts of [{ orientation: 1, gps: true }, { gps: true }, { orientation: 0, gps: true }, { orientation: 9, gps: true }]) {
      const clean = strip(F.tinyPng({ afterHeader: [pngExif(opts)] }), "png");
      assert.deepEqual(pngTypes(clean), ["IHDR", "IDAT", "IEND"], JSON.stringify(opts));
    }
  });

  test("a picture split over several IDAT chunks keeps all of them", () => {
    const idat = F.pngChunks(F.tinyPng({ width: 20, height: 20 })).find((c) => c.type === "IDAT")!.data;
    const half = Math.floor(idat.length / 2);
    const split = Buffer.concat([F.PNG_SIGNATURE, F.pngIhdr(20, 20), pngText(), F.pngChunk("IDAT", idat.subarray(0, half)), F.pngChunk("IDAT", idat.subarray(half)), F.pngChunk("IEND")]);
    const clean = strip(split, "png");
    assert.deepEqual(pngTypes(clean), ["IHDR", "IDAT", "IDAT", "IEND"]);
    assert.ok(F.decodePng(clean).rgb.equals(F.tinyPngPixels(20, 20)), "it still decodes to the same pixels");
  });

  describe("a file that cannot be read all the way through is refused", () => {
    const good = F.tinyPng();
    const cases: Array<[string, Buffer]> = [
      ["an empty file", Buffer.alloc(0)],
      ["only the signature", F.PNG_SIGNATURE],
      ["a signature that is wrong after its first four bytes", Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]), good.subarray(8)])],
      ["a JPEG sent as a PNG", F.grayJpeg()],
      ["a first chunk that is not the header", Buffer.concat([F.PNG_SIGNATURE, pngText(), F.pngIhdr(4, 3), F.pngIdat(4, 3), F.pngChunk("IEND")])],
      ["a header of the wrong length", Buffer.concat([F.PNG_SIGNATURE, F.pngChunk("IHDR", Buffer.alloc(12)), F.pngIdat(4, 3), F.pngChunk("IEND")])],
      ["a chunk longer than the file", Buffer.concat([F.PNG_SIGNATURE, F.pngIhdr(4, 3), Buffer.from([0x00, 0xff, 0xff, 0xff]), F.ascii("tEXt"), Buffer.alloc(20)])],
      ["a chunk whose length is absurd", Buffer.concat([F.PNG_SIGNATURE, F.pngIhdr(4, 3), Buffer.from([0xff, 0xff, 0xff, 0xff]), F.ascii("tEXt"), Buffer.alloc(20)])],
      ["a chunk with a name that is not letters", Buffer.concat([F.PNG_SIGNATURE, F.pngIhdr(4, 3), F.pngChunk("t3xt", F.ascii("x")), F.pngIdat(4, 3), F.pngChunk("IEND")])],
      ["no picture data", Buffer.concat([F.PNG_SIGNATURE, F.pngIhdr(4, 3), F.pngChunk("IEND")])],
      ["no end chunk", Buffer.concat([F.PNG_SIGNATURE, F.pngIhdr(4, 3), F.pngIdat(4, 3)])],
      ["a required chunk nobody has defined", Buffer.concat([F.PNG_SIGNATURE, F.pngIhdr(4, 3), F.pngChunk("ZZZZ", Buffer.alloc(4)), F.pngIdat(4, 3), F.pngChunk("IEND")])],
    ];
    for (const [label, file] of cases) {
      test(label, () => refused(file, "png", label));
    }

    test("a file cut short anywhere before its end chunk, however long it was", () => {
      const whole = F.tinyPng({ afterHeader: [pngText(), pngExif()] });
      for (let length = 0; length < whole.length; length++) refused(whole.subarray(0, length), "png", `a cut at ${length} of ${whole.length}`);
    });
  });
});

/* ------------------------------------- WebP ----------------------------------- */

const exifBlock = (opts: F.ExifOptions = { gps: true }) => F.exifTiff(opts);
const xmpBlock = () => F.ascii(`<x:xmpmeta>${F.SECRETS.xmp}</x:xmpmeta>`);
const iccBlock = () => F.ascii("pretend colour profile");
const oddJunk = () => F.ascii(`${F.SECRETS.block}!`); // an odd number of bytes, so it is padded
const ids = (file: Buffer) => F.webpChunks(file).map((c) => c.id);
const flags = (file: Buffer) => F.webpChunks(file)[0].data[0];

describe("a WebP", () => {
  const pictures: Array<[string, Buffer, string]> = [
    ["lossy", F.WEBP_LOSSY, "VP8 "],
    ["lossless", F.WEBP_LOSSLESS, "VP8L"],
  ];

  for (const [label, plain, pictureId] of pictures) {
    test(`a ${label} picture loses its Exif and XMP and anything unregistered, and keeps its colour profile`, () => {
      const dirty = F.extendedWebp(plain, { icc: iccBlock(), exif: exifBlock({ gps: true, thumbnail: THUMBNAIL }), xmp: xmpBlock(), unknown: oddJunk() });
      assert.deepEqual(ids(dirty), ["VP8X", "ICCP", pictureId, "EXIF", "XMP ", "JUNK"], "the sample has all the extras");
      const clean = strip(dirty, "webp");

      assert.deepEqual(ids(clean), ["VP8X", "ICCP", pictureId], "only the header, the profile and the picture are left");
      assert.equal(flags(clean) & 0x0c, 0, "the header no longer claims Exif or XMP");
      assert.equal(flags(clean) & 0x20, 0x20, "it still says there is a colour profile");
      assert.ok(F.webpChunks(clean)[1].data.equals(iccBlock()), "the profile is untouched");
      assert.ok(F.webpChunks(clean)[2].data.equals(F.webpChunks(plain)[0].data), "the picture is the same bytes as the encoder wrote");
      noSecrets(clean, `webp ${label}`);
      assert.ok(!clean.includes(THUMBNAIL), "no thumbnail");
      assert.deepEqual(imageSize(clean, "webp"), imageSize(dirty, "webp"), "same size");
      assert.deepEqual(imageSize(clean, "webp"), { width: 16, height: 16 });
    });
  }

  test("transparency (alpha) stays", () => {
    const dirty = F.addWebpChunks(F.WEBP_ALPHA, [{ id: "EXIF", data: exifBlock() }, { id: "XMP ", data: xmpBlock() }], 0x0c);
    assert.deepEqual(ids(dirty), ["VP8X", "ALPH", "VP8 ", "EXIF", "XMP "]);
    const clean = strip(dirty, "webp");
    assert.deepEqual(ids(clean), ["VP8X", "ALPH", "VP8 "]);
    assert.equal(flags(clean) & 0x1c, 0x10, "alpha flag on, Exif and XMP flags off");
    assert.ok(clean.equals(F.WEBP_ALPHA), "the same file the encoder wrote");
  });

  test("animation stays, frame by frame", () => {
    const dirty = F.addWebpChunks(F.WEBP_ANIMATED, [{ id: "EXIF", data: exifBlock() }, { id: "XMP ", data: xmpBlock() }], 0x0c);
    const clean = strip(dirty, "webp");
    assert.deepEqual(ids(clean), ["VP8X", "ANIM", "ANMF", "ANMF"]);
    assert.ok(clean.equals(F.WEBP_ANIMATED), "the same file the encoder wrote");
  });

  test("a plain WebP, and a real encoder's files, come out byte for byte the same", () => {
    for (const file of [F.WEBP_LOSSY, F.WEBP_LOSSLESS, F.WEBP_ALPHA, F.WEBP_ANIMATED]) {
      assert.ok(strip(file, "webp").equals(file), `${file.length}-byte sample: nothing to take out, so the same bytes come back`);
    }
  });

  test("a block with an odd number of bytes is dropped without upsetting the padding of the ones after it", () => {
    const dirty = F.webpFile(
      F.webpChunkBytes("VP8X", Buffer.from([0x08, 0, 0, 0, 15, 0, 0, 15, 0, 0])),
      F.webpChunkBytes("JUNK", oddJunk()),
      F.webpChunkBytes("ICCP", Buffer.from("odd")),
      F.webpChunkBytes("VP8L", F.webpChunks(F.WEBP_LOSSLESS)[0].data)
    );
    const clean = strip(dirty, "webp");
    assert.deepEqual(ids(clean), ["VP8X", "ICCP", "VP8L"]);
    assert.equal(F.webpChunks(clean)[1].data.toString(), "odd");
  });

  test("anything after the end the file states is not kept", () => {
    const dirty = Buffer.concat([F.extendedWebp(F.WEBP_LOSSY, { exif: exifBlock() }), F.ascii(F.SECRETS.block)]);
    const clean = strip(dirty, "webp");
    assert.deepEqual(ids(clean), ["VP8X", "VP8 "]);
    noSecrets(clean, "webp trailer");
  });

  test("stripping twice changes nothing more", () => {
    const once = strip(F.extendedWebp(F.WEBP_LOSSY, { exif: exifBlock({ orientation: 8, gps: true }), xmp: xmpBlock() }), "webp");
    assert.ok(strip(once, "webp").equals(once), "idempotent");
  });

  test("an Orientation other than normal is kept, alone, as the last block, and the header says so", () => {
    for (const little of [false, true]) {
      for (const orientation of [2, 3, 4, 5, 6, 7, 8]) {
        const label = `orientation ${orientation}, ${little ? "little" : "big"}-endian`;
        const dirty = F.extendedWebp(F.WEBP_LOSSY, { icc: iccBlock(), exif: exifBlock({ orientation, gps: true, little, thumbnail: THUMBNAIL }), xmp: xmpBlock() });
        const clean = strip(dirty, "webp");
        assert.deepEqual(ids(clean), ["VP8X", "ICCP", "VP8 ", "EXIF"], label);
        assert.equal(flags(clean) & 0x0c, 0x08, `${label}: Exif flag on, XMP flag off`);
        const exif = F.webpChunks(clean)[3].data;
        assert.equal(exif.length, 26, `${label}: smallest possible`);
        assert.deepEqual(F.exifSummary(exif), { tags: [0x0112], values: { 0x0112: orientation }, next: 0 }, label);
        assert.ok(exif.equals(F.orientationOnlyTiff(orientation)), `${label}: exactly the bytes of an Orientation-only block`);
        noSecrets(clean, label);
      }
    }
  });

  test("an Exif block that starts with the six-byte Exif label is read too", () => {
    const labelled = Buffer.concat([F.ascii("Exif\0\0"), exifBlock({ orientation: 6, gps: true })]);
    const clean = strip(F.extendedWebp(F.WEBP_LOSSY, { exif: labelled }), "webp");
    assert.equal(F.exifSummary(F.webpChunks(clean)[2].data).values[0x0112], 6);
  });

  test("a normal, missing or impossible Orientation leaves no Exif and clears the flag", () => {
    for (const opts of [{ orientation: 1, gps: true }, { gps: true }, { orientation: 0, gps: true }, { orientation: 9, gps: true }]) {
      const clean = strip(F.extendedWebp(F.WEBP_LOSSY, { exif: exifBlock(opts) }), "webp");
      assert.deepEqual(ids(clean), ["VP8X", "VP8 "], JSON.stringify(opts));
      assert.equal(flags(clean) & 0x0c, 0, JSON.stringify(opts));
    }
  });

  describe("a file that cannot be read all the way through is refused", () => {
    const image = F.webpChunks(F.WEBP_LOSSLESS)[0].data;
    const header = F.webpChunkBytes("VP8X", Buffer.from([0, 0, 0, 0, 15, 0, 0, 15, 0, 0]));
    const stated = (size: number, ...chunks: Buffer[]) => {
      const file = F.webpFile(...chunks);
      file.writeUInt32LE(size, 4);
      return file;
    };
    const cases: Array<[string, Buffer]> = [
      ["an empty file", Buffer.alloc(0)],
      ["not a WebP at all", F.ascii("RIFF plainly not a picture, but long enough to look like one")],
      ["a PNG sent as a WebP", F.tinyPng()],
      ["a size that is larger than the file", stated(F.WEBP_LOSSLESS.length + 100, F.webpChunkBytes("VP8L", image))],
      ["a size too small to hold anything", stated(4, F.webpChunkBytes("VP8L", image))],
      ["a chunk that runs past the end", (() => { const f = Buffer.from(F.WEBP_LOSSLESS); f.writeUInt32LE(5000, 16); return f; })()],
      ["no picture in it", F.webpFile(header)],
      ["something other than a picture first", F.webpFile(F.webpChunkBytes("JUNK", Buffer.alloc(4)), F.webpChunkBytes("VP8L", image))],
      ["a second extended header", F.webpFile(header, header, F.webpChunkBytes("VP8L", image))],
      ["an extended header that is too short", F.webpFile(F.webpChunkBytes("VP8X", Buffer.alloc(4)), F.webpChunkBytes("VP8L", image))],
    ];
    for (const [label, file] of cases) {
      test(label, () => refused(file, "webp", label));
    }

    test("a file cut short anywhere, however long it was", () => {
      const whole = F.extendedWebp(F.WEBP_LOSSY, { exif: exifBlock(), xmp: xmpBlock() });
      // Cutting the file also shortens what it is - the stated size no longer fits, so every cut is refused.
      for (let length = 0; length < whole.length; length++) refused(whole.subarray(0, length), "webp", `a cut at ${length} of ${whole.length}`);
    });
  });
});

/* ------------------------------ keeping a photo ------------------------------- */

const filesOnDisk = () => (fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR).length : 0);
const stored = (publicPath: string) => fs.readFileSync(path.join(UPLOADS_DIR, path.basename(publicPath)));

const DIRTY: Array<[string, "jpg" | "png" | "webp", Buffer]> = [
  ["jpg", "jpg", F.grayJpeg([F.jfifSeg(), F.exifSeg({ orientation: 6, gps: true, thumbnail: THUMBNAIL }), F.xmpSeg(), F.iptcSeg(), F.commentSeg()], MOTION_VIDEO)],
  ["png", "png", F.tinyPng({ afterHeader: [pngExif({ orientation: 6, gps: true }), pngText(), pngXmp(), pngTime()], trailer: MOTION_VIDEO })],
  ["webp", "webp", F.extendedWebp(F.WEBP_LOSSY, { exif: exifBlock({ orientation: 6, gps: true }), xmp: xmpBlock(), unknown: oddJunk() })],
];

describe("keeping a photo", () => {
  for (const [label, kind, dirty] of DIRTY) {
    test(`what is written for a ${label} is the cleaned photo, never the bytes as they came`, () => {
      const publicPath = saveUpload("device-keep", dirty, kind);
      assert.match(publicPath, /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/);
      const onDisk = stored(publicPath);
      assert.ok(onDisk.equals(strip(dirty, kind)), "the file is the stripped photo");
      assert.ok(!onDisk.equals(dirty), "and not the original");
      noSecrets(onDisk, `stored ${label}`);
    });
  }

  test("a photo that cannot be read is refused, and nothing is written or recorded", () => {
    const damaged = DIRTY[0][2].subarray(0, 60);
    const files = filesOnDisk();
    const owned = uploadsBy("device-refused").length;
    assert.throws(() => saveUpload("device-refused", damaged, "jpg"), isRefusal);
    assert.equal(filesOnDisk(), files, "no file");
    assert.equal(uploadsBy("device-refused").length, owned, "no record");
  });

  test("trySaveUpload gives the message to show instead of throwing, and a path when it worked", () => {
    const files = filesOnDisk();
    const bad = trySaveUpload("device-try", DIRTY[0][2].subarray(0, 60), "jpg");
    assert.ok("error" in bad && /couldn't be read/.test(bad.error), "a message");
    assert.equal(filesOnDisk(), files, "nothing written");
    const good = trySaveUpload("device-try", DIRTY[1][2], "png");
    assert.ok("path" in good && stored(good.path).equals(strip(DIRTY[1][2], "png")), "a path to the cleaned photo");
  });

  test("a refused photo is logged with the technical reason and nothing out of the photo", () => {
    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
    try {
      trySaveUpload("device-log", DIRTY[0][2].subarray(0, 60), "jpg");
      trySaveUpload("device-log", DIRTY[1][2], "png"); // a good one logs nothing
    } finally {
      console.log = log;
    }
    assert.equal(lines.length, 1, `one line, for the refusal: ${JSON.stringify(lines)}`);
    assert.match(lines[0], /^photo refused: jpeg: [a-z ]+$/);
    noSecrets(Buffer.from(lines[0], "latin1"), "the log line");
  });

  test("an error that is not a refusal (a bug) is not dressed up as a damaged photo", () => {
    const log = console.log;
    console.log = () => {};
    try {
      assert.throws(() => trySaveUpload("device-bug", null as unknown as Buffer, "jpg"), TypeError, "it surfaces as the error it is");
    } finally {
      console.log = log;
    }
  });

  test("a photo that is not the kind the caller says it is, is refused", () => {
    const files = filesOnDisk();
    assert.ok("error" in trySaveUpload("device-kind", F.tinyPng(), "jpg"), "a PNG saved as a JPEG");
    assert.ok("error" in trySaveUpload("device-kind", F.grayJpeg(), "webp"), "a JPEG saved as a WebP");
    assert.equal(filesOnDisk(), files);
  });
});

/* -------------------------------- the upload route ----------------------------- */

describe("the upload route", () => {
  let server: http.Server;
  let base = "";

  before(async () => {
    delete process.env.REQUIRE_ACCOUNT;
    const app = express();
    app.use(express.json({ limit: "10mb" }));
    registerUploadsRoute(app);
    await new Promise<void>((ok) => {
      server = app.listen(0, "127.0.0.1", () => ok());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => {
    server?.closeAllConnections();
    server?.close();
  });

  async function upload(imageBase64: string, device = "route-device") {
    const res = await fetch(`${base}/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-id": device },
      body: JSON.stringify({ imageBase64 }),
    });
    return { status: res.status, json: (await res.json()) as any };
  }
  async function download(publicPath: string) {
    const res = await fetch(base + publicPath);
    return { status: res.status, type: res.headers.get("content-type"), bytes: Buffer.from(await res.arrayBuffer()) };
  }

  for (const [label, kind, dirty] of DIRTY) {
    test(`a ${label} sent with its hidden details is served back without them`, async () => {
      const up = await upload(dirty.toString("base64"));
      assert.equal(up.status, 200);
      assert.equal(up.json.ok, true);
      const got = await download(up.json.path);
      assert.equal(got.status, 200);
      assert.equal(got.type, kind === "jpg" ? "image/jpeg" : `image/${kind}`);
      assert.ok(got.bytes.equals(strip(dirty, kind)), "what anyone can fetch is the cleaned photo");
      noSecrets(got.bytes, `served ${label}`);
    });
  }

  test("a photo sent as a data address is cleaned the same", async () => {
    const up = await upload(`data:image/jpeg;base64,${DIRTY[0][2].toString("base64")}`);
    assert.equal(up.status, 200);
    assert.ok((await download(up.json.path)).bytes.equals(strip(DIRTY[0][2], "jpg")), "served back cleaned");
  });

  test("a photo that starts right but cannot be read is refused with a message, and nothing is kept", async () => {
    const files = filesOnDisk();
    const owned = uploadsBy("route-bad").length;
    const attempts: Buffer[] = [
      DIRTY[0][2].subarray(0, 300), // a JPEG cut short
      Buffer.concat([F.PNG_SIGNATURE, Buffer.alloc(300, 7)]), // the start of a PNG, then nothing a PNG has
      F.WEBP_LOSSY.subarray(0, 200), // a WebP cut short
      Buffer.concat([F.SOI, Buffer.from([0xff]), Buffer.alloc(300, 9)]), // the start of a JPEG, then junk
    ];
    for (const file of attempts) {
      const up = await upload(file.toString("base64"), "route-bad");
      assert.equal(up.status, 400);
      assert.equal(up.json.ok, false);
      assert.match(up.json.error, /couldn't be read/);
    }
    assert.equal(filesOnDisk(), files, "nothing written");
    assert.equal(uploadsBy("route-bad").length, owned, "nothing recorded against the phone");
  });

  test("the checks that came before still say what they did", async () => {
    const text = Buffer.from("this is only text, though it is long enough to be mistaken for a photo. ".repeat(3)).toString("base64");
    const notPicture = await upload(text);
    assert.equal(notPicture.status, 400);
    assert.equal(notPicture.json.error, "Only JPEG, PNG or WebP photos are allowed");
    assert.equal((await upload("x")).status, 400);
  });
});

/* ------------------------------- advert pictures ------------------------------ */

describe("advert pictures", () => {
  const dataUrl = (file: Buffer, mime: string) => `data:${mime};base64,${file.toString("base64")}`;

  test("a picture for an advert is kept without its hidden details", () => {
    for (const [label, kind, dirty] of DIRTY) {
      const saved = storeImage(dataUrl(dirty, kind === "jpg" ? "image/jpeg" : `image/${kind}`));
      assert.ok("path" in saved, `${label}: kept`);
      if (!("path" in saved)) continue;
      assert.ok(stored(saved.path).equals(strip(dirty, kind)), `${label}: cleaned`);
    }
  });

  test("a picture for an advert that cannot be read is refused with the message, and nothing is kept", () => {
    const files = filesOnDisk();
    const refusedPicture = storeImage(dataUrl(DIRTY[0][2].subarray(0, 300), "image/jpeg"));
    assert.ok("error" in refusedPicture && /couldn't be read/.test(refusedPicture.error), "a message");
    assert.equal(filesOnDisk(), files);
  });

  test("a full-page design is cleaned too, and its size is the same afterwards", () => {
    const design = F.tinyPng({ width: 720, height: 1280, afterHeader: [pngExif({ gps: true }), pngText(), pngXmp()] });
    const saved = storeArtwork(dataUrl(design, "image/png"));
    assert.ok("path" in saved, "accepted");
    if (!("path" in saved)) return;
    const onDisk = stored(saved.path);
    assert.deepEqual(pngTypes(onDisk), ["IHDR", "IDAT", "IEND"]);
    assert.deepEqual(imageSize(onDisk, "png"), { width: 720, height: 1280 });
    noSecrets(onDisk, "design");
  });
});

/* ------------------------- whatever arrives, never kept as it came ---------------------- */

// A few thousand damaged copies of each kind of file. Whatever comes in, the answer is either a refusal (and only that
// kind of failure) or a file that is still well formed and holds nothing but the allowed blocks.

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function damage(source: Buffer, next: () => number): Buffer {
  const pick = (n: number) => Math.floor(next() * n);
  const b = Buffer.from(source);
  switch (pick(7)) {
    case 0:
      for (let i = 0, n = 1 + pick(4); i < n; i++) b[pick(b.length)] = pick(256);
      return b;
    case 1:
      return b.subarray(0, pick(b.length));
    case 2: {
      const at = pick(b.length);
      return Buffer.concat([b.subarray(0, at), b.subarray(Math.min(b.length, at + 1 + pick(40)))]);
    }
    case 3: {
      const at = pick(b.length + 1);
      return Buffer.concat([b.subarray(0, at), Buffer.from(Array.from({ length: 1 + pick(8) }, () => pick(256))), b.subarray(at)]);
    }
    case 4: {
      const at = pick(b.length);
      const extreme = [0xff, 0x00, 0x7f, 0x80][pick(4)];
      b[at] = extreme;
      if (at + 1 < b.length) b[at + 1] = extreme;
      return b;
    }
    case 5: {
      const at = pick(b.length);
      return Buffer.concat([b.subarray(0, at + 1 + pick(30)), b.subarray(at)]);
    }
    default:
      b[pick(b.length)] ^= 1 << pick(8);
      return b;
  }
}

const startsWith = (b: Buffer, text: string) => b.toString("latin1", 0, text.length) === text;

function wellFormedJpeg(out: Buffer) {
  const parts = F.jpegSegments(out); // strict: throws if the structure is wrong
  for (const { marker, body } of parts) {
    if (marker === -1 || marker === 0xd9 || marker === 0xda) continue;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc8;
    const isTable = [0xdb, 0xdc, 0xdd, 0xde, 0xdf].includes(marker);
    const isJfif = marker === 0xe0 && body.length === 14 && startsWith(body, "JFIF\0");
    const isIcc = marker === 0xe2 && startsWith(body, "ICC_PROFILE\0");
    const isAdobe = marker === 0xee && startsWith(body, "Adobe");
    const isOrientation = marker === 0xe1 && body.length === 32 && F.exifSummary(body.subarray(6)).tags.join() === "274";
    assert.ok(isFrame || isTable || isJfif || isIcc || isAdobe || isOrientation, `segment ${marker.toString(16)} is one that may be kept`);
  }
}

function wellFormedPng(out: Buffer) {
  assert.ok(out.subarray(0, 8).equals(F.PNG_SIGNATURE), "signature");
  const allowed = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "bKGD", "hIST", "pHYs", "sPLT", "cICP", "mDCV", "cLLI", "acTL", "fcTL", "fdAT", "eXIf"]);
  const types: string[] = [];
  let pos = 8;
  while (pos < out.length) {
    const length = out.readUInt32BE(pos);
    assert.ok(pos + 12 + length <= out.length, "a chunk fits in the file");
    const type = out.toString("latin1", pos + 4, pos + 8);
    assert.ok(allowed.has(type), `chunk ${type} is one that may be kept`);
    if (type === "eXIf") assert.equal(length, 26, "only the Orientation-only Exif");
    types.push(type);
    pos += 12 + length;
  }
  assert.equal(pos, out.length, "nothing after the last chunk");
  assert.equal(types[0], "IHDR");
  assert.equal(types[types.length - 1], "IEND");
  assert.ok(types.includes("IDAT"), "there is picture data");
}

function wellFormedWebp(out: Buffer) {
  const chunks = F.webpChunks(out); // strict
  const allowed = new Set(["VP8X", "ICCP", "ANIM", "ANMF", "ALPH", "VP8 ", "VP8L", "EXIF"]);
  for (const { id, data } of chunks) {
    assert.ok(allowed.has(id), `chunk ${id} is one that may be kept`);
    if (id === "EXIF") assert.equal(data.length, 26, "only the Orientation-only Exif");
  }
  if (chunks[0].id === "VP8X") {
    assert.equal((chunks[0].data[0] & 0x08) !== 0, chunks.some((c) => c.id === "EXIF"), "the header's Exif flag matches");
    assert.equal(chunks[0].data[0] & 0x04, 0, "no XMP flag");
  }
}

describe("whatever arrives is never kept as it came", () => {
  const SAMPLES: Array<[string, "jpg" | "png" | "webp", Buffer, (out: Buffer) => void]> = [
    ["a JPEG with everything", "jpg", F.grayJpeg(EVERYTHING(), MOTION_VIDEO), wellFormedJpeg],
    ["a JPEG with an Orientation", "jpg", F.grayJpeg([F.jfifSeg(), F.exifSeg({ orientation: 6, gps: true }), F.iccSeg(), F.adobeSeg()]), wellFormedJpeg],
    ["a real encoder's JPEG", "jpg", F.REAL_JPEG, wellFormedJpeg],
    ["a PNG with everything", "png", F.tinyPng({ afterHeader: [pngExif({ orientation: 3, gps: true }), pngText(), pngXmp(), ...PNG_DRAWING_CHUNKS], beforeEnd: [pngPrivate()], trailer: MOTION_VIDEO }), wellFormedPng],
    ["a real encoder's PNG", "png", F.REAL_PNG, wellFormedPng],
    ["a WebP with everything", "webp", F.extendedWebp(F.WEBP_LOSSY, { icc: iccBlock(), exif: exifBlock({ orientation: 8, gps: true }), xmp: xmpBlock(), unknown: oddJunk() }), wellFormedWebp],
    ["a lossless WebP", "webp", F.WEBP_LOSSLESS, wellFormedWebp],
    ["a WebP with transparency", "webp", F.addWebpChunks(F.WEBP_ALPHA, [{ id: "EXIF", data: exifBlock() }], 0x08), wellFormedWebp],
    ["an animated WebP", "webp", F.addWebpChunks(F.WEBP_ANIMATED, [{ id: "XMP ", data: xmpBlock() }], 0x04), wellFormedWebp],
  ];

  for (const [label, kind, sample, check] of SAMPLES) {
    test(`3000 damaged copies of ${label}`, () => {
      const next = random(label.length * 7919 + sample.length);
      let kept = 0;
      let refusedCount = 0;
      for (let i = 0; i < 3000; i++) {
        const input = damage(sample, next);
        let out: Buffer;
        try {
          out = strip(input, kind);
        } catch (err) {
          assert.ok(err instanceof UnreadableImageError, `damaged copy ${i}: only a refusal may be thrown, got ${(err as Error)?.stack}`);
          refusedCount++;
          continue;
        }
        kept++;
        check(out);
      }
      assert.ok(kept > 0 && refusedCount > 0, `both outcomes are exercised (kept ${kept}, refused ${refusedCount})`);
    });
  }

  test("a large file is read in a fraction of a second", () => {
    const parts = F.grayJpegParts();
    const big = Buffer.concat([F.SOI, F.exifSeg({ gps: true }), parts.dqt, parts.sof, parts.dhtDc, parts.dhtAc, parts.sos, Buffer.alloc(3 * 1024 * 1024, 0x55), F.EOI]);
    const started = Date.now();
    const clean = strip(big, "jpg");
    assert.ok(Date.now() - started < 1000, "3 MB of picture data takes well under a second");
    assert.equal(clean.length, big.length - F.exifSeg({ gps: true }).length);
    const manySegments = Buffer.concat([F.SOI, ...Array.from({ length: 20000 }, () => F.commentSeg()), parts.dqt, parts.sof, parts.dhtDc, parts.dhtAc, parts.sos, parts.scan, F.EOI]);
    const startedMany = Date.now();
    assert.ok(strip(manySegments, "jpg").equals(F.grayJpeg()), "all 20000 comments gone, the picture whole");
    assert.ok(Date.now() - startedMany < 1000, "20000 tiny segments take well under a second");
  });
});
