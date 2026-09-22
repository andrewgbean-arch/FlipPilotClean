import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { router } from "expo-router";
import { ShareNetwork } from "phosphor-react-native";
import { useTheme } from "@/styles/ThemeContext";

import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import { shareListing } from "@/utils/shareListing";

export default function MyListings() {
  const theme = useTheme();

  const [listings, setListings] = useState<any[]>([]);

  useEffect(() => {
    getDeviceId()
      .then((deviceId) => fetch(`${BASE_URL}/my-listings?deviceId=${encodeURIComponent(deviceId)}`))
      .then((res) => res.json())
      .then((data) => setListings(data || []))
      .catch(() => setListings([]));
  }, []);

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
            </View>

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
