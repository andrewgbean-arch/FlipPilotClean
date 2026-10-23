/**
 * One-off clean-up of photos that were stored BEFORE the server started taking their hidden details out
 * (utils/imageMetadata.ts): where a photo was taken, which phone took it, a small copy of the whole shot, the
 * name of the editing program. Photos uploaded since then are already clean. Run this once on the server, after
 * the code that cleans new uploads is live. Nothing in the server imports this file.
 *
 *   node dist/scripts/cleanStoredPhotos.js            look only: say what would change, change nothing
 *   node dist/scripts/cleanStoredPhotos.js --write    clean them
 *
 * From the source folder instead of the compiled code: npx tsx scripts/cleanStoredPhotos.ts [--write]
 *
 * It works on the photos folder the server itself uses (uploads inside DATA_DIR, which is /var/data on Render),
 * so run it in the service's Shell, where that is already set. See USAGE below for the options.
 *
 * What it does to each photo, and what it promises:
 *   - It cleans exactly the way a new upload is cleaned: the picture data is copied byte for byte, nothing is
 *     decoded or squeezed again, and which way up the photo is stays.
 *   - A photo with nothing to take out is not touched at all (not even rewritten).
 *   - A photo it cannot read all the way through is left exactly as it is and listed. It is never deleted.
 *   - A cleaned photo is written to a hidden temporary file next to it, flushed to disk, and renamed over the
 *     original. A rename is all-or-nothing, so a crash or a full disk cannot leave a half-written photo, and the
 *     server (which may be running) always sees either the old photo or the new one. The temporary file's name
 *     starts with a dot, which the server's photo route refuses to serve.
 *   - It only touches files named like the server's own photos (32 hex digits, then .jpg, .png or .webp).
 *   - It never renames or deletes photos, so listings, the photo records (uploads.json) and links keep working.
 */
import fs from "fs";
import path from "path";
import { DATA_DIR_IS_CONFIGURED } from "../config/dataDir";
import { UnreadableImageError, stripImageMetadata, type ImageKind } from "../utils/imageMetadata";
import { UPLOADS_DIR, sniffImage } from "../utils/uploadStore";

const PHOTO_FILE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
// What this script's own temporary files look like, if a run is ever cut short between writing one and renaming it.
const LEFTOVER_FILE = /^\.[a-f0-9]{32}\.(jpg|png|webp)\.\d+\.tmp$/;

export type CleanOptions = {
  /** The folder holding the photos. */
  dir: string;
  /** false: only look. true: rewrite the photos that have something to take out. */
  write: boolean;
  /** With write: copy each photo here before it is changed. */
  backupDir?: string;
  /** The cleaning step. Only tests give their own (a deliberately faulty one) to prove the checks on its answer hold. */
  strip?: (photo: Buffer, kind: ImageKind) => Buffer;
};

export type CleanReport = {
  dir: string;
  folderMissing: boolean;
  /** Photo files looked at. */
  scanned: number;
  /** Nothing to take out. */
  alreadyClean: number;
  /** Photos that had hidden details: written, or (when only looking) that would be. */
  cleaned: string[];
  bytesRemoved: number;
  /** Not readable all the way through (or not what their name says): left exactly as they are. */
  unreadable: Array<{ name: string; reason: string }>;
  /** Something went wrong with the file itself (disk, permissions): left as it was. */
  failed: Array<{ name: string; problem: string }>;
  /** Anything else in the folder (not a photo by name): never touched. */
  otherFiles: number;
  /** Temporary files an interrupted run of this script left behind. Reported, not deleted. */
  leftovers: string[];
};

/* ----------------------------------------------------------------------------------------------- */

// On Windows a rename over a file that something else has open at that instant (a virus scanner, the search
// indexer) fails with EPERM/EBUSY/EACCES and works a few milliseconds later. A Linux host never hits this.
const TRANSIENT_RENAME_ERRORS = new Set(["EPERM", "EBUSY", "EACCES"]);
function renameWithRetry(from: string, to: string): void {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err: any) {
      if (attempt >= 6 || !TRANSIENT_RENAME_ERRORS.has(err?.code)) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10 * (attempt + 1));
    }
  }
}

