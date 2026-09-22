import React, { useEffect, useState } from "react";
import { Alert, View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Linking } from "react-native";
import { router } from "expo-router";
import { Export, ShareNetwork } from "phosphor-react-native";
import { useTheme } from "@/styles/ThemeContext";

import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import { shareListing } from "@/utils/shareListing";
import { exportListingToEbay } from "@/utils/ebayExport";

export default function MyListings() {
  const theme = useTheme();

  const [listings, setListings] = useState<any[]>([]);
  const [exportingId, setExportingId] = useState<string | number | null>(null);
  const [markingId, setMarkingId] = useState<string | number | null>(null);

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
      .then((res) => res.json())
      .then((data) => setListings(data || []))
      .catch(() => setListings([]));
  }, []);

  // Marking it sold is the only thing "items sold" on your seller profile
  // counts, so the number on your profile is one you have earned.
  const markSold = async (item: any) => {
    setMarkingId(item.id);
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(`${BASE_URL}/listings/${item.id}/sold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json().catch(() => null);

      if (!data?.ok) {
        Alert.alert("Couldn't mark it sold", data?.error ?? "Please try again.");
        return;
      }

      setListings((prev) =>
        prev.map((l) => (l.id === item.id ? { ...l, soldAt: data.soldAt } : l))
      );
    } catch {
      Alert.alert("Couldn't mark it sold", "Please check your connection and try again.");
    } finally {
      setMarkingId(null);
    }
  };

  const confirmSold = (item: any) =>
    Alert.alert(
      "Mark as sold?",
      "It will show as sold, and count towards the items sold on your seller profile.",
      [
        { text: "Not yet", style: "cancel" },
        { text: "Sold", onPress: () => markSold(item) },
      ]
    );

  return (
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

              {item.soldAt ? (
                <Text style={{ color: theme.success, marginTop: 6, fontWeight: "700" }}>
                  Sold
                </Text>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Mark this listing as sold"
                  disabled={markingId === item.id}
                  onPress={(e) => {
                    e.stopPropagation();
                    confirmSold(item);
                  }}
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: theme.goldDeep,
                    opacity: markingId === item.id ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: theme.goldDeep, fontWeight: "700", fontSize: 13 }}>
                    {markingId === item.id ? "Marking…" : "Mark as sold"}
                  </Text>
                </TouchableOpacity>
              )}
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
  );
}
