import "./setupEnv";
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { USAGE, cleanStoredPhotos, main, summary, type Output } from "../scripts/cleanStoredPhotos";
import { stripImageMetadata } from "../utils/imageMetadata";
import { UPLOADS_DIR } from "../utils/uploadStore";
import * as F from "./imageFixtures";

// The one-off script that takes the hidden details out of photos stored before the server started doing it on upload.
// It rewrites live, public files, so these check it is careful: it changes nothing unless told to, touches only files
// named like the server's own photos, leaves a photo alone if it cannot be sure, and can never leave a half-written one.

const hex = (n: number) => n.toString(16).padStart(32, "0");
const named = (n: number, kind: "jpg" | "png" | "webp") => `${hex(n)}.${kind}`;
const sha = (file: Buffer) => crypto.createHash("sha1").update(file).digest("hex");
const OLD = new Date("2020-01-01T00:00:00Z");

/* What was stored before: everything a phone adds is still inside. */
const THUMBNAIL = F.grayJpeg([], undefined, [10, 10, 10, 10]);
const dirtyJpeg = () =>
  F.grayJpeg([F.jfifSeg(true), F.exifSeg({ orientation: 6, gps: true, thumbnail: THUMBNAIL }), F.xmpSeg(), F.iptcSeg(), F.commentSeg()], F.ascii(`MOTION ${F.SECRETS.block}`));
const dirtyPng = () =>
  F.tinyPng({
    afterHeader: [
      F.pngChunk("tEXt", F.ascii(`Comment\0${F.SECRETS.text}`)),
      F.pngChunk("eXIf", F.exifTiff({ orientation: 3, gps: true })),
      F.pngChunk("tIME", Buffer.from([0x07, 0xea, 10, 23, 12, 34, 56])),
    ],
    trailer: F.ascii(F.SECRETS.block),
  });
const dirtyWebp = () =>
  F.extendedWebp(F.WEBP_LOSSY, {
    exif: F.exifTiff({ orientation: 8, gps: true }),
    xmp: F.ascii(`<x:xmpmeta>${F.SECRETS.xmp}</x:xmpmeta>`),
    unknown: F.ascii(`${F.SECRETS.block}!`),
  });

const made: string[] = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/** A fresh folder holding these files (a Buffer) or sub-folders ("dir"), every file dated 2020 so a rewrite shows. */
function folder(files: Record<string, Buffer | "dir">): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flippilot-clean-test-"));
  made.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name);
    if (content === "dir") {
      fs.mkdirSync(file);
      continue;
    }
    fs.writeFileSync(file, content);
    fs.utimesSync(file, OLD, OLD);
  }
  return dir;
}
const emptyFolder = () => folder({});

/** Everything in a folder: names, what is inside each file, and when it was last written. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    out[entry.name] = entry.isDirectory() ? "folder" : `${sha(fs.readFileSync(file))} @ ${fs.statSync(file).mtimeMs}`;
  }
  return out;
}

const noSecrets = (file: Buffer, label: string) => {
  for (const word of F.SECRET_WORDS) assert.ok(!F.has(file, word), `${label}: "${word}" must be gone`);
};

/** Photos of every kind, some with hidden details and some without, a few that can't be read, and things that are not photos. */
function mixedFolder() {
  return folder({
    [named(1, "jpg")]: dirtyJpeg(),
    [named(2, "png")]: dirtyPng(),
    [named(3, "webp")]: dirtyWebp(),
    [named(4, "jpg")]: F.grayJpeg(), // nothing to take out
    [named(5, "png")]: F.tinyPng(),
    [named(6, "webp")]: F.WEBP_LOSSY,
    [named(7, "jpg")]: dirtyJpeg().subarray(0, 80), // cut short
    [named(8, "jpg")]: F.tinyPng(), // a PNG with a .jpg name
    // Not named like the server's photos, so never touched, even though they are full of hidden details.
    "notes.txt": F.ascii("not a photo"),
    README: F.ascii("not a photo either"),
    [`${hex(0xabc).toUpperCase()}.jpg`]: dirtyJpeg(),
    [`${hex(10).slice(1)}.jpg`]: dirtyJpeg(),
    [`${hex(11)}0.jpg`]: dirtyJpeg(),
    [`${hex(12)}.jpeg`]: dirtyJpeg(),
    [`${hex(13)}.JPG`]: dirtyJpeg(),
    sub: "dir",
    [`${hex(14)}.png`]: "dir", // a folder that happens to have a photo's name
    // What an interrupted run of the script itself would leave behind.
    [`.${hex(15)}.jpg.4242.tmp`]: F.grayJpeg(),
  });
}
const DIRTY_NAMES = [named(1, "jpg"), named(2, "png"), named(3, "webp")];
const DIRTY_BYTES = () => [dirtyJpeg(), dirtyPng(), dirtyWebp()].reduce((sum, file, i) => sum + file.length - stripImageMetadata(file, (["jpg", "png", "webp"] as const)[i]).length, 0);

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  const io: Output = { out: (line) => out.push(line), err: (line) => err.push(line) };
  return { io, out, err };
}

