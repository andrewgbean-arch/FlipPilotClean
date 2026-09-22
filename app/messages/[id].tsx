import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/styles/ThemeContext";
import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import {
  checkMessage,
  ScamWarning,
  MESSAGE_SAFETY_TIPS,
  RISKY_TO_SEND,
} from "@/utils/scamSafety";
import SafetyCard from "@/components/marketplace/SafetyCard";

type ChatMessage = {
  sender: string;
  message: string;
  timestamp: string;
};

const MY_SENDER_NAME = "You";

/** One last look before your own details leave the phone. */
function confirmRiskySend(warnings: ScamWarning[]): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Send this?",
      `${warnings.map((w) => w.advice).join("\n\n")}\n\nSend it anyway?`,
      [
        { text: "Don't send", style: "cancel", onPress: () => resolve(false) },
        { text: "Send anyway", style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

/**
 * A named scam, under the message that looks like it. Deliberately says what
 * the pattern is rather than accusing the person — plenty of honest people
 * mention a courier.
 */
function ScamWarningNote({ warning }: { warning: ScamWarning }) {
  const theme = useTheme();
  const high = warning.severity === "high";
  const colour = high ? theme.danger : theme.warning;

  return (
    <View
      style={{
        alignSelf: "stretch",
        backgroundColor: theme.card,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderColor: colour,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Feather name="alert-triangle" size={16} color={colour} />
        <Text style={{ color: colour, fontWeight: "800", fontSize: 13, flex: 1 }}>
          {warning.title}
        </Text>
      </View>
      <Text style={{ color: theme.text, fontSize: 13, lineHeight: 19 }}>
        {warning.advice}
      </Text>
    </View>
  );
}

export default function MessagesScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const listingId = Array.isArray(id) ? id[0] : id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = async () => {
    if (!listingId) return;
    try {
      const res = await fetch(`${BASE_URL}/messages/${listingId}`);
      const data = await res.json();
      if (data.ok) setMessages(data.messages ?? []);
    } catch (err) {
      console.log("❌ Load messages error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [listingId]);

  const sendMessage = async () => {
    if (!draft.trim() || !listingId) return;

    const text = draft.trim();

    // Before your own bank details or a code go out, one look at it.
    const risky = checkMessage(text).filter((w) => RISKY_TO_SEND.includes(w.id));
    if (risky.length > 0 && !(await confirmRiskySend(risky))) return;

    setDraft("");
    setSending(true);

    try {
      // The device id is what lets this person review the seller afterwards.
      // It is stored on the message and never sent back out to anyone.
      const deviceId = await getDeviceId();
      const res = await fetch(`${BASE_URL}/messages/${listingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: MY_SENDER_NAME, message: text, deviceId }),
      });
      const data = await res.json();

      if (data.ok) {
        setMessages((prev) => [...prev, data.message]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (err) {
      console.log("❌ Send message error:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.goldSoftGlow,
        }}
      >
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.push("/marketplace"))}
          hitSlop={10}
          style={{ marginRight: 12 }}
        >
          <Feather name="chevron-left" size={24} color={theme.muted} />
        </TouchableOpacity>
        <Text style={{ color: theme.goldDeep, fontSize: 20, fontWeight: "800" }}>
          Message Seller
        </Text>
      </View>

      {/* MESSAGES */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.goldDeep} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <SafetyCard title="Watch out for scams" tips={MESSAGE_SAFETY_TIPS} />

          {messages.length === 0 && (
            <Text style={{ color: theme.muted, textAlign: "center", marginTop: 20 }}>
              No messages yet. Say hello!
            </Text>
          )}

          {messages.map((m, i) => {
            const isMine = m.sender === MY_SENDER_NAME;
            // Only what the other person sends is checked. Warning someone
            // about their own words would just be noise.
            const warnings = isMine ? [] : checkMessage(m.message);

            return (
              <React.Fragment key={i}>
              <View
                style={{
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  backgroundColor: isMine ? theme.goldDeep : theme.card,
                  borderRadius: theme.radius.md,
                  borderWidth: isMine ? 0 : 1,
                  borderColor: theme.goldSoftGlow,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  marginBottom: 10,
                  maxWidth: "80%",
                }}
              >
                {!isMine && (
                  <Text style={{ color: theme.goldDeep, fontWeight: "700", fontSize: 12, marginBottom: 2 }}>
                    {m.sender}
                  </Text>
                )}
                <Text style={{ color: isMine ? theme.black : theme.white }}>{m.message}</Text>
                <Text
                  style={{
                    color: isMine ? "rgba(0,0,0,0.55)" : theme.muted,
                    fontSize: 10,
                    marginTop: 4,
                    textAlign: "right",
                  }}
                >
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>

              {/* Named right under the message it came from. */}
              {warnings.map((warning) => (
                <ScamWarningNote key={`${i}-${warning.id}`} warning={warning} />
              ))}
              </React.Fragment>
            );
          })}
        </ScrollView>
      )}

      {/* COMPOSER */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 12,
          borderTopWidth: 1,
          borderTopColor: theme.goldSoftGlow,
          gap: 10,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message..."
          placeholderTextColor={theme.muted}
          style={{
            flex: 1,
            backgroundColor: theme.card,
            color: theme.white,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
          }}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={sending || !draft.trim()}
          style={{
            backgroundColor: theme.goldDeep,
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: "center",
            alignItems: "center",
            opacity: sending || !draft.trim() ? 0.5 : 1,
          }}
        >
          <Feather name="send" size={18} color={theme.black} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
