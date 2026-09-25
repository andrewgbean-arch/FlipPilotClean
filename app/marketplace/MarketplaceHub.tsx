import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/styles/ThemeContext";

import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import PartnerLinks from "@/components/marketplace/PartnerLinks";
import GoldParticles from "@/components/ui/GoldParticles";
import { MARKETPLACE_CATEGORIES } from "@/constants/marketplaceCategories";

export default function MarketplaceHub() {
  const theme = useTheme();

  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDeviceId()
      .then((deviceId) =>
        fetch(`${BASE_URL}/published-listings`, { headers: { "x-device-id": deviceId } })
      )
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const listings = Array.isArray(data) ? data : [];
        // Newest first, and only what is still for sale. Ranking by a "deal score"
        // would mean using eBay-derived pricing inside the marketplace.
        const newest = listings
          .filter((l: any) => !l.soldAt)
          .sort((a: any, b: any) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
          .slice(0, 5);
        setTrending(newest);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.black }}>
      <GoldParticles theme={{ goldDeep: theme.goldDeep }} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
      {/* HERO */}
      <View style={{ padding: 20, alignItems: "center" }}>
        <Text style={{ color: theme.text, fontSize: 14 }}>
          Buy and sell with people nearby
        </Text>
      </View>

      {/* ACTION BUTTONS */}
      <View style={{ paddingHorizontal: 20 }}>
        {/* Sell something */}
        <Pressable
          style={{
            backgroundColor: theme.accent,
            padding: 14,
            borderRadius: 14,
            marginBottom: 14,
          }}
          onPress={() => router.push("/marketplace/create/new")}
        >
          <Text style={{ color: theme.black, fontSize: 16, fontWeight: "700" }}>
            📤 Sell something
          </Text>
        </Pressable>

        {/* Every conversation, as buyer and as seller */}
        <Pressable
          accessibilityRole="button"
          style={{
            backgroundColor: theme.card,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.goldDeep,
            marginBottom: 14,
          }}
          onPress={() => router.push("/messages")}
        >
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
            💬 Messages
          </Text>
        </Pressable>

        {/* Your own listings: reserve, mark sold, relist, delete */}
        <Pressable
          accessibilityRole="button"
          style={{
            backgroundColor: theme.card,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.goldDeep,
            marginBottom: 14,
          }}
          onPress={() => router.push("/marketplace/my-listings")}
        >
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
            🏷️ My listings
          </Text>
        </Pressable>

        {/* Public: Browse Listings */}
        <Pressable
          style={{
            backgroundColor: theme.card,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.goldDeep,
            marginBottom: 20,
          }}
          onPress={() => router.push("/marketplace/Listings")}
        >
          <Text style={{ color: theme.goldDeep, fontSize: 16, fontWeight: "700" }}>
            📄 Browse Listings
          </Text>
        </Pressable>
      </View>

      {/* CATEGORIES */}
      <View style={{ paddingHorizontal: 20 }}>
        <Text
          style={{
            color: theme.goldDeep,
            fontSize: 20,
            fontWeight: "700",
            marginBottom: 12,
          }}
        >
          Categories
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {MARKETPLACE_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              style={{
                width: "48%",
                backgroundColor: theme.card,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: theme.goldDeep,
                marginBottom: 14,
                alignItems: "center",
              }}
              onPress={() =>
                router.push(`/marketplace/Listings?category=${cat.id}`)
              }
            >
              <Feather name={cat.icon as any} size={26} color={theme.text} />
              <Text
                style={{
                  color: theme.text,
                  marginTop: 6,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* TRENDING */}
      <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
        <Text
          style={{
            color: theme.goldDeep,
            fontSize: 20,
            fontWeight: "700",
            marginBottom: 12,
          }}
        >
          Just listed
        </Text>

        {loading && (
          <ActivityIndicator size="large" color={theme.accent} />
        )}

        {!loading && trending.length === 0 && (
          <Text style={{ color: theme.text }}>Nothing listed yet.</Text>
        )}

        {!loading &&
          trending.map((listing) => (
            <TouchableOpacity
              key={listing.id}
              onPress={() => router.push(`/marketplace/${listing.id}`)}
              style={{
                backgroundColor: theme.card,
                padding: 16,
                borderRadius: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: theme.goldDeep,
              }}
            >
              <Text
                style={{
                  color: theme.goldDeep,
                  fontSize: 18,
                  fontWeight: "bold",
                }}
                numberOfLines={1}
              >
                {listing.title ?? (`${listing.vehicle?.make ?? ""} ${listing.vehicle?.model ?? ""}`.trim() || "Untitled listing")}
              </Text>

              <Text style={{ color: theme.text, marginTop: 4 }}>
                £{listing.price}
                {listing.mileage != null ? ` • ${listing.mileage} miles` : ""}
                {listing.vehicle?.mileage != null ? ` • ${listing.vehicle.mileage} miles` : ""}
              </Text>
            </TouchableOpacity>
          ))}

        {/* FLIPPILOT'S OWN: dealers, and businesses that want to advertise */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <PartnerLinks />
        </View>

        {/* SAVED SEARCHES */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Text
            style={{
              color: theme.goldDeep,
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 12,
            }}
          >
            Saved Searches
          </Text>

          <Text style={{ color: theme.text, fontSize: 14 }}>
            You haven’t saved any searches yet.
          </Text>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}
