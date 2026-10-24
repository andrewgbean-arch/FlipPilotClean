import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { BASE_URL } from "@/utils/api";
import { getReviewStatus } from "@/utils/reviewStatus";
import StarRating from "@/components/marketplace/StarRating";
import ReviewSheet from "@/components/marketplace/ReviewSheet";
import { stableWeight } from "@/styles/boldTextSafe";

type Review = {
  id: string;
  stars: number;
  comment: string;
  createdAt: string;
};

type SellerProfile = {
  id: string;
  displayName: string | null;
  /**
   * A business. "dealer-os": a dealership listing through FlipPilot Dealer OS, which approves each dealership before it can
   * list. "app": a dealer who signed up here and gave a business name (not checked).
   */
  trade?: boolean;
  tradeVia?: "dealer-os" | "app";
  tradeName?: string | null;
  joinedAt: string;
  itemsSold: number;
  itemsForSale: number;
  stars: number | null;
  reviewCount: number;
  reviews: Review[];
};

/** "March 2026" — the month is as precise as a joined date needs to be. */
function joinedLabel(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "Unknown";
  return when.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function reviewDate(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return when.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Who you are buying from: when they joined, what they have sold, and what
 * buyers said. Everything is counted from something real, and a seller with no
 * history is shown as having none.
 */
export default function SellerPanel({
  sellerId,
  listingId,
}: {
  sellerId: string | null | undefined;
  listingId: string | number;
}) {
  const theme = useTheme();

  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  const [writing, setWriting] = useState(false);
  // Only the person the seller marked this item as sold to may review it.
  const [canReview, setCanReview] = useState(false);

  const load = useCallback(async () => {
    if (!sellerId) return setState("failed");
    try {
      const res = await fetch(`${BASE_URL}/sellers/${sellerId}`);
      const data = await res.json();
      if (!data?.ok) return setState("failed");
      setProfile(data.seller);
      setState("ready");
    } catch {
      setState("failed");
    }
  }, [sellerId]);

  useEffect(() => {
    load();
    getReviewStatus(listingId).then((status) => setCanReview(status.canReview));
  }, [load, listingId]);

  const card = {
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.hairline,
    padding: 14,
    marginTop: 20,
  } as const;

  if (state === "loading") {
    return (
      <View style={[card, { alignItems: "center" }]}>
        <ActivityIndicator color={theme.goldDeep} />
      </View>
    );
  }

  // No profile is not a reason to imply anything about the seller either way.
  if (state === "failed" || !profile) {
    return (
      <View style={card}>
        <Text style={{ color: theme.goldDeep, fontWeight: "800", fontSize: 16, marginBottom: 6 }}>
          Seller
        </Text>
        <Text style={{ color: theme.muted, fontSize: 14 }}>
          Nothing known about this seller yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={card}>
      <Text style={{ color: theme.goldDeep, fontWeight: "800", fontSize: 16 }}>
        {profile.trade ? profile.tradeName ?? profile.displayName ?? "Trade seller" : profile.displayName ?? "Seller"}
      </Text>
      {profile.trade ? (
        // A business, and it says so: buyers have different rights buying from one. Said in words that only claim what is true.
        <Text style={{ color: theme.goldDeep, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
          {profile.tradeVia === "dealer-os" ? "Trade seller · lists through FlipPilot Dealer OS" : "Trade seller · business name given by the seller"}
        </Text>
      ) : (
        profile.displayName != null && (
          // Said plainly, because a name is only a name — nothing checks it.
          <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
            Name chosen by the seller
          </Text>
        )
      )}

      <View style={{ height: 10 }} />

      <StarRating stars={profile.stars} count={profile.reviewCount} />

      <View style={{ marginTop: 10, gap: 4 }}>
        <Text style={{ color: theme.text, fontSize: 14 }}>
          On FlipPilot since {joinedLabel(profile.joinedAt)}
        </Text>
        <Text style={{ color: theme.text, fontSize: 14 }}>
          {profile.itemsSold} {profile.itemsSold === 1 ? "item" : "items"} sold
          {profile.itemsForSale > 0 ? ` · ${profile.itemsForSale} for sale now` : ""}
        </Text>
      </View>

      {/* REVIEWS */}
      {profile.reviews.length > 0 && (
        <View style={{ marginTop: 14, gap: 12 }}>
          {profile.reviews.map((review) => (
            <View
              key={review.id}
              style={{
                borderTopWidth: 1,
                borderTopColor: theme.hairline,
                paddingTop: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <StarRating stars={review.stars} size={14} />
                <Text style={[{ color: theme.muted, fontSize: 12 }, stableWeight]}>
                  {reviewDate(review.createdAt)}
                </Text>
              </View>
              {review.comment !== "" && (
                <Text style={{ color: theme.text, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
                  {review.comment}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* LEAVE ONE: only for the person the seller sold this to. Nobody else is
          shown a button, because nobody else can post one. */}
      {canReview && sellerId ? (
        <>
          <Pressable
            onPress={() => setWriting(true)}
            style={{
              marginTop: 14,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: theme.goldDeep,
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.goldDeep, fontWeight: "700" }}>Leave a review</Text>
          </Pressable>

          <ReviewSheet
            visible={writing}
            onClose={() => setWriting(false)}
            onDone={() => {
              setCanReview(false);
              load();
            }}
            sellerId={sellerId}
            listingId={listingId}
          />
        </>
      ) : null}
    </View>
  );
}