/* ------------------------------------------------------------------------------------------ */

describe("looking only", () => {
  test("says what it would do, and changes nothing at all", () => {
    const dir = mixedFolder();
    const before = snapshot(dir);
    const report = cleanStoredPhotos({ dir, write: false });

    assert.equal(report.folderMissing, false);
    assert.equal(report.scanned, 8, "eight files are named like the server's photos");
    assert.equal(report.alreadyClean, 3);
    assert.deepEqual(report.cleaned, DIRTY_NAMES, "the three with hidden details, in name order");
    assert.equal(report.bytesRemoved, DIRTY_BYTES());
    assert.deepEqual(report.unreadable.map((u) => u.name), [named(7, "jpg"), named(8, "jpg")]);
    assert.match(report.unreadable[0].reason, /^jpeg: /, "the cut-short JPEG says why");
    assert.equal(report.unreadable[1].reason, "it is not really a jpg picture", "a PNG called .jpg");
    assert.deepEqual(report.failed, []);
    assert.equal(report.otherFiles, 9, "nine other things in the folder, none of them touched");
    assert.deepEqual(report.leftovers, [`.${hex(15)}.jpg.4242.tmp`], "a leftover temporary file is reported");

    assert.deepEqual(snapshot(dir), before, "every file, folder and date is exactly as it was");
  });
});

describe("cleaning", () => {
  test("rewrites exactly the photos that have hidden details, the way a new upload is cleaned", () => {
    const dir = mixedFolder();
    const before = snapshot(dir);
    const originals = new Map(DIRTY_NAMES.map((n) => [n, fs.readFileSync(path.join(dir, n))]));
    const report = cleanStoredPhotos({ dir, write: true });

    assert.deepEqual(report.cleaned, DIRTY_NAMES);
    assert.equal(report.bytesRemoved, DIRTY_BYTES());
    assert.deepEqual(report.failed, []);
    for (const n of DIRTY_NAMES) {
      const kind = path.extname(n).slice(1) as "jpg" | "png" | "webp";
      const now = fs.readFileSync(path.join(dir, n));
      assert.ok(now.equals(stripImageMetadata(originals.get(n)!, kind)), `${n}: it is the same bytes a new upload would have been stored as`);
      assert.ok(now.length < originals.get(n)!.length, `${n}: smaller`);
      noSecrets(now, n);
    }

    const after = snapshot(dir);
    for (const [name, state] of Object.entries(before)) {
      if (DIRTY_NAMES.includes(name)) assert.notEqual(after[name], state, `${name} was rewritten`);
      else assert.equal(after[name], state, `${name} is exactly as it was, down to its date`);
    }
    assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort(), "no file was added, renamed or removed, and no temporary file is left");
  });

  test("a second run finds nothing to do and writes nothing", () => {
    const dir = mixedFolder();
    cleanStoredPhotos({ dir, write: true });
    const settled = snapshot(dir);
    const again = cleanStoredPhotos({ dir, write: true });
    assert.deepEqual(again.cleaned, []);
    assert.equal(again.bytesRemoved, 0);
    assert.equal(again.alreadyClean, 6, "the three it cleaned, and the three that never needed it");
    assert.equal(again.unreadable.length, 2, "the two it could not read are still there, and still untouched");
    assert.deepEqual(snapshot(dir), settled, "not a byte or a date changed");
  });

  test("a photo it cannot read is left exactly as it is, and never deleted", () => {
    const cutShort = dirtyJpeg().subarray(0, 300);
    const dir = folder({ [named(1, "jpg")]: cutShort, [named(2, "png")]: dirtyPng().subarray(0, 60), [named(3, "webp")]: dirtyWebp().subarray(0, 40) });
    const before = snapshot(dir);
    const report = cleanStoredPhotos({ dir, write: true });
    assert.equal(report.unreadable.length, 3);
    assert.deepEqual(report.cleaned, []);
    assert.deepEqual(snapshot(dir), before);
  });

  test("a folder that is not there is reported, not made", () => {
    const missing = path.join(os.tmpdir(), `flippilot-clean-test-missing-${process.pid}`);
    const report = cleanStoredPhotos({ dir: missing, write: true });
    assert.equal(report.folderMissing, true);
    assert.equal(fs.existsSync(missing), false, "it did not create the folder");
  });

  test("a link with a photo's name is not followed, so nothing outside the folder can be rewritten", (t) => {
    const outside = folder({ "elsewhere.jpg": dirtyJpeg() });
    const dir = emptyFolder();
    try {
      fs.symlinkSync(path.join(outside, "elsewhere.jpg"), path.join(dir, named(1, "jpg")));
    } catch {
      t.skip("this machine does not let a test make links");
      return;
    }
    const before = snapshot(outside);
    const report = cleanStoredPhotos({ dir, write: true });
    assert.equal(report.scanned, 0);
    assert.equal(report.otherFiles, 1);
    assert.deepEqual(snapshot(outside), before, "the file the link pointed at is untouched");
  });
});

