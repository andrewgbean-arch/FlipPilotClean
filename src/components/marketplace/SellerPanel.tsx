import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { BASE_URL } from "@/utils/api";
import { getReviewStatus } from "@/utils/reviewStatus";
import StarRating from "@/components/marketplace/StarRating";
import ReviewSheet from "@/components/marketplace/ReviewSheet";

type Review = {
  id: string;
  stars: number;
  comment: string;
  createdAt: string;
};

type SellerProfile = {
  id: string;
  displayName: string | null;
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
        {profile.displayName ?? "Seller"}
      </Text>
      {profile.displayName != null && (
        // Said plainly, because a name is only a name — nothing checks it.
        <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
          Name chosen by the seller
        </Text>
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
                <Text style={{ color: theme.muted, fontSize: 12 }}>
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
