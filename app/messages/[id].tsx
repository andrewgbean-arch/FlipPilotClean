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
import ReportSheet from "@/components/marketplace/ReportSheet";
import ReviewSheet from "@/components/marketplace/ReviewSheet";
import { getReviewStatus, type ReviewStatus } from "@/utils/reviewStatus";

type ChatMessage = {
  from: "me" | "them";
  sender: string;
  message: string;
  timestamp: string;
  // Set on FlipPilot's own "please leave a review" note to the buyer.
  kind?: "review-request";
};

type Thread = {
  threadId: string;
  lastMessage: string;
  lastFrom: "me" | "them";
  lastAt: string;
  count: number;
};

const REFRESH_MS = 8000;

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
  const { id, thread } = useLocalSearchParams<{ id?: string | string[]; thread?: string | string[] }>();
  const listingId = Array.isArray(id) ? id[0] : id;
  // Opened from the inbox, a seller lands straight in that buyer's conversation.
  const initialThread = Array.isArray(thread) ? thread[0] : thread;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  // The seller sees one conversation per buyer; a buyer only ever has one.
  const [role, setRole] = useState<"buyer" | "seller" | null>(null);
  const [activeThread, setActiveThread] = useState<string | null>(initialThread ?? null);
  const [blocked, setBlocked] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = async () => {
    if (!listingId) return;
    try {
      // Who you are is your device id; the server decides what you may read.
      const deviceId = await getDeviceId();
      const query = activeThread ? `?thread=${encodeURIComponent(activeThread)}` : "";
      const res = await fetch(`${BASE_URL}/messages/${listingId}${query}`, {
        headers: { "x-device-id": deviceId },
      });
      const data = await res.json();
      if (!data.ok) return;

      setRole(data.role);
      setBlocked(Boolean(data.blocked));
      if (data.threads) setThreads(data.threads);
      if (data.messages) setMessages(data.messages);
    } catch (err) {
      console.log("❌ Load messages error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadMessages();
    // A reply has to turn up without leaving and coming back.
    const timer = setInterval(loadMessages, REFRESH_MS);
    return () => clearInterval(timer);
  }, [listingId, activeThread]);

  const inInbox = role === "seller" && !activeThread;

  // Once the seller has marked it sold to this buyer, FlipPilot leaves a note in
  // the chat asking for a review. Ask the server whether this person may still
  // leave one, so the button only shows when it will work.
  const hasReviewRequest = role === "buyer" && messages.some((m) => m.kind === "review-request");
  useEffect(() => {
    if (!hasReviewRequest || !listingId) return;
    getReviewStatus(listingId).then(setReviewStatus);
  }, [hasReviewRequest, listingId]);

  const sendMessage = async () => {
    if (!draft.trim() || !listingId) return;

    const text = draft.trim();

    // Before your own bank details or a code go out, one look at it.
    const risky = checkMessage(text).filter((w) => RISKY_TO_SEND.includes(w.id));
    if (risky.length > 0 && !(await confirmRiskySend(risky))) return;

    setDraft("");
    setSending(true);

    try {
      // The device id is how the server knows who is talking, and what lets a
      // buyer review the seller afterwards. It is never sent back out.
      const deviceId = await getDeviceId();
      const res = await fetch(`${BASE_URL}/messages/${listingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ message: text, thread: activeThread ?? undefined }),
      });
      const data = await res.json().catch(() => null);

      if (data?.ok) {
        setMessages((prev) => [...prev, data.message]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        setDraft(text);
        Alert.alert("Couldn't send", data?.error ?? "Please try again.");
      }
    } catch (err) {
      setDraft(text);
      Alert.alert("Couldn't send", "Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const setBlock = async (block: boolean) => {
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(`${BASE_URL}/safety/${block ? "block" : "unblock"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ listingId, thread: activeThread ?? undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        Alert.alert("Couldn't do that", data?.error ?? "Please try again.");
        return;
      }
      setBlocked(block);
    } catch {
      Alert.alert("Couldn't do that", "Please check your connection and try again.");
    }
  };

  const openMenu = () =>
    Alert.alert(
      "This conversation",
      blocked ? "You have blocked this person." : undefined,
      [
        { text: "Report", onPress: () => setReporting(true) },
        blocked
          ? { text: "Unblock", onPress: () => setBlock(false) }
          : {
              text: "Block",
              style: "destructive",
              onPress: () =>
                Alert.alert(
                  "Block this person?",
                  "They won't be able to message you about this listing, and you won't be able to message them.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Block", style: "destructive", onPress: () => setBlock(true) },
                  ]
                ),
            },
        { text: "Cancel", style: "cancel" },
      ]
    );

  const goBack = () => {
    if (role === "seller" && activeThread) {
      setActiveThread(null);
      setMessages([]);
      return;
    }
    router.canGoBack() ? router.back() : router.push("/marketplace");
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
        <TouchableOpacity onPress={goBack} hitSlop={10} style={{ marginRight: 12 }}>
          <Feather name="chevron-left" size={24} color={theme.muted} />
        </TouchableOpacity>
        <Text style={{ color: theme.goldDeep, fontSize: 20, fontWeight: "800", flex: 1 }}>
          {role === "seller" ? (inInbox ? "Your messages" : "Buyer") : "Message Seller"}
        </Text>
        {!inInbox && (
          <TouchableOpacity
            onPress={openMenu}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Report or block"
          >
            <Feather name="more-vertical" size={22} color={theme.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* MESSAGES */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.goldDeep} />
        </View>
      ) : inInbox ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {threads.length === 0 && (
            <Text style={{ color: theme.muted, textAlign: "center", marginTop: 20 }}>
              No messages yet. When a buyer writes to you, it will appear here.
            </Text>
          )}
          {threads.map((t) => (
            <TouchableOpacity
              key={t.threadId}
              onPress={() => {
                setMessages([]);
                setActiveThread(t.threadId);
              }}
              accessibilityRole="button"
              style={{
                backgroundColor: theme.card,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.goldSoftGlow,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.goldDeep, fontWeight: "700" }}>
                  Buyer #{t.threadId.slice(-4)}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 11 }}>
                  {new Date(t.lastAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={{ color: theme.text, marginTop: 4 }} numberOfLines={2}>
                {t.lastFrom === "me" ? "You: " : ""}
                {t.lastMessage}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
            const isMine = m.from === "me";
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

              {m.kind === "review-request" && reviewStatus?.canReview ? (
                <TouchableOpacity
                  onPress={() => setReviewing(true)}
                  accessibilityRole="button"
                  style={{
                    alignSelf: "flex-start",
                    backgroundColor: theme.goldDeep,
                    borderRadius: theme.radius.full,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: theme.black, fontWeight: "800" }}>Leave a review</Text>
                </TouchableOpacity>
              ) : null}

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
      {!inInbox && blocked && (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: theme.goldSoftGlow }}>
          <Text style={{ color: theme.muted, textAlign: "center", fontSize: 13 }}>
            You have blocked this person. Use the menu at the top to unblock them.
          </Text>
        </View>
      )}
      {!inInbox && !blocked && (
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
      )}

      {reviewStatus?.sellerId && listingId ? (
        <ReviewSheet
          visible={reviewing}
          onClose={() => setReviewing(false)}
          onDone={() => setReviewStatus({ ...reviewStatus, canReview: false, alreadyReviewed: true })}
          sellerId={reviewStatus.sellerId}
          listingId={listingId}
        />
      ) : null}

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        listingId={listingId ?? ""}
        thread={activeThread}
      />
    </KeyboardAvoidingView>
  );
}
