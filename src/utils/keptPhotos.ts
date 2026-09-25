import * as FileSystem from "expo-file-system/legacy";

/**
 * A picture from the camera or the photo picker sits in the phone's cache folder, which the system can
 * clear at any time, leaving a saved flip or vehicle with a blank photo. So a picture that is going to be
 * saved is copied into the app's own documents folder first, and removed again when what it belonged to
 * is deleted.
 */
const OURS = /flip-photo-|vehicle-photo-/;

export const isKeptPhoto = (uri: unknown, dir: string | null | undefined = FileSystem.documentDirectory): uri is string =>
  typeof uri === "string" && !!dir && uri.startsWith(dir) && OURS.test(uri.slice(dir.length));

export async function keepPhoto(uri: string, prefix: "flip-photo" | "vehicle-photo" = "flip-photo"): Promise<string> {
  const dir = FileSystem.documentDirectory;
  if (!dir || !uri.startsWith("file://") || uri.startsWith(dir)) return uri;

  try {
    const dest = `${dir}${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (err) {
    console.log("Couldn't keep a copy of the photo:", err);
    return uri;
  }
}

/** Removes the kept copies among these pictures (never anything else). Safe to call for any list. */
export async function deleteKeptPhotos(uris: unknown[]): Promise<void> {
  for (const uri of uris) {
    if (!isKeptPhoto(uri)) continue;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // A photo that can't be removed is only wasted space.
    }
  }
}
