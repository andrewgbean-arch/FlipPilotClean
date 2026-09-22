import { Share } from "react-native";

// There's no legitimate public API for posting to Facebook Marketplace or
// Gumtree as a personal seller (unlike eBay's real Sell API) - the only way
// to "auto-post" there would be automating a logged-in browser, which breaks
// their terms and risks the SELLER's own account, not just ours. This is the
// honest alternative: hand them a ready-to-paste description through the
// phone's own Share sheet, which already includes Facebook, WhatsApp,
// Messages, Gumtree (if installed) and everything else - one tap short of
// automatic, without touching anyone's account on their behalf.
export type ShareableListing = {
  title: string;
  price: number | string;
  description?: string | null;
  location?: string | null;
};

export function listingShareText(listing: ShareableListing): string {
  const lines = [
    `${listing.title} - £${listing.price}`,
    listing.description?.trim() || null,
    listing.location ? `Location: ${listing.location}` : null,
    "Listed with FlipPilot",
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n\n");
}

export async function shareListing(listing: ShareableListing) {
  try {
    await Share.share({ message: listingShareText(listing) });
  } catch (err) {
    console.log("Share listing error:", err);
  }
}
