import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";

const REASONS: { key: string; label: string; hint: string }[] = [
  { key: "scam", label: "It looks like a scam", hint: "Asking for money up front, gift cards, or to move off the app" },
  { key: "fake", label: "Fake or not as described", hint: "The item or the photos aren't real" },
  { key: "abusive", label: "Abusive or threatening", hint: "Rude, threatening or harassing messages" },
  { key: "prohibited", label: "Shouldn't be for sale", hint: "Illegal, stolen or banned items" },
  { key: "other", label: "Something else", hint: "Anything else we should look at" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  listingId?: string | number;
  /** Set to report a sponsored advert instead of a listing. */
  advertId?: string;
  /** Set when reporting a conversation rather than the listing itself. */
  thread?: string | null;
};

/**
 * Sends a private report to whoever runs the marketplace. The other person is
 * never told who reported them.
 */
export default function ReportSheet({ visible, onClose, listingId, advertId, thread }: Props) {
  const theme = useTheme();
  const [sending, setSending] = useState(false);

  const send = async (reason: string) => {
    setSending(true);
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(
        advertId ? `${BASE_URL}/adverts/${encodeURIComponent(advertId)}/report` : `${BASE_URL}/safety/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": deviceId },
          body: JSON.stringify(advertId ? { reason } : { listingId, reason, thread: thread ?? undefined }),
        }
      );
      const data = await res.json().catch(() => null);

      if (!data?.ok) {
        Alert.alert("Couldn't send the report", data?.error ?? "Please try again.");
        return;
      }
      onClose();
      Alert.alert("Report sent", "Thank you. We'll take a look. The other person won't be told it was you.");
    } catch {
      Alert.alert("Couldn't send the report", "Please check your connection and try again.");
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
          }}
        >
          <Text style={{ color: theme.goldDeep, fontSize: 20, fontWeight: "800", marginBottom: 4 }}>
            {advertId ? "Report this advert" : thread ? "Report this conversation" : "Report this listing"}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 14 }}>
            Pick what fits best. It goes to us privately.
          </Text>

          {REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              disabled={sending}
              onPress={() => send(r.key)}
              accessibilityRole="button"
              style={{
                backgroundColor: theme.card,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.goldSoftGlow,
                padding: 12,
                marginBottom: 8,
                opacity: sending ? 0.5 : 1,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>{r.label}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{r.hint}</Text>
            </TouchableOpacity>
          ))}

          {sending ? (
            <ActivityIndicator color={theme.goldDeep} style={{ marginTop: 8 }} />
          ) : (
            <TouchableOpacity onPress={onClose} style={{ alignItems: "center", paddingTop: 10 }}>
              <Text style={{ color: theme.muted, fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
