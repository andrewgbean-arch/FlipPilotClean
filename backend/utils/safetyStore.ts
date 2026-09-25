import fs from "fs";
import path from "path";
import { dataPath, writeJsonAtomic } from "../config/dataDir";

/**
 * Blocks and reports for the marketplace.
 *
 * Both are keyed on device ids, which stay on the server. A block is the
 * blocker's own list and hides nothing from anyone else; a report is a private
 * note for whoever runs the marketplace.
 */

const BLOCKS_PATH = dataPath("blocks.json");
const REPORTS_PATH = dataPath("reports.json");

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
  writeJsonAtomic(BLOCKS_PATH, blocks);
}

export function removeBlock(blocker: string, target: string) {
  const blocks = loadBlocks();
  blocks[blocker] = (blocks[blocker] ?? []).filter((t) => t !== target);
  writeJsonAtomic(BLOCKS_PATH, blocks);
}

/** Everything block-related that names this device: their own list, and their id on anyone else's. */
export function removeAllBlocksFor(deviceId: string): number {
  const blocks = loadBlocks();
  let touched = 0;
  if (blocks[deviceId]) {
    touched += blocks[deviceId].length;
    delete blocks[deviceId];
  }
  for (const [blocker, targets] of Object.entries(blocks)) {
    if (targets.includes(deviceId)) {
      blocks[blocker] = targets.filter((t) => t !== deviceId);
      touched++;
    }
  }
  writeJsonAtomic(BLOCKS_PATH, blocks);
  return touched;
}

/** How many people this device has blocked. The ids of the blocked are not theirs to export. */
export function blockCountFor(deviceId: string): number {
  return (loadBlocks()[deviceId] ?? []).length;
}

export function reportsBy(deviceId: string): Report[] {
  return loadReports().filter((r) => r.reporterDeviceId === deviceId);
}

/**
 * A reporter's identity goes, the report stays: it may matter to a safety
 * decision or a legal claim about the person they reported.
 */
export function anonymiseReportsBy(deviceId: string): number {
  const reports = loadReports();
  let changed = 0;
  for (const r of reports) {
    if (r.reporterDeviceId === deviceId) {
      r.reporterDeviceId = "deleted";
      changed++;
    }
  }
  if (changed > 0) writeJsonAtomic(REPORTS_PATH, reports);
  return changed;
}

export function purgeReportsBefore(cutoff: Date): number {
  const reports = loadReports();
  const kept = reports.filter((r) => Date.parse(r.createdAt) >= cutoff.getTime());
  if (kept.length !== reports.length) {
    writeJsonAtomic(REPORTS_PATH, kept);
  }
  return reports.length - kept.length;
}

export function loadReports(): Report[] {
  const raw = readJson<unknown>(REPORTS_PATH, []);
  return Array.isArray(raw) ? (raw as Report[]) : [];
}

export function addReport(report: Report) {
  const reports = loadReports();
  reports.push(report);
  writeJsonAtomic(REPORTS_PATH, reports);
}