describe("if something goes wrong part-way", () => {
  test("a photo whose replacement fails keeps its original, leaves no temporary file, and the others are still cleaned", (t) => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg(), [named(2, "png")]: dirtyPng(), [named(3, "webp")]: dirtyWebp() });
    const untouched = fs.readFileSync(path.join(dir, named(2, "png")));
    const realRename = fs.renameSync;
    t.mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
      if (path.basename(String(to)) === named(2, "png")) throw Object.assign(new Error("the disk said no"), { code: "EIO" });
      return realRename(from, to);
    });

    const report = cleanStoredPhotos({ dir, write: true });
    assert.deepEqual(report.cleaned, [named(1, "jpg"), named(3, "webp")], "the others went through");
    assert.equal(report.failed.length, 1);
    assert.equal(report.failed[0].name, named(2, "png"));
    assert.match(report.failed[0].problem, /EIO/);
    assert.ok(fs.readFileSync(path.join(dir, named(2, "png"))).equals(untouched), "the photo whose rewrite failed is exactly as it was");
    assert.deepEqual(fs.readdirSync(dir).sort(), [named(1, "jpg"), named(2, "png"), named(3, "webp")], "no half-written or temporary file is left");
  });

  test("if what was written reads back differently, the original is put back", (t) => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg() });
    const target = path.join(dir, named(1, "jpg"));
    const original = fs.readFileSync(target);
    const realRead = fs.readFileSync;
    let reads = 0;
    t.mock.method(fs, "readFileSync", (file: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
      if (String(file) === target && ++reads === 2) return Buffer.from("not what was written");
      return (realRead as (...args: unknown[]) => Buffer)(file, ...rest);
    });

    const report = cleanStoredPhotos({ dir, write: true });
    t.mock.restoreAll();
    assert.deepEqual(report.cleaned, []);
    assert.equal(report.failed.length, 1);
    assert.match(report.failed[0].problem, /original was put back/);
    assert.ok(fs.readFileSync(target).equals(original), "the photo is byte for byte what it was");
    assert.deepEqual(fs.readdirSync(dir), [named(1, "jpg")]);
  });

  test("each rewrite is flushed to disk first, then renamed over the photo from a hidden temporary file", (t) => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg() });
    const calls: string[] = [];
    const realRename = fs.renameSync;
    const realFsync = fs.fsyncSync;
    t.mock.method(fs, "fsyncSync", (fd: number) => {
      calls.push("flushed");
      return realFsync(fd);
    });
    t.mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
      calls.push(`rename ${path.basename(String(from))} -> ${path.basename(String(to))}`);
      return realRename(from, to);
    });
    cleanStoredPhotos({ dir, write: true });
    assert.equal(calls.length, 2, JSON.stringify(calls));
    assert.equal(calls[0], "flushed", "on the disk before the rename");
    assert.match(calls[1], new RegExp(`^rename \\.${hex(1)}\\.jpg\\.\\d+\\.tmp -> ${hex(1)}\\.jpg$`), "the temporary file's name starts with a dot, so the photo route will not serve it");
  });

  test("a photo that the server deletes while it is being cleaned is not brought back", (t) => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg(), [named(2, "png")]: dirtyPng() });
    const target = path.join(dir, named(1, "jpg"));
    const realFsync = fs.fsyncSync;
    let first = true;
    t.mock.method(fs, "fsyncSync", (fd: number) => {
      if (first) fs.rmSync(target, { force: true }); // the first photo's listing is deleted at this very moment
      first = false;
      return realFsync(fd);
    });
    const report = cleanStoredPhotos({ dir, write: true });
    assert.equal(report.failed.length, 1);
    assert.equal(report.failed[0].name, named(1, "jpg"));
    assert.match(report.failed[0].problem, /deleted while it was being cleaned, so it was not put back/);
    assert.equal(fs.existsSync(target), false, "it stays deleted");
    assert.deepEqual(report.cleaned, [named(2, "png")], "the other photo is still cleaned");
    assert.deepEqual(fs.readdirSync(dir), [named(2, "png")], "and no temporary file is left");
  });

  test("a rename that fails for a moment (as it can on Windows) is tried again, but a real failure is not", (t) => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg(), [named(2, "png")]: dirtyPng() });
    const realRename = fs.renameSync;
    const attempts: Record<string, number> = {};
    t.mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
      const target = path.basename(String(to));
      attempts[target] = (attempts[target] ?? 0) + 1;
      if (target === named(1, "jpg") && attempts[target] <= 2) throw Object.assign(new Error("busy"), { code: "EPERM" });
      if (target === named(2, "png")) throw Object.assign(new Error("the disk said no"), { code: "EIO" });
      return realRename(from, to);
    });
    const report = cleanStoredPhotos({ dir, write: true });
    assert.deepEqual(report.cleaned, [named(1, "jpg")], "the busy one went through on the third try");
    assert.equal(attempts[named(1, "jpg")], 3);
    assert.equal(attempts[named(2, "png")], 1, "a real failure is not tried again");
    assert.equal(report.failed.length, 1);
  });

  test("the copy of the original is made before the photo is touched, so it is there even if the rewrite then fails", (t) => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg() });
    const backup = path.join(emptyFolder(), "originals");
    const original = fs.readFileSync(path.join(dir, named(1, "jpg")));
    const realRename = fs.renameSync;
    t.mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
      if (path.basename(String(to)) === named(1, "jpg")) throw Object.assign(new Error("the disk said no"), { code: "EIO" });
      return realRename(from, to);
    });
    const report = cleanStoredPhotos({ dir, write: true, backupDir: backup });
    assert.equal(report.failed.length, 1);
    assert.ok(fs.readFileSync(path.join(backup, named(1, "jpg"))).equals(original), "the copy is there");
    assert.ok(fs.readFileSync(path.join(dir, named(1, "jpg"))).equals(original), "and the photo is untouched");
  });
});

