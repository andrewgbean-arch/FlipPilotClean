import { Share } from "react-native";

/**
 * Puts text on the clipboard. If this build does not include the clipboard
 * module yet (a phone that has not been rebuilt since it was added), it opens
 * the phone's share sheet instead, which has a Copy option, so the button still
 * works rather than failing.
 */
export async function copyText(text: string): Promise<"copied" | "shared" | "failed"> {
  try {
    const Clipboard = await import("expo-clipboard");
    await Clipboard.setStringAsync(text);
    return "copied";
  } catch {
    // No native clipboard here; fall through to the share sheet.
  }

  try {
    await Share.share({ message: text });
    return "shared";
  } catch {
    return "failed";
  }
}
