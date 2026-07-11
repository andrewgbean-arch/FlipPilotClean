import { Share } from "react-native";
import { ShareFlipBase } from "./types";

export async function shareCSV(flip: ShareFlipBase) {
  const escape = (v: string | null | undefined) =>
    `"${(v ?? "").replace(/"/g, '""')}"`;

  const csv =
    "Title,Buy,Sell,Profit,ROI,Confidence,Origin,Description,FlipScore,ProFlip,Image\n" +
    [
      escape(flip.title),
      flip.buyPrice,
      flip.sellPrice,
      flip.profit,
      flip.roi ?? "",
      flip.confidence ?? "",
      escape(flip.origin),
      escape(flip.description),
      flip.flipScore ?? "",
      flip.isProFlip ? "YES" : "NO",
      escape(flip.image),
    ].join(",");

  await Share.share({
    message: csv,
    title: "FlipPilot CSV Export",
  });
}