describe("checks on the cleaned copy", () => {
  const jpegOnly = () => folder({ [named(1, "jpg")]: dirtyJpeg() });

  test("a cleaning step whose answer is not stable leaves the photo alone and says so", () => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg(), [named(2, "png")]: dirtyPng() });
    const before = snapshot(dir);
    const report = cleanStoredPhotos({ dir, write: true, strip: (photo) => photo.subarray(0, photo.length - 10) }); // a bit smaller every time it runs
    assert.deepEqual(report.cleaned, []);
    assert.equal(report.failed.length, 2);
    assert.match(report.failed[0].problem, /did not pass its own checks, so the photo was left alone/);
    assert.deepEqual(snapshot(dir), before);
  });

  test("a cleaning step that answers with a different kind of file leaves the photo alone", () => {
    const dir = jpegOnly();
    const before = snapshot(dir);
    const report = cleanStoredPhotos({ dir, write: true, strip: () => F.tinyPng() });
    assert.deepEqual(report.cleaned, []);
    assert.equal(report.failed.length, 1);
    assert.match(report.failed[0].problem, /did not pass its own checks/);
    assert.deepEqual(snapshot(dir), before);
  });

  test("a cleaning step that fails in an unexpected way is reported as a failure, not as an unreadable photo, and nothing is touched", () => {
    const dir = jpegOnly();
    const before = snapshot(dir);
    const report = cleanStoredPhotos({
      dir,
      write: true,
      strip: () => {
        throw new TypeError("something unexpected");
      },
    });
    assert.deepEqual(report.unreadable, []);
    assert.equal(report.failed.length, 1);
    assert.match(report.failed[0].problem, /something unexpected/);
    assert.deepEqual(snapshot(dir), before);
  });

  test("a good cleaning step is used for both the photo and the check on its answer", () => {
    const dir = jpegOnly();
    const seen: number[] = [];
    const report = cleanStoredPhotos({
      dir,
      write: false,
      strip: (photo, kind) => {
        seen.push(photo.length);
        return stripImageMetadata(photo, kind);
      },
    });
    assert.deepEqual(report.cleaned, [named(1, "jpg")]);
    assert.equal(seen.length, 2, "once on the photo, once on its cleaned copy");
    assert.ok(seen[1] < seen[0], "the second call is on the smaller, cleaned copy");
  });
});

