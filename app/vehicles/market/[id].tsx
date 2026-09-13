import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/styles/ThemeContext";

// --- MOCK MARKET ENGINE (replace with backend later) ---
function generateMarketData(vehicle: any) {
  const base = vehicle.valuation ?? 3000;
  const label = vehicle.mot?.make && vehicle.mot?.model
    ? `${vehicle.mot.make} ${vehicle.mot.model}`
    : vehicle.title ?? "This vehicle";

  return {
    priceRange: {
      low: Math.round(base * 0.85),
      mid: Math.round(base),
      high: Math.round(base * 1.15),
    },
    demandScore: Math.floor(Math.random() * 40) + 60, // 60–100
    competition: Math.floor(Math.random() * 20) + 5, // listings nearby
    recommendedPrice: Math.round(base * 1.05),
    trend: Array.from({ length: 12 }, () => Math.round(base * (0.9 + Math.random() * 0.2))),
    similarListings: [
      {
        title: `${label} • Similar`,
        price: Math.round(base * (0.9 + Math.random() * 0.2)),
        image: vehicle.images?.[0] ?? "https://placehold.co/200x120",
      },
      {
        title: `${label} • Nearby`,
        price: Math.round(base * (0.9 + Math.random() * 0.2)),
        image: vehicle.images?.[1] ?? "https://placehold.co/200x120",
      },
    ],
    aiInsights: [
      "Demand is stable — good time to list.",
      "Vehicles with clean MOT history sell 12% faster.",
      "Photos with clear lighting increase buyer interest by 18%.",
      "Your valuation aligns well with current market trends.",
    ],
  };
}

export default function MarketScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { vehicles } = useVehicleHistory();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: theme.white }}>Vehicle not found</Text>
      </View>
    );
  }

  return <MarketScanContent vehicle={vehicle} router={router} theme={theme} />;
}

function MarketScanContent({
  vehicle,
  router,
  theme,
}: {
  vehicle: ReturnType<typeof useVehicleHistory>["vehicles"][number];
  router: ReturnType<typeof useRouter>;
  theme: any;
}) {
  const market = useMemo(() => generateMarketData(vehicle), [vehicle]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* HEADER */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: theme.accent,
          marginBottom: 10,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        📊 Market Scan
      </Text>

      <Text style={{ color: theme.muted, marginBottom: 20 }}>
        Live market insights for your flip.
      </Text>

      {/* PRICE RANGE */}
      <View
        style={{
          backgroundColor: theme.card,
          padding: 16,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: theme.accent,
            fontSize: 18,
            fontWeight: "700",
            marginBottom: 10,
          }}
        >
          Price Range
        </Text>

        <Text style={{ color: theme.white }}>Low: £{market.priceRange.low}</Text>
        <Text style={{ color: theme.white }}>Mid: £{market.priceRange.mid}</Text>
        <Text style={{ color: theme.white }}>High: £{market.priceRange.high}</Text>
      </View>

      {/* DEMAND + COMPETITION */}
      <View
        style={{
          backgroundColor: theme.card,
          padding: 16,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: theme.accent,
            fontSize: 18,
            fontWeight: "700",
            marginBottom: 10,
          }}
        >
          Market Conditions
        </Text>

        <Text style={{ color: theme.white }}>
          Demand Score: {market.demandScore}/100
        </Text>

        <Text style={{ color: theme.white }}>
          Competition: {market.competition} similar listings nearby
        </Text>
      </View>

      {/* RECOMMENDED PRICE */}
      <View
        style={{
          backgroundColor: theme.card,
          padding: 16,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: theme.accent,
            fontSize: 18,
            fontWeight: "700",
            marginBottom: 10,
          }}
        >
          Recommended Listing Price
        </Text>

        <Text
          style={{
            color: theme.goldDeep,
            fontSize: 22,
            fontWeight: "800",
          }}
        >
          £{market.recommendedPrice}
        </Text>
      </View>

      {/* AI INSIGHTS */}
      <View
        style={{
          backgroundColor: theme.card,
          padding: 16,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: theme.accent,
            fontSize: 18,
            fontWeight: "700",
            marginBottom: 10,
          }}
        >
          🤖 AI Insights
        </Text>

        {market.aiInsights.map((tip, i) => (
          <Text key={i} style={{ color: theme.muted, marginBottom: 6 }}>
            • {tip}
          </Text>
        ))}
      </View>

      {/* SIMILAR LISTINGS */}
      <View
        style={{
          backgroundColor: theme.card,
          padding: 16,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: theme.accent,
            fontSize: 18,
            fontWeight: "700",
            marginBottom: 10,
          }}
        >
          Similar Listings
        </Text>

        {market.similarListings.map((item, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              marginBottom: 12,
              gap: 12,
              alignItems: "center",
            }}
          >
            <Image
              source={{ uri: item.image }}
              style={{
                width: 100,
                height: 70,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.goldSoftGlow,
              }}
            />

            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.white }}>{item.title}</Text>
              <Text style={{ color: theme.accent, fontWeight: "700" }}>
                £{item.price}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* ACTIONS */}
      <TouchableOpacity
        onPress={() => router.push(`/vehicles/overview/${vehicle.id}`)}
        style={{
          backgroundColor: theme.goldDeep,
          padding: 14,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          marginBottom: 40,
        }}
      >
        <Text
          style={{
            color: theme.black,
            fontSize: 18,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          ← Back to Overview
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
