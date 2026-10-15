// Run with: npx tsx src/utils/checks/startupVideo.check.ts [colour] (from the app root).
// Found 2026-10-15 (owner): the startup video's background did not match the Home screen, so the screen visibly
// changed colour when the video handed over to Home. The video's background is baked into its pixels
// (scripts/recolour-startup-video.py made it exactly the Home background, #0A1128), and the native splash screen
// it follows is that colour too. If the theme's background is ever changed without making the video again, the
// mismatch comes back silently, so this fails the moment they drift apart.
// The video also has to carry the right COLOUR TAGS: with none (or BT.709), phones that colour-manage video
// brighten dark colours, and the Home-coloured background showed about 15 levels too light on the emulator. The
// sRGB tag stops that, and the Samsung S22 is unaffected by it. So the tags are read out of the video itself.
// (An optional colour argument is the colour to expect instead, and STARTUP_CHECK_ROOT points the file checks at a
// copy of the app's files: that is how this check itself is tested.)
/// <reference types="node" />
// (This file runs under Node, not on a phone: the reference is what gives it Node's file functions without
// adding them to the whole app's type-check.)
import fs from "fs";
import path from "path";

import { themes } from "../../styles/theme";

const ROOT = process.env.STARTUP_CHECK_ROOT ?? path.resolve(__dirname, "..", "..", "..");
const VIDEO_BACKGROUND = (process.argv[2] ?? "#0A1128").toUpperCase();
const REGENERATE = "make the video again: python scripts/recolour-startup-video.py --help";

let fail = 0;
const bad = (label: string, detail: string) => {
  fail++;
  console.log("FAIL", label, detail);
};

/** Reads bits out of a list of bytes, the way H.264 headers are written. */
class Bits {
  private pos = 0;
  constructor(private readonly data: number[]) {}
  u(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.data[this.pos >> 3];
      if (byte === undefined) throw new Error("ran out of bits");
      v = v * 2 + ((byte >> (7 - (this.pos & 7))) & 1);
      this.pos++;
    }
    return v;
  }
  /** Exp-Golomb unsigned. */
  ue(): number {
    let zeros = 0;
    while (this.u(1) === 0) {
      if (++zeros > 32) throw new Error("bad exp-golomb number");
    }
    return zeros === 0 ? 0 : 2 ** zeros - 1 + this.u(zeros);
  }
  /** Exp-Golomb signed. */
  se(): number {
    const k = this.ue();
    return k % 2 === 1 ? (k + 1) / 2 : -(k / 2);
  }
}

type ColourTags = { primaries: number; transfer: number; matrix: number; fullRange: number };

/** The colour tags of an MP4's H.264 stream (in the sequence parameter set inside its 'avcC' box), or null if
 *  the stream carries none. Throws if the file is not something this can read, so the check cannot pass by default. */
function colourTags(file: Buffer): ColourTags | null {
  const at = file.indexOf("avcC");
  if (at < 0) throw new Error("no avcC box: not an H.264 mp4");
  let p = at + 4 + 5; // after the box name, then version, profile, compatibility, level, length size
  if ((file.readUInt8(p++) & 0x1f) < 1) throw new Error("no sequence parameter set");
  const length = file.readUInt16BE(p);
  p += 2;
  const nal = file.subarray(p + 1, p + length); // drop the one-byte NAL header
  const rbsp: number[] = []; // the bytes without the 00 00 03 "emulation prevention" padding
  let zeros = 0;
  for (let i = 0; i < nal.length; i++) {
    const byte = nal.readUInt8(i);
    if (zeros >= 2 && byte === 3) {
      zeros = 0;
      continue;
    }
    zeros = byte === 0 ? zeros + 1 : 0;
    rbsp.push(byte);
  }

  const b = new Bits(rbsp);
  const profile = b.u(8);
  b.u(16); // constraint flags, level
  b.ue(); // sequence parameter set id
  if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135].includes(profile)) {
    const chroma = b.ue();
    if (chroma === 3) b.u(1);
    b.ue(); // luma bit depth
    b.ue(); // chroma bit depth
    b.u(1);
    if (b.u(1)) {
      // scaling matrices
      for (let i = 0; i < (chroma !== 3 ? 8 : 12); i++) {
        if (!b.u(1)) continue;
        let last = 8;
        let next = 8;
        for (let j = 0; j < (i < 6 ? 16 : 64); j++) {
          if (next !== 0) next = (last + b.se() + 256) % 256;
          last = next === 0 ? last : next;
        }
      }
    }
  }
  b.ue(); // log2_max_frame_num
  const pocType = b.ue();
  if (pocType === 0) {
    b.ue();
  } else if (pocType === 1) {
    b.u(1);
    b.se();
    b.se();
    const n = b.ue();
    for (let i = 0; i < n; i++) b.se();
  }
  b.ue(); // max reference frames
  b.u(1);
  b.ue(); // width in macroblocks
  b.ue(); // height in macroblocks
  if (!b.u(1)) b.u(1); // frame_mbs_only_flag (then mb_adaptive_frame_field_flag)
  b.u(1);
  if (b.u(1)) {
    // frame cropping
    b.ue();
    b.ue();
    b.ue();
    b.ue();
  }
  if (!b.u(1)) return null; // no VUI at all
  if (b.u(1) && b.u(8) === 255) {
    b.u(16);
    b.u(16);
  }
  if (b.u(1)) b.u(1); // overscan
  if (!b.u(1)) return null; // no video signal type
  b.u(3); // video format
  const fullRange = b.u(1);
  if (!b.u(1)) return null; // no colour description
  return { primaries: b.u(8), transfer: b.u(8), matrix: b.u(8), fullRange };
}