describe("keeping the originals", () => {
  test("copies each photo it changes, exactly as it was, before changing it - and only those", () => {
    const dir = mixedFolder();
    const backup = path.join(emptyFolder(), "originals");
    const originals = new Map(DIRTY_NAMES.map((n) => [n, fs.readFileSync(path.join(dir, n))]));
    const report = cleanStoredPhotos({ dir, write: true, backupDir: backup });
    assert.deepEqual(report.cleaned, DIRTY_NAMES);
    assert.deepEqual(fs.readdirSync(backup).sort(), DIRTY_NAMES, "a copy of each photo it changed, and no others");
    for (const n of DIRTY_NAMES) assert.ok(fs.readFileSync(path.join(backup, n)).equals(originals.get(n)!), `${n}: the copy is the original`);
  });

  test("will not put the copies in the photos folder, which is public", () => {
    const dir = mixedFolder();
    const before = snapshot(dir);
    for (const backupDir of [dir, path.join(dir, "originals"), path.join(dir, "sub")]) {
      assert.throws(() => cleanStoredPhotos({ dir, write: true, backupDir }), /must not be inside the photos folder/);
    }
    assert.deepEqual(snapshot(dir), before, "nothing was changed or added");
  });

  test("only makes sense when cleaning", () => {
    const dir = mixedFolder();
    const backup = path.join(emptyFolder(), "originals");
    assert.throws(() => cleanStoredPhotos({ dir, write: false, backupDir: backup }), /only makes sense with --write/);
    assert.equal(fs.existsSync(backup), false, "no backup folder was made");
  });

  test("never overwrites a different copy already in the backup folder, and leaves that photo alone", () => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg(), [named(2, "png")]: dirtyPng() });
    const backup = folder({ [named(1, "jpg")]: F.ascii("an older, different file") });
    const before = snapshot(dir);
    const report = cleanStoredPhotos({ dir, write: true, backupDir: backup });
    assert.deepEqual(report.cleaned, [named(2, "png")]);
    assert.equal(report.failed.length, 1);
    assert.match(report.failed[0].problem, /different copy of it is already in the backup folder/);
    assert.equal(snapshot(dir)[named(1, "jpg")], before[named(1, "jpg")], "that photo was not touched");
    assert.equal(fs.readFileSync(path.join(backup, named(1, "jpg")), "utf8"), "an older, different file", "and the older copy was not overwritten");
  });

  test("a copy that is already there and is the same photo is fine (a run that was cut short, started again)", () => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg() });
    const backup = folder({ [named(1, "jpg")]: dirtyJpeg() });
    const report = cleanStoredPhotos({ dir, write: true, backupDir: backup });
    assert.deepEqual(report.cleaned, [named(1, "jpg")]);
    assert.deepEqual(report.failed, []);
  });
});

