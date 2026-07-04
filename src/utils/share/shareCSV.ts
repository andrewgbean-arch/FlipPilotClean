import { Share } from "react-native";
import { ShareFlipBase } from "./types";

export async function shareCSV(flip: ShareFlipBase) {
  const csv =
    "Title,Buy,Sell,Profit,ROI,Confidence,Origin,Description\n" +
    `"${flip.title}",${flip.buyPrice},${flip.sellPrice},${flip.profit},${flip.roi},${flip.confidence},"${flip.origin ?? ""}","${flip.description ?? ""}"`;

  await Share.share({
    message: csv,
    title: "FlipPilot CSV Export",
  });
}
