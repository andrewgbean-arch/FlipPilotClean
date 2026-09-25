import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/styles/ThemeContext";
import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import StatusBadge from "@/components/marketplace/StatusBadge";
import { useMessageAlerts } from "@/context/MessageAlertsContext";
import { markShown, useRotated } from "@/lib/adRotation";
import { reportAdvertEvent, useAdverts, type FeedAdverts } from "@/lib/adverts";
import { HOUSE_ADVERTS } from "@/lib/houseAdverts";
import SponsoredCard from "@/components/marketplace/SponsoredCard";
import { removeSponsor, useSavedSponsors } from "@/lib/savedSponsors";

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
  /** The other side has written since you last opened this chat. */
  unread?: boolean;
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
            {item.unread ? (
              <View
                accessibilityLabel="Unread"
                style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.danger }}
              />
            ) : null}
            <Text style={{ color: theme.goldDeep, fontWeight: "800", fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          <Text style={{ color: theme.muted, fontSize: 11 }}>{when(item.lastAt)}</Text>
        </View>

        <Text style={{ color: theme.muted, fontSize: 12, marginTop: 1 }}>
          {item.role === "seller"
            ? `Selling · Buyer #${(item.threadId ?? "").slice(-4)}`
            : "Buying"}
        </Text>

        <Text
          style={{ color: theme.text, fontSize: 14, marginTop: 4, fontWeight: item.unread ? "700" : "400" }}
          numberOfLines={2}
        >
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

const NO_BANNER: FeedAdverts = { adverts: [] };

/**
 * The banner at the top of the inbox: one advertiser at a time, the one this phone saw longest ago,
 * so every visit brings a different one until each has had a turn. When nobody has booked it, one of
 * FlipPilot's own promos takes the place. Only its buttons open anything.
 */
function MessagesBanner() {
  const data = useAdverts<FeedAdverts>("messages", NO_BANNER);
  const paid = useRotated(data.adverts);
  const house = useRotated(HOUSE_ADVERTS);
  // Chosen once per visit, so the banner never swaps while you read.
  const chosen = React.useRef<string | null>(null);

  // Nothing back from the server yet, or the lists aren't sorted yet.
  if (data === NO_BANNER) return null;
  if ((data.adverts.length > 0 && paid.length === 0) || house.length === 0) return null;

  const advert = chosen.current
    ? [...paid, ...house].find((a) => a.id === chosen.current)
    : paid[0] ?? house[0];
  if (!advert) return null;
  if (!chosen.current) chosen.current = advert.id;

  return <BannerCard advert={advert} />;
}

function BannerCard({ advert }: { advert: import("@/lib/businessAdverts").BusinessAdvert }) {
  // It is on screen the moment the inbox opens, so this is when it counts as seen.
  React.useEffect(() => {
    markShown(advert.id);
    if (!advert.house) reportAdvertEvent(advert.id, "view", 30);
  }, [advert.id]);
  return (
    <View style={{ marginBottom: 6 }}>
      <SponsoredCard advert={advert} />
    </View>
  );
}

/**
 * Sponsors kept from an advert with Save, so they can be looked at now without
 * having interrupted a scan. Only on this phone; shown above the conversations.
 */
function SavedSponsors({ theme }: { theme: any }) {
  const saved = useSavedSponsors();
  if (saved.length === 0) return null;

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: "800" }}>Saved sponsors</Text>
      <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2, marginBottom: 10 }}>
        Kept on this phone so you can look whenever suits you.
      </Text>
      {saved.map((s) => (
        <View
          key={s.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: theme.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.goldDeep,
            padding: 10,
            marginBottom: 8,
          }}
        >
          <Image source={{ uri: s.image }} style={{ width: 48, height: 48, borderRadius: 10 }} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.goldDeep, fontWeight: "800", fontSize: 14 }} numberOfLines={1}>
              {s.title}
            </Text>
            {s.tagline ?? s.description ? (
              <Text style={{ color: theme.muted, fontSize: 12 }} numberOfLines={1}>
                {s.tagline ?? s.description}
              </Text>
            ) : null}
            <Text style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>SPONSORED</Text>
          </View>
          {s.website ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Visit ${s.title}`}
              onPress={() => {
                reportAdvertEvent(s.id, "click");
                Linking.openURL(s.website!).catch(() => {});
              }}
              style={{ backgroundColor: theme.goldDeep, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 }}
            >
              <Text style={{ color: theme.black, fontWeight: "800", fontSize: 13 }}>Visit</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Remove ${s.title} from saved sponsors`}
            hitSlop={8}
            onPress={() => removeSponsor(s.id)}
          >
            <Feather name="x" size={18} color={theme.muted} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

/** Every conversation, as buyer and as seller, newest first. */
export default function MessagesInbox() {
  const theme = useTheme();
  const { refresh: refreshAlerts } = useMessageAlerts();
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
            // Loading the inbox is what tells the server it has been seen, so
            // ask again now and let Home stop flashing.
            refreshAlerts();
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
    }, [refreshAlerts])
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={items}
      keyExtractor={(c) => `${c.listingId}:${c.threadId ?? "buyer"}`}
      renderItem={({ item }) => <Row item={item} theme={theme} />}
      ListHeaderComponent={
        <View>
          <MessagesBanner />
          <SavedSponsors theme={theme} />
        </View>
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
