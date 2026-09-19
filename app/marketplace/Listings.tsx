import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/styles/ThemeContext";

import { BASE_URL } from "@/utils/api";

const CATEGORIES = [
  "All",
  "Motors",
  "Electronics",
  "Tools",
  "Books",
  "Collectibles",
  "General",
];

export default function Listings() {
  const theme = useTheme();

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    fetch(`${BASE_URL}/published-listings`)
      .then((res) => res.json())
      .then((data) => {
        setListings(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return (listings || [])
      .filter((item) => {
        if (!search.trim()) return true;
        const text = `${item.title ?? ""} ${item.vehicle?.make ?? ""} ${item.vehicle?.model ?? ""}`.toLowerCase();
        return text.includes(search.toLowerCase().trim());
      })
      .filter((item) => {
        if (category === "All") return true;
        const cat = item.category ?? "General";
        return cat.toLowerCase() === category.toLowerCase();
      });
  }, [listings, search, category]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      {/* HEADER */}
      <Text
        style={{
          color: theme.goldDeep,
          fontSize: 30,
          fontWeight: "900",
          marginBottom: 6,
        }}
      >
        Listings
      </Text>
      <Text style={{ color: theme.text, marginBottom: 16 }}>
        Browse all public marketplace listings
      </Text>

      {/* SEARCH */}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by make, model, year..."
        placeholderTextColor={theme.muted}
        style={{
          backgroundColor: theme.card,
          color: theme.white,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.goldDeep,
          marginBottom: 12,
        }}
      />

      {/* CATEGORY FILTERS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 16 }}
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.goldDeep,
                backgroundColor: active ? theme.goldDeep : theme.card,
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  color: active ? theme.black : theme.white,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && (
        <ActivityIndicator size="large" color={theme.goldDeep} />
      )}

      {!loading && filtered.length === 0 && (
        <Text style={{ color: theme.text, marginTop: 20 }}>
          No listings match your filters.
        </Text>
      )}

      {!loading &&
        filtered.map((item, index) => {
          const thumbnail =
            item.photos?.[0] ||
            "https://placehold.co/300x200/0A1128/FFFFFF?text=FlipPilot";

          const flipScore = item.flipScore ?? item.ai?.flipScore ?? null;
          const isSponsored = item.sponsored === true || index === 0;

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => router.push(`/marketplace/${item.id}`)}
              style={cardStyle(theme, isSponsored)}
            >
              <Image source={{ uri: thumbnail }} style={imageStyle} />

              <View style={{ padding: 14 }}>
                {/* TITLE ROW */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <Text style={titleStyle(theme)}>
                    {item.title ?? (`${item.vehicle?.make ?? ""} ${item.vehicle?.model ?? ""}`.trim() || "Untitled listing")}
                  </Text>

                  {isSponsored && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                        backgroundColor: theme.goldDeep,
                      }}
                    >
                      <Text
                        style={{
                          color: theme.black,
                          fontSize: 10,
                          fontWeight: "700",
                        }}
                      >
                        Sponsored
                      </Text>
                    </View>
                  )}
                </View>

                {/* PRICE + META */}
                <Text style={priceStyle(theme)}>£{item.price}</Text>
                <Text style={metaStyle(theme)}>
                  {item.category ?? "General"}
                  {item.mileage != null ? ` • ${item.mileage} miles` : ""}
                  {item.location ? ` • ${item.location}` : ""}
                </Text>

                {/* FLIPSCORE BADGE */}
                {flipScore != null && (
                  <View
                    style={{
                      marginTop: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor:
                          flipScore >= 80
                            ? theme.goldDeep
                            : flipScore >= 60
                            ? "#FFD966"
                            : "#FF6666",
                      }}
                    >
                      <Text
                        style={{
                          color: flipScore >= 60 ? theme.black : theme.white,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        {flipScore}/100
                      </Text>
                    </View>
                    <Text style={{ color: theme.muted, fontSize: 12 }}>
                      FlipScore
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
    </ScrollView>
  );
}

const cardStyle = (theme: any, sponsored: boolean) => ({
  backgroundColor: theme.card,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: sponsored ? theme.goldDeep : theme.goldSoftGlow,
  marginBottom: 20,
  overflow: "hidden" as const,
  shadowColor: sponsored ? theme.goldDeep : "#000",
  shadowOpacity: sponsored ? 0.35 : 0.2,
  shadowRadius: sponsored ? 12 : 8,
  shadowOffset: { width: 0, height: 4 },
});

const imageStyle = {
  width: "100%" as const,
  height: 180,
};

const titleStyle = (theme: any) => ({
  color: theme.goldDeep,
  fontSize: 20,
  fontWeight: "700" as const,
});

const priceStyle = (theme: any) => ({
  color: theme.text,
  fontSize: 18,
  marginTop: 4,
});

const metaStyle = (theme: any) => ({
  color: theme.muted,
  fontSize: 14,
  marginTop: 2,
});
