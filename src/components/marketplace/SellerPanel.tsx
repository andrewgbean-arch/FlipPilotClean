import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, TextInput, Alert } from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import StarRating from "@/components/marketplace/StarRating";

type Review = {
  id: string;
  stars: number;
  comment: string;
  createdAt: string;
};

type SellerProfile = {
  id: string;
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
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

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
  }, [load]);

  const submitReview = async () => {
    if (stars < 1) return Alert.alert("Pick a number of stars first");

    setSending(true);
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(`${BASE_URL}/sellers/${sellerId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, listingId, stars, comment }),
      });
      const data = await res.json().catch(() => null);

      if (!data?.ok) {
        // The server's own words: you can't review yourself, you haven't
        // messaged them, or you have already left one.
        Alert.alert("Couldn't leave that review", data?.message ?? "Please try again.");
        return;
      }

      setWriting(false);
      setStars(0);
      setComment("");
      await load();
    } catch {
      Alert.alert("Couldn't leave that review", "Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

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
      <Text style={{ color: theme.goldDeep, fontWeight: "800", fontSize: 16, marginBottom: 10 }}>
        Seller
      </Text>

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

      {/* LEAVE ONE */}
      {!writing ? (
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
          <Text style={{ color: theme.goldDeep, fontWeight: "700" }}>
            Leave a review
          </Text>
        </Pressable>
      ) : (
        <View style={{ marginTop: 14, gap: 10 }}>
          <Text style={{ color: theme.text, fontSize: 14 }}>How did it go?</Text>
          <StarRating stars={stars || null} size={26} onPick={setStars} />

          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder="Anything worth saying (optional)"
            placeholderTextColor={theme.muted}
            style={{
              backgroundColor: theme.background,
              color: theme.white,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.hairline,
              padding: 12,
              minHeight: 70,
              textAlignVertical: "top",
            }}
          />

          <Text style={{ color: theme.muted, fontSize: 12 }}>
            You can review a seller once you've messaged them about the item.
          </Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setWriting(false)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.muted,
                alignItems: "center",
              }}
            >
              <Text style={{ color: theme.text }}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={submitReview}
              disabled={sending}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: theme.goldDeep,
                alignItems: "center",
                opacity: sending ? 0.6 : 1,
              }}
            >
              <Text style={{ color: theme.black, fontWeight: "800" }}>
                {sending ? "Sending…" : "Post review"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
