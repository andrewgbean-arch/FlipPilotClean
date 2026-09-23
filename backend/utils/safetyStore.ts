import fs from "fs";
import path from "path";

/**
 * Blocks and reports for the marketplace.
 *
 * Both are keyed on device ids, which stay on the server. A block is the
 * blocker's own list and hides nothing from anyone else; a report is a private
 * note for whoever runs the marketplace.
 */

const BLOCKS_PATH = path.join(__dirname, "../data/blocks.json");
const REPORTS_PATH = path.join(__dirname, "../data/reports.json");

type BlockMap = Record<string, string[]>;

export type Report = {
  id: string;
  reporterDeviceId: string;
  listingId: string;
  threadId: string | null;
  reason: string;
  details: string;
  createdAt: string;
};

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    // A corrupt file must not be silently saved over with an empty one.
    throw new Error(`${path.basename(file)} could not be read`);
  }
}

function loadBlocks(): BlockMap {
  const raw = readJson<unknown>(BLOCKS_PATH, {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as BlockMap) : {};
}

export function hasBlocked(blocker: string, target: string): boolean {
  return (loadBlocks()[blocker] ?? []).includes(target);
}

/** Either direction: nobody should be messaging someone one of them blocked. */
export function isBlockedEitherWay(a: string, b: string): boolean {
  return hasBlocked(a, b) || hasBlocked(b, a);
}

export function blockedBy(blocker: string): string[] {
  return loadBlocks()[blocker] ?? [];
}

export function addBlock(blocker: string, target: string) {
  const blocks = loadBlocks();
  const list = blocks[blocker] ?? [];
  if (!list.includes(target)) list.push(target);
  blocks[blocker] = list;
  fs.writeFileSync(BLOCKS_PATH, JSON.stringify(blocks, null, 2));
}

export function removeBlock(blocker: string, target: string) {
  const blocks = loadBlocks();
  blocks[blocker] = (blocks[blocker] ?? []).filter((t) => t !== target);
  fs.writeFileSync(BLOCKS_PATH, JSON.stringify(blocks, null, 2));
}

export function loadReports(): Report[] {
  const raw = readJson<unknown>(REPORTS_PATH, []);
  return Array.isArray(raw) ? (raw as Report[]) : [];
}

export function addReport(report: Report) {
  const reports = loadReports();
  reports.push(report);
  fs.writeFileSync(REPORTS_PATH, JSON.stringify(reports, null, 2));
}
