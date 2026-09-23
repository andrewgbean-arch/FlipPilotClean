import React, { useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import StarRating from "@/components/marketplace/StarRating";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called once the review has been posted. */
  onDone?: () => void;
  sellerId: string;
  listingId: string | number;
};

/**
 * The stars-and-a-comment sheet. The server only accepts it from the person the
 * seller marked the item as sold to, so a review here is always from a real
 * buyer.
 */
export default function ReviewSheet({ visible, onClose, onDone, sellerId, listingId }: Props) {
  const theme = useTheme();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
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
        Alert.alert("Couldn't leave that review", data?.message ?? data?.error ?? "Please try again.");
        return;
      }

      setStars(0);
      setComment("");
      onClose();
      onDone?.();
      Alert.alert("Thank you", "Your review has been posted.");
    } catch {
      Alert.alert("Couldn't leave that review", "Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
            padding: 20,
            paddingBottom: 32,
            gap: 12,
          }}
        >
          <Text style={{ color: theme.goldDeep, fontSize: 20, fontWeight: "800" }}>
            Leave a review
          </Text>
          <Text style={{ color: theme.text, fontSize: 14 }}>How did it go?</Text>

          <StarRating stars={stars || null} size={32} onPick={setStars} />

          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={500}
            placeholder="Anything worth saying (optional)"
            placeholderTextColor={theme.muted}
            style={{
              backgroundColor: theme.card,
              color: theme.white,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.hairline,
              padding: 12,
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.muted,
                alignItems: "center",
              }}
            >
              <Text style={{ color: theme.text }}>Not now</Text>
            </Pressable>

            <Pressable
              onPress={submit}
              disabled={sending}
              style={{
                flex: 1,
                paddingVertical: 12,
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}
