import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/styles/ThemeContext";
import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import StatusBadge from "@/components/marketplace/StatusBadge";

type Conversation = {
  listingId: number | string;
  title: string;
  thumbnail: string | null;
  status: string;
  role: "buyer" | "seller";
  threadId: string | null;
  lastMessage: string;
  lastFrom: "me" | "them";
  lastAt: string;
  count: number;
};

function when(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const sameDay = t.toDateString() === new Date().toDateString();
  return sameDay
    ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : t.toLocaleDateString([], { day: "numeric", month: "short" });
}

const Row = React.memo(function Row({ item, theme }: { item: Conversation; theme: any }) {
  const open = () =>
    router.push(
      item.threadId
        ? `/messages/${item.listingId}?thread=${encodeURIComponent(item.threadId)}`
        : `/messages/${item.listingId}`
    );

  return (
    <TouchableOpacity
      onPress={open}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        gap: 12,
        backgroundColor: theme.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        padding: 12,
        marginBottom: 10,
      }}
    >
      {item.thumbnail ? (
        <Image
          source={{ uri: item.thumbnail }}
          style={{ width: 56, height: 56, borderRadius: 10 }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            backgroundColor: theme.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="image" size={20} color={theme.muted} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: theme.goldDeep, fontWeight: "800", fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 11 }}>{when(item.lastAt)}</Text>
        </View>

        <Text style={{ color: theme.muted, fontSize: 12, marginTop: 1 }}>
          {item.role === "seller"
            ? `Selling · Buyer #${(item.threadId ?? "").slice(-4)}`
            : "Buying"}
        </Text>

        <Text style={{ color: theme.text, fontSize: 14, marginTop: 4 }} numberOfLines={2}>
          {item.lastFrom === "me" ? "You: " : ""}
          {item.lastMessage}
        </Text>

        {item.status === "reserved" || item.status === "sold" ? (
          <View style={{ marginTop: 6 }}>
            <StatusBadge status={item.status} />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

/** Every conversation, as buyer and as seller, newest first. */
export default function MessagesInbox() {
  const theme = useTheme();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Reloaded every time you come back to it, so a reply shows without a restart.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const deviceId = await getDeviceId();
          const res = await fetch(`${BASE_URL}/me/conversations`, {
            headers: { "x-device-id": deviceId },
          });
          const data = await res.json();
          if (!active) return;
          if (data?.ok) {
            setItems(data.conversations ?? []);
            setFailed(false);
          } else {
            setFailed(true);
          }
        } catch {
          if (active) setFailed(true);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={items}
      keyExtractor={(c) => `${c.listingId}:${c.threadId ?? "buyer"}`}
      renderItem={({ item }) => <Row item={item} theme={theme} />}
      ListHeaderComponent={
        <Text style={{ color: theme.goldDeep, fontSize: 28, fontWeight: "900", marginBottom: 14 }}>
          Messages
        </Text>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator size="large" color={theme.goldDeep} style={{ marginTop: 30 }} />
        ) : (
          <Text style={{ color: theme.muted, textAlign: "center", marginTop: 30 }}>
            {failed
              ? "Couldn't load your messages. Check your connection and try again."
              : "No messages yet. When you message a seller, or a buyer writes to you, it appears here."}
          </Text>
        )
      }
      initialNumToRender={8}
      windowSize={7}
    />
  );
}
