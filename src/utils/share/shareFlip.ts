import { ShareMode, ShareFlipBase } from "./types";
import { shareText } from "./shareText";
import { shareImage } from "./shareImage";
import { shareCSV } from "./shareCSV";
import { captureShareCard } from "./shareCard";

export async function shareFlip(
  flip: ShareFlipBase,
  mode: ShareMode = "full",
  cardRef?: any
) {
  switch (mode) {
    case "text":
      return shareText(flip, false);

    case "compact":
      return shareText(flip, true);

    case "image": {
      const uri = await captureShareCard(cardRef);
      if (uri) return shareImage(uri);
      return;
    }

    case "csv":
      return shareCSV(flip);

    case "full":
    default: {
      // full = text + optional image
      await shareText(flip, false);
      if (cardRef) {
        const uri = await captureShareCard(cardRef);
        if (uri) await shareImage(uri);
      }
      return;
    }
  }
}
