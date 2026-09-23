import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";

export type ReviewStatus = {
  canReview: boolean;
  alreadyReviewed: boolean;
  sellerId: string | null;
};

/** Is this device the person the seller sold the item to, and yet to review it? */
export async function getReviewStatus(listingId: string | number): Promise<ReviewStatus> {
  const none: ReviewStatus = { canReview: false, alreadyReviewed: false, sellerId: null };
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${BASE_URL}/listings/${encodeURIComponent(String(listingId))}/review-status`, {
      headers: { "x-device-id": deviceId },
    });
    const data = await res.json();
    if (!data?.ok) return none;
    return {
      canReview: Boolean(data.canReview),
      alreadyReviewed: Boolean(data.alreadyReviewed),
      sellerId: typeof data.sellerId === "string" ? data.sellerId : null,
    };
  } catch {
    return none;
  }
}
