import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
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

// The same five reasons the server understands, worded for an advert: what is wrong with an
// advert is not what is wrong with a listing.
const ADVERT_REASONS: { key: string; label: string; hint: string }[] = [
  { key: "scam", label: "It looks like a scam", hint: "Promises of easy money, asks for payment up front, or pushes you off the app" },
  { key: "fake", label: "Misleading or not true", hint: "It claims something that isn't true, or the link goes somewhere else" },
  { key: "abusive", label: "Rude or offensive", hint: "Swearing, insults, or something that upsets people" },
  { key: "prohibited", label: "Illegal or dangerous", hint: "Something that shouldn't be advertised" },
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
  // Adverts: pick a reason, add a few words if you like, then send.
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const reasons = advertId ? ADVERT_REASONS : REASONS;

  const send = async (reason: string, details?: string) => {
    setSending(true);
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(
        advertId ? `${BASE_URL}/adverts/${encodeURIComponent(advertId)}/report` : `${BASE_URL}/safety/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-device-id": deviceId },
          body: JSON.stringify(advertId ? { reason, details: details?.trim() || undefined } : { listingId, reason, thread: thread ?? undefined }),
        }
      );
      const data = await res.json().catch(() => null);

      if (!data?.ok) {
        Alert.alert("Couldn't send the report", data?.error ?? "Please try again.");
        return;
      }
      setPicked(null);
      setNote("");
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
            {advertId ? "Pick what fits best. It goes to us privately, and the advertiser is never told who reported." : "Pick what fits best. It goes to us privately."}
          </Text>

          {reasons.map((r) => (
            <TouchableOpacity
              key={r.key}
              disabled={sending}
              onPress={() => (advertId ? setPicked(r.key) : send(r.key))}
              accessibilityRole="button"
              accessibilityState={advertId ? { selected: picked === r.key } : undefined}
              style={{
                backgroundColor: theme.card,
                borderRadius: theme.radius.md,
                borderWidth: advertId && picked === r.key ? 2 : 1,
                borderColor: advertId && picked === r.key ? theme.goldDeep : theme.goldSoftGlow,
                padding: 12,
                marginBottom: 8,
                opacity: sending ? 0.5 : 1,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>{r.label}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{r.hint}</Text>
            </TouchableOpacity>
          ))}

          {advertId && picked ? (
            <View style={{ marginTop: 4, marginBottom: 6 }}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Anything to add? (optional)"
                placeholderTextColor={theme.muted}
                maxLength={200}
                multiline
                style={{
                  backgroundColor: theme.card,
                  color: theme.text,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.goldSoftGlow,
                  padding: 10,
                  minHeight: 60,
                  textAlignVertical: "top",
                }}
              />
              <TouchableOpacity
                disabled={sending}
                onPress={() => send(picked, note)}
                accessibilityRole="button"
                style={{
                  backgroundColor: theme.goldDeep,
                  borderRadius: 999,
                  paddingVertical: 12,
                  alignItems: "center",
                  marginTop: 10,
                  opacity: sending ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.black, fontWeight: "800", fontSize: 15 }}>Send report</Text>
              </TouchableOpacity>
            </View>
          ) : null}

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