/** Puts `data` in place of the file at `target` in one step: whoever looks sees the old file or the new one. */
function replaceFile(target: string, data: Buffer): void {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  let fd: number | undefined;
  try {
    fd = fs.openSync(temporary, "wx");
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd); // on the disk before the rename, so a power cut cannot leave an empty file under the real name
    fs.closeSync(fd);
    fd = undefined;
    // The server deletes a listing's photos. One deleted while this was going on must not be brought back.
    if (!fs.existsSync(target)) throw new Error("the photo was deleted while it was being cleaned, so it was not put back");
    renameWithRetry(temporary, target);
  } catch (err) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // already closed
      }
    }
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // the next run reports it
    }
    throw err;
  }
}

const real = (p: string) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};
function isInside(child: string, parent: string): boolean {
  const relative = path.relative(real(parent), real(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** Keeps a copy of the photo as it was. A copy already there is fine if it is the same photo; a different one is not overwritten. */
function backUp(photo: string, backupDir: string, original: Buffer): void {
  const copy = path.join(backupDir, path.basename(photo));
  if (fs.existsSync(copy)) {
    if (!fs.readFileSync(copy).equals(original)) throw new Error("a different copy of it is already in the backup folder");
    return;
  }
  fs.writeFileSync(copy, original, { flag: "wx" });
}

const problemOf = (err: unknown) => {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  const message = err instanceof Error ? err.message : String(err);
  return code && !message.includes(code) ? `${code}: ${message}` : message;
};

/* ----------------------------------------------------------------------------------------------- */

export function cleanStoredPhotos(options: CleanOptions): CleanReport {
  const dir = path.resolve(options.dir);
  const report: CleanReport = { dir, folderMissing: false, scanned: 0, alreadyClean: 0, cleaned: [], bytesRemoved: 0, unreadable: [], failed: [], otherFiles: 0, leftovers: [] };

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    report.folderMissing = true;
    return report;
  }

  const backupDir = options.backupDir ? path.resolve(options.backupDir) : undefined;
  if (backupDir) {
    if (!options.write) throw new Error("A backup folder only makes sense with --write: looking only changes nothing, so there is nothing to back up.");
    // Everything in the photos folder is public, so a copy of the originals (which still hold the hidden details) must not go in it.
    if (isInside(backupDir, dir)) throw new Error("The backup folder must not be inside the photos folder: everything in there is public.");
  }

  const strip = options.strip ?? stripImageMetadata;
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (backupDir && options.write) fs.mkdirSync(backupDir, { recursive: true });

  for (const entry of entries) {
    if (!PHOTO_FILE.test(entry.name) || !entry.isFile()) {
      if (LEFTOVER_FILE.test(entry.name)) report.leftovers.push(entry.name);
      else report.otherFiles++;
      continue;
    }
    report.scanned++;
    const kind = path.extname(entry.name).slice(1) as ImageKind;
    const file = path.join(dir, entry.name);

    try {
      const original = fs.readFileSync(file);
      if (sniffImage(original) !== kind) {
        report.unreadable.push({ name: entry.name, reason: `it is not really a ${kind} picture` });
        continue;
      }

      let clean: Buffer;
      try {
        clean = strip(original, kind);
      } catch (err) {
        if (err instanceof UnreadableImageError) {
          report.unreadable.push({ name: entry.name, reason: err.reason });
          continue;
        }
        throw err;
      }

      // Cleaning can only make a photo smaller. If it didn't, there was nothing hidden to take out.
      if (clean.length >= original.length) {
        report.alreadyClean++;
        continue;
      }
      // The cleaned copy has to pass its own checks before anything is written: still the same kind of
      // picture, and cleaning it again changes nothing.
      let again: Buffer | null = null;
      try {
        again = strip(clean, kind);
      } catch {
        again = null;
      }
      if (sniffImage(clean) !== kind || !again || !again.equals(clean)) {
        throw new Error("the cleaned copy did not pass its own checks, so the photo was left alone");
      }

      if (options.write) {
        if (backupDir) backUp(file, backupDir, original);
        replaceFile(file, clean);
        if (!fs.readFileSync(file).equals(clean)) {
          replaceFile(file, original); // put it back exactly as it was
          throw new Error("the file read back differently from what was written, so the original was put back");
        }
      }
      report.cleaned.push(entry.name);
      report.bytesRemoved += original.length - clean.length;
    } catch (err) {
      report.failed.push({ name: entry.name, problem: problemOf(err) });
    }
  }
  return report;
}

/* ----------------------------------------------------------------------------------------------- */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
function size(bytes: number): string {
  if (bytes < 1024) return plural(bytes, "byte");
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** What to tell the person who ran it. */
export function summary(report: CleanReport, options: { write: boolean; verbose?: boolean; backupDir?: string }): string[] {
  const lines: string[] = [`Photos folder: ${report.dir}`];
  lines.push(options.write ? "Cleaning: each photo is rewritten in place, all or nothing." : "Looking only: nothing will be changed.", "");
  lines.push(`Looked at ${plural(report.scanned, "photo")}.`);
  lines.push(`  ${report.alreadyClean} ${options.write ? "had" : "have"} nothing hidden in them.`);

  const shown = options.verbose ? report.cleaned : report.cleaned.slice(0, 10);
  lines.push(
    options.write
      ? `  ${report.cleaned.length} cleaned (${size(report.bytesRemoved)} of hidden details removed).`
      : `  ${report.cleaned.length} ${report.cleaned.length === 1 ? "has" : "have"} hidden details that would be removed (${size(report.bytesRemoved)} in all).`
  );
  for (const name of shown) lines.push(`    ${name}`);
  if (shown.length < report.cleaned.length) lines.push(`    ...and ${report.cleaned.length - shown.length} more (--verbose lists them all)`);

  if (report.unreadable.length > 0) {
    lines.push(`  ${report.unreadable.length} could not be read all the way through. ${report.unreadable.length === 1 ? "It was" : "They were"} left exactly as ${report.unreadable.length === 1 ? "it is" : "they are"}, and may still hold hidden details:`);
    for (const u of report.unreadable) lines.push(`    ${u.name}: ${u.reason}`);
  }
  if (report.failed.length > 0) {
    lines.push(`  ${report.failed.length} could not be cleaned and ${report.failed.length === 1 ? "was" : "were"} left as ${report.failed.length === 1 ? "it was" : "they were"}:`);
    for (const f of report.failed) lines.push(`    ${f.name}: ${f.problem}`);
  }
  if (report.otherFiles > 0) lines.push(`Other things in the folder, not photos, never touched: ${report.otherFiles}.`);
  if (report.leftovers.length > 0) {
    lines.push(`Leftover temporary files from an interrupted run (hidden from the public, harmless; delete them by hand if you like): ${report.leftovers.join(", ")}`);
  }
  if (options.write && options.backupDir) {
    lines.push(`The photos were copied to ${options.backupDir} before they were changed. Those copies still hold the hidden details: keep that folder private, and delete it once you are happy.`);
  }

  lines.push("");
  const attention = report.unreadable.length + report.failed.length;
  const look = attention > 0 ? ` ${plural(attention, "photo")} ${attention === 1 ? "needs" : "need"} a look (listed above).` : "";
  if (!options.write) {
    lines.push(
      report.cleaned.length > 0
        ? `Nothing was changed. To clean the ${plural(report.cleaned.length, "photo")}, run the same command again with --write.${look}`
        : `Nothing was changed, and nothing needs cleaning.${look}`
    );
  } else if (report.cleaned.length > 0) {
    lines.push(`Done: ${plural(report.cleaned.length, "photo")} cleaned.${look}`);
  } else {
    lines.push(attention > 0 ? `Nothing was cleaned.${look}` : "Done: nothing needed cleaning.");
  }
  return lines;
}

/* ----------------------------------------------------------------------------------------------- */

export type Output = { out: (line: string) => void; err: (line: string) => void };
const consoleOutput: Output = { out: (line) => console.log(line), err: (line) => console.error(line) };

export const USAGE = [
  "Takes the hidden details (where a photo was taken, which phone took it) out of photos already stored.",
  "",
  "  node dist/scripts/cleanStoredPhotos.js            look only: say what would change, change nothing",
  "  node dist/scripts/cleanStoredPhotos.js --write    clean the photos",
  "",
  "Options:",
  "  --dir <folder>         the photos folder (default: the server's own, uploads inside DATA_DIR)",
  "  --backup-dir <folder>  with --write: copy each photo here before it is changed. The copies still hold the",
  "                         hidden details, so keep this folder private (never inside the photos folder) and",
  "                         delete it once you are happy",
  "  --verbose              list every photo that is cleaned, not just the first ten",
  "  --help                 show this",
].join("\n");

type Args = { write: boolean; verbose: boolean; help: boolean; dir?: string; backupDir?: string };

function parseArgs(argv: string[]): Args | { problem: string } {
  const args: Args = { write: false, verbose: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const equals = raw.startsWith("--") ? raw.indexOf("=") : -1;
    const flag = equals > 0 ? raw.slice(0, equals) : raw;
    let value = equals > 0 ? raw.slice(equals + 1) : undefined;
    const needsValue = flag === "--dir" || flag === "--backup-dir";
    if (needsValue && value === undefined) {
      value = argv[i + 1];
      i++;
    }
    if (needsValue && (!value || value.startsWith("--"))) return { problem: `${flag} needs a folder after it.` };

    if (flag === "--write") args.write = true;
    else if (flag === "--verbose") args.verbose = true;
    else if (flag === "--help" || flag === "-h") args.help = true;
    else if (flag === "--dir") args.dir = value;
    else if (flag === "--backup-dir") args.backupDir = value;
    else return { problem: `I don't know what "${raw}" means.` };
  }
  return args;
}

/** Runs the clean-up as the command line does. Returns the exit code: 0 all fine, 1 could not start, 2 some photos need a look. */
export function main(argv: string[], io: Output = consoleOutput, dataDirIsSet: boolean = DATA_DIR_IS_CONFIGURED): number {
  const args = parseArgs(argv);
  if ("problem" in args) {
    io.err(args.problem);
    io.err("");
    io.err(USAGE);
    return 1;
  }
  if (args.help) {
    io.out(USAGE);
    return 0;
  }
  if (args.backupDir && !args.write) {
    io.err("--backup-dir only makes sense with --write: looking only changes nothing, so there is nothing to back up.");
    return 1;
  }

  const dir = path.resolve(args.dir ?? UPLOADS_DIR);
  if (!args.dir && !dataDirIsSet) {
    io.out("Note: DATA_DIR is not set here, so this is the photos folder of this machine's own data, not a live server's disk.");
  }

  let report: CleanReport;
  try {
    report = cleanStoredPhotos({ dir, write: args.write, backupDir: args.backupDir });
  } catch (err) {
    io.err(err instanceof Error ? err.message : String(err));
    return 1;
  }
  if (report.folderMissing) {
    io.err(`There is no photos folder at ${dir}. If this should be the live server, check that DATA_DIR is set (it is /var/data on Render).`);
    return 1;
  }

  for (const line of summary(report, { write: args.write, verbose: args.verbose, backupDir: args.backupDir ? path.resolve(args.backupDir) : undefined })) io.out(line);
  return report.unreadable.length > 0 || report.failed.length > 0 ? 2 : 0;
}

// Run as a command (not when a test imports it).
if (require.main === module) process.exitCode = main(process.argv.slice(2));