describe("real encoders' files", () => {
  test("only a file with something in it to take out is rewritten", () => {
    const dir = folder({
      [named(1, "jpg")]: F.REAL_JPEG, // has the encoder's comment
      [named(2, "png")]: F.REAL_PNG,
      [named(3, "webp")]: F.WEBP_LOSSLESS,
      [named(4, "webp")]: F.WEBP_ALPHA,
      [named(5, "webp")]: F.WEBP_ANIMATED,
    });
    const before = snapshot(dir);
    const report = cleanStoredPhotos({ dir, write: true });
    assert.deepEqual(report.cleaned, [named(1, "jpg")]);
    assert.equal(report.alreadyClean, 4);
    const after = snapshot(dir);
    for (const n of [named(2, "png"), named(3, "webp"), named(4, "webp"), named(5, "webp")]) assert.equal(after[n], before[n], `${n} untouched`);
    assert.deepEqual(F.jpegMarkers(fs.readFileSync(path.join(dir, named(1, "jpg")))), [0xe0, 0xdb, 0xc4, 0xc0, 0xda, 0xd9], "the comment is gone and the picture is whole");
  });
});

/* ------------------------------------------------------------------------------------------ */

describe("what it says", () => {
  test("looking only: how many, the first few names, and how to go ahead", () => {
    const dir = folder(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [named(i + 1, "jpg"), dirtyJpeg()])));
    const text = summary(cleanStoredPhotos({ dir, write: false }), { write: false }).join("\n");
    assert.match(text, /Photos folder: /);
    assert.match(text, /Looking only: nothing will be changed\./);
    assert.match(text, /Looked at 12 photos\./);
    assert.match(text, /12 have hidden details that would be removed \(/);
    assert.match(text, /\.\.\.and 2 more \(--verbose lists them all\)/);
    assert.match(text, /Nothing was changed\. To clean the 12 photos, run the same command again with --write\./);
    assert.ok(text.includes(named(1, "jpg")) && text.includes(named(10, "jpg")) && !text.includes(named(11, "jpg")), "ten names are shown");

    const all = summary(cleanStoredPhotos({ dir, write: false }), { write: false, verbose: true }).join("\n");
    assert.ok(all.includes(named(12, "jpg")) && !all.includes("more (--verbose"), "--verbose lists every one");
  });

  test("cleaning: what was done, and what needs a look", () => {
    const dir = mixedFolder();
    const text = summary(cleanStoredPhotos({ dir, write: true }), { write: true }).join("\n");
    assert.match(text, /Cleaning: each photo is rewritten in place, all or nothing\./);
    assert.match(text, /3 had nothing hidden in them\./);
    assert.match(text, /3 cleaned \(/);
    assert.match(text, /2 could not be read all the way through\. They were left exactly as they are, and may still hold hidden details:/);
    assert.ok(text.includes(`${named(8, "jpg")}: it is not really a jpg picture`), "the PNG called .jpg is named, with the reason");
    assert.match(text, /Other things in the folder, not photos, never touched: 9\./);
    assert.match(text, /Leftover temporary files from an interrupted run/);
    assert.match(text, /Done: 3 photos cleaned\. 2 photos need a look \(listed above\)\./);
  });

  test("looking only, with photos that need a look but nothing to clean, says both", () => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg().subarray(0, 80), [named(2, "png")]: F.tinyPng() });
    const text = summary(cleanStoredPhotos({ dir, write: false }), { write: false }).join("\n");
    assert.match(text, /Nothing was changed, and nothing needs cleaning\. 1 photo needs a look \(listed above\)\./);
  });

  test("says so in the singular, and when there is nothing to do", () => {
    const one = summary(cleanStoredPhotos({ dir: folder({ [named(1, "jpg")]: dirtyJpeg() }), write: false }), { write: false }).join("\n");
    assert.match(one, /Looked at 1 photo\./);
    assert.match(one, /1 has hidden details that would be removed/);
    assert.match(one, /To clean the 1 photo, run/);
    const none = summary(cleanStoredPhotos({ dir: folder({ [named(1, "jpg")]: F.grayJpeg() }), write: false }), { write: false }).join("\n");
    assert.match(none, /Nothing was changed, and nothing needs cleaning\./);
    const done = summary(cleanStoredPhotos({ dir: folder({ [named(1, "jpg")]: F.grayJpeg() }), write: true }), { write: true }).join("\n");
    assert.match(done, /Done: nothing needed cleaning\./);
  });

  test("when originals were kept it says where, and that they still hold the hidden details", () => {
    const backup = path.join(emptyFolder(), "originals");
    const text = summary(cleanStoredPhotos({ dir: folder({ [named(1, "jpg")]: dirtyJpeg() }), write: true, backupDir: backup }), { write: true, backupDir: backup }).join("\n");
    assert.ok(text.includes(backup), "it says where the copies are");
    assert.match(text, /still hold the hidden details/);
  });
});

