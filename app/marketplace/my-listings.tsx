import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/styles/ThemeContext";

import { BASE_URL } from "@/utils/api";

export default function MyListings() {
  const theme = useTheme();

  const [listings, setListings] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${BASE_URL}/my-listings`)
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
          <View style={{ padding: 14 }}>
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
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
