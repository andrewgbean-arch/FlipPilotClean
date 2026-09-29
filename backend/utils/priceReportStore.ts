import fs from "fs";
import crypto from "crypto";
import { dataPath, writeJsonAtomic } from "../config/dataDir";

/**
 * "Doesn't look right? Report this" on a scan result — a snapshot of what was actually shown
 * (the item name and the four prices on screen), not a free-text complaint. Built as a real
 * feedback loop for pricing bugs: today's whole session has been the owner finding these by hand,
 * one scan at a time; this lets any customer flag one instead, with enough context (the exact
 * title, the exact numbers) to reproduce and fix it without needing to ask them anything more.
 * Read by whoever runs FlipPilot at /admin/price-reports, which never shows the device id.
 */

const PRICE_REPORT_PATH = dataPath("price-reports.json");

export const REPORT_MAX_CHARS = 500;
/** Per phone per day, so one phone can't fill the file. */
export const REPORTS_PER_DAY = 20;
/** Everything kept, oldest dropped first. */
export const REPORTS_MAX_KEPT = 5000;

export type PriceReportItem = {
  id: string;
  deviceId: string;
  title: string;
  retailPrice: number | null;
  trendingPrice: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
  note: string;
  at: string;
};

function load(): PriceReportItem[] {
  try {
    const raw = JSON.parse(fs.readFileSync(PRICE_REPORT_PATH, "utf8"));
    return Array.isArray(raw?.items) ? raw.items : [];
  } catch {
    return [];
  }
}

const save = (items: PriceReportItem[]) => writeJsonAtomic(PRICE_REPORT_PATH, { items });

export type AddResult = { ok: true; id: string } | { ok: false; reason: "too-many" };

export function addPriceReport(
  deviceId: string,
  entry: {
    title: string;
    retailPrice: number | null;
    trendingPrice: number | null;
    buyPrice: number | null;
    sellPrice: number | null;
    note: string;
  },
  now = Date.now()
): AddResult {
  const items = load();
  const dayAgo = now - 24 * 3_600_000;
  const recent = items.filter((i) => i.deviceId === deviceId && Date.parse(i.at) > dayAgo).length;
  if (recent >= REPORTS_PER_DAY) return { ok: false, reason: "too-many" };

  const item: PriceReportItem = {
    id: crypto.randomBytes(6).toString("hex"),
    deviceId,
    title: entry.title,
    retailPrice: entry.retailPrice,
    trendingPrice: entry.trendingPrice,
    buyPrice: entry.buyPrice,
    sellPrice: entry.sellPrice,
    note: entry.note,
    at: new Date(now).toISOString(),
  };
  items.push(item);
  save(items.length > REPORTS_MAX_KEPT ? items.slice(items.length - REPORTS_MAX_KEPT) : items);
  return { ok: true, id: item.id };
}

export const priceReportsBy = (deviceId: string) =>
  load()
    .filter((i) => i.deviceId === deviceId)
    .map(({ title, retailPrice, trendingPrice, buyPrice, sellPrice, note, at }) => ({
      title,
      retailPrice,
      trendingPrice,
      buyPrice,
      sellPrice,
      note,
      at,
    }));

export function deletePriceReportsBy(deviceId: string): number {
  const items = load();
  const kept = items.filter((i) => i.deviceId !== deviceId);
  if (kept.length !== items.length) save(kept);
  return items.length - kept.length;
}

export function purgePriceReportsBefore(cutoff: Date): number {
  const items = load();
  const kept = items.filter((i) => Date.parse(i.at) >= cutoff.getTime());
  if (kept.length !== items.length) save(kept);
  return items.length - kept.length;
}

/** For the person running FlipPilot: newest first, with no device id (only a short fingerprint to tell phones apart). */
export function priceReportList(days: number, now = Date.now()) {
  const since = now - days * 24 * 3_600_000;
  const items = load()
    .filter((i) => Date.parse(i.at) >= since)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return {
    days,
    count: items.length,
    items: items.map((i) => ({
      at: i.at,
      title: i.title,
      retailPrice: i.retailPrice,
      trendingPrice: i.trendingPrice,
      buyPrice: i.buyPrice,
      sellPrice: i.sellPrice,
      note: i.note,
      from: crypto.createHash("sha256").update(i.deviceId).digest("hex").slice(0, 6),
    })),
  };
}