// 1. Home's background (the free theme: the only one the app runs) is the colour the video was built for.
const home = themes.free.background.toUpperCase();
if (home !== VIDEO_BACKGROUND) {
  bad("the theme background is not the colour the startup video was built for", `${home} vs ${VIDEO_BACKGROUND}; ${REGENERATE}`);
}

// 2. The native splash screen, which the video follows, is that colour too.
const config = fs.readFileSync(path.join(ROOT, "app.config.js"), "utf8");
const splash = config.match(/"expo-splash-screen"[\s\S]*?backgroundColor:\s*"(#[0-9A-Fa-f]{6})"/);
if (!splash) {
  bad("could not read the splash screen's background colour from app.config.js", "");
} else if (splash[1].toUpperCase() !== VIDEO_BACKGROUND) {
  bad("the splash screen's background is not the startup video's colour", `${splash[1].toUpperCase()} vs ${VIDEO_BACKGROUND}`);
}

// 3. The startup screen itself paints the theme background around the video.
const intro = fs.readFileSync(path.join(ROOT, "app", "index.tsx"), "utf8");
if (!/styles\.container,\s*\{\s*backgroundColor:\s*theme\.background\s*\}/.test(intro)) {
  bad("the startup screen no longer paints theme.background", "app/index.tsx");
}

// 4. Nothing switches the app to the Pro theme (its background is darker, so the video would not match it).
const calls: string[] = [];
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "checks") walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name) && /toggleTheme\(\)/.test(fs.readFileSync(full, "utf8"))) {
      calls.push(path.relative(ROOT, full).split(path.sep).join("/"));
    }
  }
};
walk(path.join(ROOT, "app"));
walk(path.join(ROOT, "src"));
if (calls.length) {
  bad("something switches the app to the Pro theme, whose background the startup video does not match", calls.join(", "));
}

// 5. The video carries the colour tags: sRGB transfer (13), BT.709 primaries and matrix (1), limited range (0).
let tagText = "?";
try {
  const tags = colourTags(fs.readFileSync(path.join(ROOT, "src", "assets", "videos", "startup.mp4")));
  if (!tags) {
    tagText = "none";
    bad("the startup video has no colour tags", `phones that colour-manage video will show its background too light; ${REGENERATE}`);
  } else {
    tagText = `primaries ${tags.primaries}, transfer ${tags.transfer}, matrix ${tags.matrix}, ${tags.fullRange ? "full" : "limited"} range`;
    if (tags.transfer !== 13 || tags.primaries !== 1 || tags.matrix !== 1 || tags.fullRange !== 0) {
      bad("the startup video's colour tags are not sRGB transfer / BT.709 / limited range", `${tagText}; ${REGENERATE}`);
    }
  }
} catch (e) {
  bad("could not read the startup video's colour tags", String(e));
}

console.log(`startup video colour ${VIDEO_BACKGROUND}: theme ${home}, splash ${splash ? splash[1].toUpperCase() : "?"}; video tags: ${tagText}`);
console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
