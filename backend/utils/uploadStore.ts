import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Photos people attach to listings and boot fairs.
 *
 * Stored on disk under backend/data/uploads with a random name, and recorded
 * with the device that uploaded them, so a listing can only use a photo its own
 * device uploaded and every photo can be deleted with the thing it belongs to.
 * A photo is public to anyone with its address once it is on a listing.
 */

export const UPLOADS_DIR = path.join(__dirname, "../data/uploads");
const REGISTRY_PATH = path.join(__dirname, "../data/uploads.json");

/** What an app-supplied photo reference must look like to be trusted. */
export const UPLOAD_PATH_PATTERN = /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/;

/**
 * Pictures we hold for ourselves (adverts) are owned by an id starting with this.
 * A phone's device id may never start with it, so no phone can list, claim or
 * delete them by naming that owner.
 */
export const SYSTEM_OWNER_PREFIX = "system:";
export const isSystemOwner = (id: unknown) => typeof id === "string" && id.startsWith(SYSTEM_OWNER_PREFIX);

type Registry = Record<string, { deviceId: string; createdAt: string }>;

function loadRegistry(): Registry {
  if (!fs.existsSync(REGISTRY_PATH)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Never save over a file we could not read.
    throw new Error("uploads.json could not be read");
  }
}

function saveRegistry(registry: Registry) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

/** The real file type from the first bytes, not from anything the client said. */
export function sniffImage(buffer: Buffer): "jpg" | "png" | "webp" | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function saveUpload(deviceId: string, buffer: Buffer, ext: "jpg" | "png" | "webp"): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);

  const registry = loadRegistry();
  registry[name] = { deviceId, createdAt: new Date().toISOString() };
  saveRegistry(registry);

  return `/uploads/${name}`;
}

/** Keeps only photo references this device really uploaded. Anything else is dropped. */
export function ownedUploads(deviceId: string | null | undefined, raw: unknown, max = 6): string[] {
  if (!deviceId || isSystemOwner(deviceId) || !Array.isArray(raw)) return [];
  const registry = loadRegistry();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !UPLOAD_PATH_PATTERN.test(item)) continue;
    const name = item.slice("/uploads/".length);
    if (registry[name]?.deviceId !== deviceId) continue;
    if (!out.includes(item)) out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

export function deleteUploads(paths: unknown[]): number {
  const registry = loadRegistry();
  let removed = 0;
  for (const p of paths) {
    if (typeof p !== "string" || !UPLOAD_PATH_PATTERN.test(p)) continue;
    const name = p.slice("/uploads/".length);
    try {
      fs.rmSync(path.join(UPLOADS_DIR, name), { force: true });
    } catch {
      // A file that is already gone is the outcome we wanted.
    }
    if (registry[name]) {
      delete registry[name];
      removed++;
    }
  }
  if (removed > 0) saveRegistry(registry);
  return removed;
}

export function uploadsBy(deviceId: string): string[] {
  if (isSystemOwner(deviceId)) return [];
  const registry = loadRegistry();
  return Object.entries(registry)
    .filter(([, v]) => v.deviceId === deviceId)
    .map(([name]) => `/uploads/${name}`);
}

/** Photos nothing refers to any more (an abandoned listing form), after a grace period. */
export function purgeOrphanUploads(inUse: Set<string>, olderThanHours: number, now = new Date()): number {
  const registry = loadRegistry();
  const cutoff = now.getTime() - olderThanHours * 60 * 60 * 1000;
  const orphans = Object.entries(registry)
    .filter(([name, v]) => !inUse.has(`/uploads/${name}`) && Date.parse(v.createdAt) < cutoff)
    .map(([name]) => `/uploads/${name}`);
  return deleteUploads(orphans);
}
