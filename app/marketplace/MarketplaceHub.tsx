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

// ⭐ Unified Dealer Mode
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { BASE_URL } from "@/utils/api";
import { findBestDeals } from "@/utils/dealFinder";
import GoldParticles from "@/components/ui/GoldParticles";

export default function MarketplaceHub() {
  const theme = useTheme();

  // ⭐ Dealer Mode
  const { dealerMode, setDealerMode, setFlashTrigger, vehicles } =
    useVehicleHistory();

  // ⭐ Auto‑activate Dealer Mode when vehicles exist
  useEffect(() => {
    if (!dealerMode && vehicles.length > 0) {
      setDealerMode(true);
      setFlashTrigger(Date.now());
    }
  }, [dealerMode, vehicles]);

  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/published-listings`)
      .then((res) => res.json())
      .then((data) => {
        const listings = data || [];
        // Rank by deal strength (price vs score vs mileage) instead of showing raw insertion order
        const ranked = findBestDeals(
          listings.map((l: any) => ({ ...l, score: l.flipScore ?? l.score ?? 0 }))
        );
        setTrending(ranked);
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
        <Text style={{ color: theme.goldDeep, fontSize: 28, fontWeight: "900" }}>
          Marketplace
        </Text>
        <Text style={{ color: theme.text, fontSize: 14, marginTop: 4 }}>
          Discover deals, trends & listings
        </Text>
      </View>

      {/* ACTION BUTTONS */}
      <View style={{ paddingHorizontal: 20 }}>
        {/* Publish Flip */}
        <Pressable
          style={{
            backgroundColor: theme.accent,
            padding: 14,
            borderRadius: 14,
            marginBottom: 14,
          }}
          onPress={() => router.push("/marketplace/PublishFlip")}
        >
          <Text style={{ color: theme.black, fontSize: 16, fontWeight: "700" }}>
            📤 Publish a Flip
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
          {[
            { icon: "cpu", label: "Electronics" },
            { icon: "tool", label: "Tools" },
            { icon: "book", label: "Books" },
            { icon: "image", label: "Collectibles" },
            { icon: "shopping-bag", label: "General" },
            { icon: "truck", label: "Motors" },
          ].map((cat, idx) => (
            <Pressable
              key={idx}
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
                router.push(`/marketplace/Listings?category=${cat.label}`)
              }
            >
              <Feather name={cat.icon as any} size={26} color={theme.text} />
              <Text
                style={{
                  color: theme.text,
                  marginTop: 6,
                  fontWeight: "700",
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
          Trending Now
        </Text>

        {loading && (
          <ActivityIndicator size="large" color={theme.accent} />
        )}

        {!loading && trending.length === 0 && (
          <Text style={{ color: theme.text }}>No trending listings.</Text>
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
