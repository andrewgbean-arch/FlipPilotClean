import * as Sharing from "expo-sharing";

export async function shareImage(uri: string) {
  try {
    await Sharing.shareAsync(uri);
  } catch (e) {
    console.log("Image share failed:", e);
  }
}
