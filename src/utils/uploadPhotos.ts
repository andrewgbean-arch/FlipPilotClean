import { Image } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";

// Big enough to see the item properly, small enough to send over mobile data
// and stay well under the server's 3MB limit.
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.75;
const TIMEOUT_MS = 30_000;

function sizeOf(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) =>
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    )
  );
}

/** A phone photo shrunk to something worth uploading, as base64 JPEG. */
async function prepare(uri: string): Promise<string> {
  try {
    const { manipulateAsync, SaveFormat } = await import("expo-image-manipulator");
    const size = await sizeOf(uri);
    const longest = size ? Math.max(size.width, size.height) : 0;
    const resize =
      size && longest > MAX_EDGE
        ? [size.width >= size.height ? { resize: { width: MAX_EDGE } } : { resize: { height: MAX_EDGE } }]
        : [];

    const result = await manipulateAsync(uri, resize, {
      compress: JPEG_QUALITY,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (result.base64) return result.base64;
  } catch (err) {
    console.log("Photo shrink failed, sending the original:", err);
  }
  return FileSystem.readAsStringAsync(uri, { encoding: "base64" });
}

/**
 * Uploads each photo and returns the references the server gave back. A listing
 * or fair may only use photos this device uploaded, so this has to run before
 * the form is submitted. Throws with a message fit to show the person if any
 * photo fails, so nothing is ever published half-illustrated.
 */
export async function uploadPhotos(uris: string[]): Promise<string[]> {
  const deviceId = await getDeviceId();
  const out: string[] = [];

  for (const uri of uris) {
    // Already on our server (a re-submit after an earlier failure).
    if (uri.startsWith("/uploads/")) {
      out.push(uri);
      continue;
    }

    const imageBase64 = await prepare(uri);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE_URL}/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ imageBase64 }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok || typeof data.path !== "string") {
        throw new Error(data?.error ?? "A photo couldn't be uploaded.");
      }
      out.push(data.path);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error("Uploading a photo took too long. Check your connection and try again.");
      }
      throw err instanceof Error ? err : new Error("A photo couldn't be uploaded.");
    } finally {
      clearTimeout(timer);
    }
  }

  return out;
}
