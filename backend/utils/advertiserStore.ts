import fs from "fs";
import path from "path";
import { dataPath, writeJsonAtomic } from "../config/dataDir";

/**
 * The businesses that advertise through the advertising portal: one profile per FlipPilot
 * account. What goes on their adverts (name, logo, phone, address, website) comes from here, so a
 * business sets it once. The account itself (email, sign-in) stays in accountStore.
 */

const ADVERTISERS_PATH = dataPath("advertisers.json");

export type AdvertiserProfile = {
  accountId: string;
  businessName: string;
  /** https only, or "" for a business with no website. */
  website: string;
  phone: string | null;
  address: string | null;
  /** Where the business is: the middle of its local area. */
  postcode: string | null;
  /** "/uploads/<name>" */
  logo: string | null;
  /** When they agreed to the advertiser terms. Nothing can be booked before. */
  termsAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function readAll(): AdvertiserProfile[] {
  if (!fs.existsSync(ADVERTISERS_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(ADVERTISERS_PATH, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    throw new Error("advertisers.json could not be read");
  }
}

function writeAll(list: AdvertiserProfile[]) {
  fs.mkdirSync(path.dirname(ADVERTISERS_PATH), { recursive: true });
  writeJsonAtomic(ADVERTISERS_PATH, list);
}

export function profileFor(accountId: string): AdvertiserProfile | null {
  return readAll().find((p) => p.accountId === accountId) ?? null;
}

export function saveProfile(profile: AdvertiserProfile) {
  const all = readAll().filter((p) => p.accountId !== profile.accountId);
  writeAll([...all, profile]);
}

/** Deleting an account deletes its advertiser profile too (its adverts are handled with the adverts). */
export function deleteProfile(accountId: string): AdvertiserProfile | null {
  const all = readAll();
  const gone = all.find((p) => p.accountId === accountId) ?? null;
  if (gone) writeAll(all.filter((p) => p.accountId !== accountId));
  return gone;
}

/** A UK phone number, tidied: digits, spaces and one leading +, 10 to 13 digits. Null when it isn't one. */
export function cleanPhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/[()\-.]/g, " ").replace(/\s+/g, " ");
  if (!/^\+?[\d ]+$/.test(t)) return null;
  const digits = t.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  if (t.startsWith("+") && !digits.startsWith("44")) return null;
  if (!t.startsWith("+") && !digits.startsWith("0")) return null;
  return t;
}