describe("the command line", () => {
  test("--help shows how to use it", () => {
    const { io, out, err } = capture();
    assert.equal(main(["--help"], io), 0);
    assert.equal(out.join("\n"), USAGE);
    assert.deepEqual(err, []);
    assert.match(USAGE, /--write/);
  });

  test("something it does not understand stops it before anything is touched", () => {
    const dir = mixedFolder();
    const before = snapshot(dir);
    const cases: Array<[string[], RegExp]> = [
      [["--wrtie", "--dir", dir], /I don't know what "--wrtie" means\./],
      [["--dir"], /--dir needs a folder after it\./],
      [["--dir", "--write"], /--dir needs a folder after it\./],
      [["--backup-dir"], /--backup-dir needs a folder after it\./],
      [[dir], /I don't know what ".*" means\./],
    ];
    for (const [args, message] of cases) {
      const { io, err, out } = capture();
      assert.equal(main(args, io), 1, JSON.stringify(args));
      assert.match(err.join("\n"), message, JSON.stringify(args));
      assert.ok(err.join("\n").includes(USAGE), `${JSON.stringify(args)}: and it shows how to use it`);
      assert.deepEqual(out, [], "nothing else is printed");
    }
    assert.deepEqual(snapshot(dir), before);
  });

  test("--backup-dir without --write is refused, and makes no folder", () => {
    const dir = mixedFolder();
    const backup = path.join(emptyFolder(), "originals");
    const { io, err } = capture();
    assert.equal(main(["--dir", dir, "--backup-dir", backup], io), 1);
    assert.match(err.join("\n"), /only makes sense with --write/);
    assert.equal(fs.existsSync(backup), false);
  });

  test("a backup folder inside the photos folder is refused with the reason", () => {
    const dir = mixedFolder();
    const { io, err } = capture();
    assert.equal(main(["--dir", dir, "--write", "--backup-dir", path.join(dir, "sub")], io), 1);
    assert.match(err.join("\n"), /must not be inside the photos folder/);
  });

  test("without --write it only looks; with it, it cleans. Exit code 2 says some photos need a look", () => {
    const dir = mixedFolder();
    const before = snapshot(dir);
    const look = capture();
    assert.equal(main(["--dir", dir], look.io), 2, "two photos could not be read");
    assert.match(look.out.join("\n"), /Looking only/);
    assert.deepEqual(snapshot(dir), before);

    const clean = capture();
    assert.equal(main([`--dir=${dir}`, "--write"], clean.io), 2);
    assert.match(clean.out.join("\n"), /Done: 3 photos cleaned\./);
    assert.notDeepEqual(snapshot(dir), before);

    const tidy = folder({ [named(1, "jpg")]: dirtyJpeg() });
    const ok = capture();
    assert.equal(main(["--dir", tidy, "--write"], ok.io), 0, "nothing needs a look");
  });

  test("warns when DATA_DIR is not set and it falls back to its own default folder, and only then", () => {
    const warning = /Note: DATA_DIR is not set here/;
    fs.mkdirSync(UPLOADS_DIR, { recursive: true }); // this test run's own throwaway data folder
    const notSet = capture();
    assert.equal(main([], notSet.io, false), 0);
    assert.match(notSet.out.join("\n"), warning, "the default folder, with DATA_DIR not set");

    const isSet = capture();
    assert.equal(main([], isSet.io, true), 0);
    assert.doesNotMatch(isSet.out.join("\n"), warning, "DATA_DIR is set");

    const explicit = capture();
    assert.equal(main(["--dir", emptyFolder()], explicit.io, false), 0);
    assert.doesNotMatch(explicit.out.join("\n"), warning, "a folder named on the command line needs no warning");
  });

  test("a photo that could not be rewritten makes the exit code 2 and is listed", (t) => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg() });
    const realRename = fs.renameSync;
    t.mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
      if (path.basename(String(to)) === named(1, "jpg")) throw Object.assign(new Error("the disk said no"), { code: "EIO" });
      return realRename(from, to);
    });
    const { io, out } = capture();
    assert.equal(main(["--dir", dir, "--write"], io), 2);
    const text = out.join("\n");
    assert.match(text, /1 could not be cleaned and was left as it was:/);
    assert.ok(text.includes(`${named(1, "jpg")}: EIO: the disk said no`), text);
    assert.match(text, /Nothing was cleaned\. 1 photo needs a look \(listed above\)\./, "and it does not claim to have cleaned it");
    assert.ok(!text.includes("Done: nothing needed cleaning"), "nor that nothing needed cleaning");
  });

  test("a folder that is not there says so, and mentions DATA_DIR", () => {
    const { io, err } = capture();
    assert.equal(main(["--dir", path.join(os.tmpdir(), `flippilot-clean-test-missing-${process.pid}`)], io), 1);
    assert.match(err.join("\n"), /There is no photos folder at .*DATA_DIR/);
  });

  test("with no --dir it works on the folder the server itself uses", () => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const mine = path.join(UPLOADS_DIR, named(0xfeed, "jpg"));
    fs.writeFileSync(mine, dirtyJpeg());
    try {
      const { io, out } = capture();
      assert.equal(main(["--write"], io), 0);
      assert.ok(out.join("\n").includes(`Photos folder: ${UPLOADS_DIR}`), "it says it is using the server's own photos folder");
      assert.ok(fs.readFileSync(mine).equals(stripImageMetadata(dirtyJpeg(), "jpg")), "and cleaned the photo in it");
    } finally {
      fs.rmSync(mine, { force: true });
    }
  });
});

