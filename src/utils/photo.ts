// photo.ts — gets a camera photo ready to send to the server for an AI lookup.
//
// A phone photo is 3000+ pixels wide and easily 1-3MB once it is base64 text.
// Uploading that over mobile data, and having the AI read it, was the slowest
// part of a lookup. Product labels are readable at 1024px, and the file drops
// to a few hundred KB.

import * as FileSystem from "expo-file-system/legacy";

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.7;

type CapturedPhoto = { uri: string; width?: number; height?: number };

/**
 * Base64 JPEG of the photo, shrunk to at most 1024px on its long edge.
 * If shrinking is not possible (for example a build without the native module),
 * the original file is sent as it is, so a lookup never fails because of this.
 */
export async function photoForUpload(photo: CapturedPhoto): Promise<string | null> {
  try {
    // Loaded here, not at the top, so a build that lacks the module still runs.
    const { manipulateAsync, SaveFormat } = await import("expo-image-manipulator");

    const { width = 0, height = 0 } = photo;
    const resize =
      width >= height
        ? width > MAX_EDGE
          ? [{ resize: { width: MAX_EDGE } }]
          : []
        : height > MAX_EDGE
        ? [{ resize: { height: MAX_EDGE } }]
        : [];

    const result = await manipulateAsync(photo.uri, resize, {
      compress: JPEG_QUALITY,
      format: SaveFormat.JPEG,
      base64: true,
    });

    if (result.base64) return result.base64;
  } catch (err) {
    console.log("Photo shrink failed, sending the original:", err);
  }

  try {
    return await FileSystem.readAsStringAsync(photo.uri, { encoding: "base64" });
  } catch (err) {
    console.log("Photo read failed:", err);
    return null;
  }
}
