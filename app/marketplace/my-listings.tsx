import React, { useEffect, useState } from "react";
import {
  Alert,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Export, ShareNetwork } from "phosphor-react-native";
import { useTheme } from "@/styles/ThemeContext";

import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import { shareListing } from "@/utils/shareListing";
import { exportListingToEbay } from "@/utils/ebayExport";
import { deleteMyListing } from "@/utils/myData";
import { BoostError, boostListing, fetchBoostTerms, relistListing, setReserved } from "@/utils/listingActions";
import { fetchScanAllowance } from "@/lib/credits";
import StatusBadge from "@/components/marketplace/StatusBadge";

type SoldThread = { threadId: string; lastMessage: string };

export default function MyListings() {
  const theme = useTheme();

  const [listings, setListings] = useState<any[]>([]);
  const [exportingId, setExportingId] = useState<string | number | null>(null);
  const [markingId, setMarkingId] = useState<string | number | null>(null);
  // The listing being marked sold, and the conversations to choose the buyer from.
  const [soldFor, setSoldFor] = useState<{ item: any; threads: SoldThread[] } | null>(null);

  const handleEbayExport = async (item: any) => {
    setExportingId(item.id);
    try {
      const result = await exportListingToEbay(item.id);
      if (result.ok) {
        Alert.alert("Exported to eBay", result.ebayUrl ? "Your listing is now live on eBay." : "Your listing is now live on eBay.", result.ebayUrl ? [
          { text: "OK" },
          { text: "View on eBay", onPress: () => Linking.openURL(result.ebayUrl!) },
        ] : undefined);
      } else if (result.error === "not-connected") {
        Alert.alert("Connect eBay first", "Connect your eBay account in Settings, then try exporting again.", [
          { text: "Not now", style: "cancel" },
          { text: "Go to Settings", onPress: () => router.push("/settings") },
        ]);
      } else if (result.error === "selling-locked") {
        Alert.alert("Upgrade to sell", result.message ?? "Selling needs Bolt-on or Pro.", [
          { text: "Not now", style: "cancel" },
          { text: "Upgrade", onPress: () => router.push("/upgrade") },
        ]);
      } else {
        Alert.alert("Couldn't export to eBay", result.message ?? "Please try again.");
      }
    } catch {
      Alert.alert("Couldn't export to eBay", "Please check your connection and try again.");
    } finally {
      setExportingId(null);
    }
  };

  useEffect(() => {
    getDeviceId()
      .then((deviceId) => fetch(`${BASE_URL}/my-listings?deviceId=${encodeURIComponent(deviceId)}`))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setListings(Array.isArray(data) ? data : []))
      .catch(() => setListings([]));
  }, []);

  // Marking it sold is the only thing "items sold" on your seller profile
  // counts, so the number on your profile is one you have earned.
  const markSold = async (item: any, buyerThread?: string) => {
    setMarkingId(item.id);
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(`${BASE_URL}/listings/${item.id}/sold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, buyerThread }),
      });
      const data = await res.json().catch(() => null);

      if (!data?.ok) {
        Alert.alert("Couldn't mark it sold", data?.message ?? data?.error ?? "Please try again.");
        return;
      }

      setListings((prev) =>
        prev.map((l) => (l.id === item.id ? { ...l, soldAt: data.soldAt, status: "sold" } : l))
      );
      if (data.reviewRequested) {
        Alert.alert("Marked as sold", "The buyer has been asked to leave you a review.");
      }
    } catch {
      Alert.alert("Couldn't mark it sold", "Please check your connection and try again.");
    } finally {
      setMarkingId(null);
    }
  };

  // Reserve it, or put it back on sale. A reservation tells buyers somebody has
  // said they'll take it, and lapses by itself after a week if nothing follows.
  const toggleReserved = async (item: any) => {
    const reserve = item.status !== "reserved";
    setMarkingId(item.id);
    try {
      const status = await setReserved(item.id, reserve);
      setListings((prev) => prev.map((l) => (l.id === item.id ? { ...l, status } : l)));
    } catch (err: any) {
      Alert.alert("Couldn't update it", err?.message ?? "Please check your connection and try again.");
    } finally {
      setMarkingId(null);
    }
  };

  // A listing runs for 30 days. Relisting starts another 30, and once the launch
  // offer is over the server may ask for credits, which it explains in its reply.
  const relist = async (item: any) => {
    setMarkingId(item.id);
    try {
      await relistListing(item.id);
      setListings((prev) =>
        prev.map((l) => (l.id === item.id ? { ...l, status: "available", listedAt: new Date().toISOString() } : l))
      );
    } catch (err: any) {
      Alert.alert("Couldn't relist it", err?.message ?? "Please check your connection and try again.");
    } finally {
      setMarkingId(null);
    }
  };

  // A boost puts the listing at the top of the feed, labelled Promoted, for a week. It costs credits, so the
  // price and the balance are shown first and nothing is taken until it is confirmed.
  const boost = async (item: any) => {
    const terms = await fetchBoostTerms();
    if (!terms) {
      Alert.alert("Couldn't check the price", "Please check your connection and try again.");
      return;
    }
    const credits = (await fetchScanAllowance())?.credits ?? 0;
    if (credits < terms.cost) {
      Alert.alert("You need more credits", `A boost costs ${terms.cost} credits and you have ${credits}.`, [
        { text: "Not now", style: "cancel" },
        { text: "Get credits", onPress: () => router.push("/credits") },
      ]);
      return;
    }
    Alert.alert(
      "Boost this listing?",
      `It goes to the top of the feed for ${terms.days} days, labelled "Promoted". It costs ${terms.cost} credits and you have ${credits}. It can't be undone, so if it sells sooner the rest of the boost is not refunded.`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: `Boost (${terms.cost} credits)`,
          onPress: async () => {
            setMarkingId(item.id);
            try {
              const result = await boostListing(item.id);
              setListings((prev) => prev.map((l) => (l.id === item.id ? { ...l, promoted: true, boostedUntil: result.boostedUntil } : l)));
              Alert.alert("Boosted", `It's at the top of the feed until ${new Date(result.boostedUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`);
            } catch (err: any) {
              if (err instanceof BoostError && err.code === "credits-required") {
                Alert.alert("You need more credits", err.message, [
                  { text: "Not now", style: "cancel" },
                  { text: "Get credits", onPress: () => router.push("/credits") },
                ]);
              } else {
                Alert.alert("Couldn't boost it", err?.message ?? "Please check your connection and try again.");
              }
            } finally {
              setMarkingId(null);
            }
          },
        },
      ]
    );
  };

  const confirmDelete = (item: any) =>
    Alert.alert(
      "Delete this listing?",
      "It's removed for everyone, along with its photos and any messages about it. This can't be undone.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMyListing(item.id);
              setListings((prev) => prev.filter((l) => l.id !== item.id));
            } catch (err: any) {
              Alert.alert("Couldn't delete it", err?.message ?? "Please try again.");
            }
          },
        },
      ]
    );

  // Tapping Sold asks who bought it, out of the people who wrote to you. That
  // person is asked for a review and is the only one who can leave one, which
  // is what makes a star rating mean a real sale. No conversations, or sold
  // somewhere else, and it is simply marked sold.
  const confirmSold = async (item: any) => {
    let threads: SoldThread[] = [];
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(`${BASE_URL}/messages/${item.id}`, {
        headers: { "x-device-id": deviceId },
      });
      const data = await res.json();
      if (Array.isArray(data?.threads)) threads = data.threads;
    } catch {
      // Without the list it can still be marked sold, just without a buyer.
    }

    if (threads.length === 0) {
      Alert.alert(
        "Mark as sold?",
        "It will show as sold, and count towards the items sold on your seller profile.",
        [
          { text: "Not yet", style: "cancel" },
          { text: "Sold", onPress: () => markSold(item) },
        ]
      );
      return;
    }

    setSoldFor({ item, threads });
  };

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <Text
        style={{
          color: theme.goldDeep,
          fontSize: 28,
          fontWeight: "900",
          marginBottom: 16,
        }}
      >
        Your Listings
      </Text>

      {listings.length === 0 && (
        <Text style={{ color: theme.text }}>You have no active listings.</Text>
      )}

      {listings.map((item) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => router.push(`/marketplace/${item.id}`)}
          style={{
            backgroundColor: theme.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
            marginBottom: 20,
            overflow: "hidden",
          }}
        >
          {item.photos?.[0] && (
            <Image
              source={{ uri: item.photos[0] }}
              style={{ width: "100%", height: 160 }}
            />
          )}
          <View style={{ padding: 14, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.goldDeep,
                  fontSize: 20,
                  fontWeight: "700",
                }}
              >
                {item.title ?? (`${item.vehicle?.make ?? ""} ${item.vehicle?.model ?? ""}`.trim() || "Untitled listing")}
              </Text>
              <Text style={{ color: theme.text, marginTop: 4 }}>
                £{item.price}
              </Text>

              <View style={{ marginTop: 8 }}>
                <StatusBadge status={item.status ?? (item.soldAt ? "sold" : null)} long />
              </View>
              {item.promoted && item.boostedUntil ? (
                <Text style={{ color: theme.goldDeep, fontSize: 12, fontWeight: "700", marginTop: 6 }}>
                  Promoted until {new Date(item.boostedUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </Text>
              ) : null}

              {/* Expired: just Relist. Sold is final, so none. */}
              {item.status === "expired" && !item.soldAt ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Relist this listing for another 30 days"
                    disabled={markingId === item.id}
                    onPress={(e) => {
                      e.stopPropagation();
                      relist(item);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: theme.goldDeep,
                      opacity: markingId === item.id ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: theme.goldDeep, fontWeight: "700", fontSize: 13 }}>
                      {markingId === item.id ? "Working…" : "Relist"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : item.soldAt || item.status === "sold" ? null : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {!item.promoted ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Boost this listing to the top of the feed"
                      disabled={markingId === item.id}
                      onPress={(e) => {
                        e.stopPropagation();
                        boost(item);
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: theme.goldDeep,
                        opacity: markingId === item.id ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ color: theme.black, fontWeight: "800", fontSize: 13 }}>Boost</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={
                      item.status === "reserved" ? "Put this listing back on sale" : "Reserve this listing"
                    }
                    disabled={markingId === item.id}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleReserved(item);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: theme.warning,
                      opacity: markingId === item.id ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: theme.warning, fontWeight: "700", fontSize: 13 }}>
                      {item.status === "reserved" ? "Put back on sale" : "Reserve"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Mark this listing as sold"
                    disabled={markingId === item.id}
                    onPress={(e) => {
                      e.stopPropagation();
                      confirmSold(item);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: theme.goldDeep,
                      opacity: markingId === item.id ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: theme.goldDeep, fontWeight: "700", fontSize: 13 }}>
                      {markingId === item.id ? "Working…" : "Sold"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Delete this listing"
                onPress={(e) => {
                  e.stopPropagation();
                  confirmDelete(item);
                }}
                style={{ alignSelf: "flex-start", marginTop: 12 }}
              >
                <Text style={{ color: theme.danger, fontWeight: "700", fontSize: 13 }}>
                  Delete listing
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Export this listing to eBay"
              disabled={exportingId === item.id}
              onPress={(e) => {
                e.stopPropagation();
                handleEbayExport(item);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.black,
                borderWidth: 1,
                borderColor: theme.goldSoftGlow,
                marginRight: 10,
                opacity: exportingId === item.id ? 0.6 : 1,
              }}
            >
              {exportingId === item.id ? (
                <ActivityIndicator size="small" color={theme.goldDeep} />
              ) : (
                <Export size={20} color={theme.goldDeep} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Share this listing to other platforms"
              onPress={(e) => {
                e.stopPropagation();
                shareListing({
                  title: item.title ?? "Untitled listing",
                  price: item.price,
                  description: item.description,
                  location: item.location,
                });
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.black,
                borderWidth: 1,
                borderColor: theme.goldSoftGlow,
              }}
            >
              <ShareNetwork size={20} color={theme.goldDeep} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>

      {/* WHO BOUGHT IT? */}
      <Modal
        visible={soldFor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSoldFor(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
          onPress={() => setSoldFor(null)}
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
              maxHeight: "80%",
            }}
          >
            <Text style={{ color: theme.goldDeep, fontSize: 20, fontWeight: "800", marginBottom: 4 }}>
              Who bought it?
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 14 }}>
              They'll be asked to leave you a review, and they're the only one who can.
            </Text>

            <ScrollView>
              {soldFor?.threads.map((t) => (
                <TouchableOpacity
                  key={t.threadId}
                  accessibilityRole="button"
                  onPress={() => {
                    const pick = soldFor;
                    setSoldFor(null);
                    if (pick) markSold(pick.item, t.threadId);
                  }}
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.goldSoftGlow,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: "700" }}>
                    Buyer #{t.threadId.slice(-4)}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
                    {t.lastMessage}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  const pick = soldFor;
                  setSoldFor(null);
                  if (pick) markSold(pick.item);
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.muted,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: theme.text, fontWeight: "700" }}>Sold outside FlipPilot</Text>
                <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>
                  No review can be left for this one.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setSoldFor(null)} style={{ alignItems: "center", paddingTop: 10 }}>
                <Text style={{ color: theme.muted, fontWeight: "700" }}>Not yet</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