describe("run as a real command", () => {
  const TSX = require.resolve("tsx/cli");
  const SCRIPT = path.join(__dirname, "..", "scripts", "cleanStoredPhotos.ts");
  const run = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(process.execPath, [TSX, SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, ...env }, timeout: 120_000 });

  test("looks first, then cleans when asked, and importing it did not run it", () => {
    const dir = folder({ [named(1, "jpg")]: dirtyJpeg(), [named(2, "png")]: F.tinyPng() });
    const before = snapshot(dir);

    const look = run(["--dir", dir]);
    assert.equal(look.status, 0, look.stderr);
    assert.match(look.stdout, /Looking only: nothing will be changed\./);
    assert.match(look.stdout, /To clean the 1 photo, run the same command again with --write\./);
    assert.deepEqual(snapshot(dir), before, "looking changed nothing");

    const write = run(["--dir", dir, "--write"]);
    assert.equal(write.status, 0, write.stderr);
    assert.match(write.stdout, /Done: 1 photo cleaned\./);
    assert.ok(fs.readFileSync(path.join(dir, named(1, "jpg"))).equals(stripImageMetadata(dirtyJpeg(), "jpg")), "the photo was cleaned by the real command");

    const again = run(["--dir", dir, "--write"]);
    assert.match(again.stdout, /Done: nothing needed cleaning\./);

    const bad = run(["--wrtie"]);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /I don't know what "--wrtie" means\./);
  });

  test("with DATA_DIR set it finds the server's photos folder by itself, as on Render", () => {
    const data = emptyFolder();
    fs.mkdirSync(path.join(data, "uploads"));
    fs.writeFileSync(path.join(data, "uploads", named(1, "png")), dirtyPng());
    const result = run([], { DATA_DIR: data });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`Photos folder: ${path.join(data, "uploads")}`), result.stdout);
    assert.ok(!result.stdout.includes("DATA_DIR is not set"), "no warning when it is set");
    assert.match(result.stdout, /1 has hidden details that would be removed/);
  });
});
