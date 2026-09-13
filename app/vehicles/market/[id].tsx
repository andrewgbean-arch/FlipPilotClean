import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/styles/ThemeContext";
import { BASE_URL } from "@/utils/api";

type MarketResult = {
  priceRange: { low: number; mid: number; high: number };
  demandScore: number;
  competition: number;
  recommendedPrice: number;
  insights: string[];
  similarListings: { title: string; price: number | null; image: string | null }[];
};

function labelFor(vehicle: any) {
  return vehicle.mot?.make && vehicle.mot?.model
    ? `${vehicle.mot.make} ${vehicle.mot.model}`
    : vehicle.title ?? "This vehicle";
}

function mapItem(item: any, fallbackTitle: string) {
  const price =
    typeof item?.extracted_price === "number"
      ? item.extracted_price
      : item?.price
      ? parseFloat(String(item.price).replace(/[^0-9.]/g, ""))
      : null;

  return {
    title: item?.title ?? fallbackTitle,
    price: Number.isFinite(price) ? price : null,
    image: item?.thumbnail ?? null,
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
  const [market, setMarket] = useState<MarketResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const label = labelFor(vehicle);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(label)}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.error) {
          setError(data.error);
          return;
        }

        const m = data.market ?? {};
        const base = m.average ?? vehicle.valuation ?? m.smartPrice ?? 0;

        const items = [...(data.ebayItems ?? []), ...(data.googleItems ?? [])].slice(0, 2);

        setMarket({
          priceRange: {
            low: Math.round(m.lowest ?? m.googlePriceMin ?? base * 0.85),
            mid: Math.round(base),
            high: Math.round(m.highest ?? m.googlePriceMax ?? base * 1.15),
          },
          demandScore: Math.round(m.demandScore ?? 0),
          competition: m.soldCount ?? items.length,
          recommendedPrice: Math.round(data.pricing?.recommendedSellPrice ?? base),
          insights: [
            data.insights,
            `Based on ${m.soldCount ?? 0} real sold/listed matches found just now.`,
            `Demand score: ${Math.round(m.demandScore ?? 0)}/100.`,
          ].filter(Boolean),
          similarListings:
            items.length > 0
              ? items.map((item) => mapItem(item, label))
              : [{ title: label, price: null, image: vehicle.images?.[0] ?? null }],
        });
      } catch (err) {
        if (!cancelled) setError("Couldn't reach the market lookup service.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vehicle.id]);

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

      {loading && (
        <View style={{ alignItems: "center", padding: 30 }}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={{ color: theme.muted, marginTop: 12 }}>
            Checking eBay, Amazon and Google for real prices…
          </Text>
        </View>
      )}

      {!loading && error && (
        <Text style={{ color: theme.danger, textAlign: "center", padding: 20 }}>
          {error}
        </Text>
      )}

      {!loading && market && (
        <>
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

            {market.insights.map((tip, i) => (
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
                  source={{ uri: item.image ?? "https://placehold.co/200x120" }}
                  style={{
                    width: 100,
                    height: 70,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.goldSoftGlow,
                  }}
                />

                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.white }} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={{ color: theme.accent, fontWeight: "700" }}>
                    {item.price != null ? `£${item.price}` : "Price unknown"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

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
