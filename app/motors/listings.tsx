import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  PanResponder,
  Image,
} from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import type { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";

/* -------------------------------------------------------
   SIMULATED MARKET INTELLIGENCE ENGINE
------------------------------------------------------- */

function simulateMarketIntel(vehicle: FlipRecord) {
  const market = vehicle.market ?? {};
  const baseMarket =
    market.average ??
    ((vehicle.buyPrice ?? 3000) +
      (vehicle.sellPrice ?? vehicle.valuation ?? 4500)) / 2;

  const mileage = vehicle.mileage ?? vehicle.mot?.mileage ?? 80000;
  const flipScore = vehicle.flipScore ?? 50;

  const timestampMs = new Date(vehicle.timestamp).getTime();
  const endMs = vehicle.sellDate
    ? new Date(vehicle.sellDate).getTime()
    : Date.now();
  const daysListed = Math.max(
    1,
    Math.round((endMs - timestampMs) / 86400000)
  );

  const demandIndex = Math.max(
    10,
    Math.min(
      100,
      (market.demandScore ?? flipScore) +
        (baseMarket > 8000 ? -10 : 5)
    )
  );

  const competitorCount = Math.max(
    1,
    market.soldCount ?? Math.round((baseMarket / 5000) * 3)
  );

  const priceDelta =
    (vehicle.sellPrice ?? vehicle.valuation ?? baseMarket) -
    baseMarket;

  const sellTimeDays = Math.max(
    3,
    Math.round(14 - demandIndex / 8 + daysListed / 4)
  );

  const pressureLevel =
    priceDelta < -300
      ? "undervalued"
      : priceDelta > 700
      ? "overpriced"
      : "fair";

  const dealerRankPercent = Math.max(
    5,
    Math.min(100, 50 - (flipScore - 50) + daysListed / 2)
  );

  const sentimentScore = Math.max(
    10,
    Math.min(100, flipScore + (priceDelta < 0 ? 10 : -5))
  );

  const riskScore = Math.max(
    5,
    Math.min(
      100,
      50 +
        (priceDelta > 500 ? 15 : 0) +
        (mileage > 100000 ? 10 : 0) -
        (flipScore > 70 ? 10 : 0)
    )
  );

  const buyerLikelihood = Math.max(
    5,
    Math.min(
      100,
      sentimentScore +
        (demandIndex > 60 ? 10 : -5) -
        (pressureLevel === "overpriced" ? 10 : 0)
    )
  );

  return {
    marketAvg: Math.round(baseMarket),
    demandIndex: Math.round(demandIndex),
    competitorCount,
    priceDelta: Math.round(priceDelta),
    sellTimeDays,
    pressureLevel,
    dealerRankPercent: Math.round(dealerRankPercent),
    sentimentScore: Math.round(sentimentScore),
    riskScore: Math.round(riskScore),
    buyerLikelihood: Math.round(buyerLikelihood),
  };
}

/* -------------------------------------------------------
   TYPES
------------------------------------------------------- */

type TabButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: any;
};

type SortButtonProps = {
  label: string;
  mode: "profit" | "score" | "newest" | "fast" | "mileage";
  sortMode: string;
  setSortMode: (mode: SortButtonProps["mode"]) => void;
  theme: any;
};

type DealerButtonProps = {
  label: string;
  icon: string;
  theme: any;
  onPress: () => void;
};

type VehicleCardProps = {
  vehicle: FlipRecord;
  theme: any;
};

/* -------------------------------------------------------
   MAIN DEALER LISTINGS SCREEN
------------------------------------------------------- */

export default function DealerListings() {
  const theme = useTheme();
  const router = useRouter();

  const { vehicles } = useVehicleHistory();

  return <DealerListingsContent vehicles={vehicles} router={router} theme={theme} />;
}

function DealerListingsContent({
  vehicles,
  router,
  theme,
}: {
  vehicles: ReturnType<typeof useVehicleHistory>["vehicles"];
  router: ReturnType<typeof useRouter>;
  theme: any;
}) {
  const [tab, setTab] = useState<"stock" | "sold">("stock");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortMode, setSortMode] = useState<
    "profit" | "score" | "newest" | "fast" | "mileage"
  >("profit");

  const stock = vehicles.filter((v) => !v.sellDate);
  const sold = vehicles.filter((v) => v.sellDate);

  const list = tab === "stock" ? stock : sold;

  const sorted = [...list].sort((a, b) => {
    switch (sortMode) {
      case "profit":
        return (
          ((b.sellPrice ?? b.valuation ?? 0) - (b.buyPrice ?? 0)) -
          ((a.sellPrice ?? a.valuation ?? 0) - (a.buyPrice ?? 0))
        );
      case "score":
        return (b.flipScore ?? 0) - (a.flipScore ?? 0);
      case "newest":
        return (
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime()
        );
      case "fast":
        return (
          (a.sellDate ? new Date(a.sellDate).getTime() : Infinity) -
          (b.sellDate ? new Date(b.sellDate).getTime() : Infinity)
        );
      case "mileage":
        return (
          (a.mileage ?? a.mot?.mileage ?? 0) -
          (b.mileage ?? b.mot?.mileage ?? 0)
        );
      default:
        return 0;
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.black }}>
      <View style={{ padding: 16 }}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: "800",
            color: theme.goldDeep,
            marginBottom: 12,
            textShadowColor: theme.goldSoftGlow,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          }}
        >
          Dealer Listings
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <TabButton
            label="Stock"
            active={tab === "stock"}
            onPress={() => setTab("stock")}
            theme={theme}
          />
          <TabButton
            label="Sold"
            active={tab === "sold"}
            onPress={() => setTab("sold")}
            theme={theme}
          />
        </View>

        <TouchableOpacity
          onPress={() => setFiltersOpen(!filtersOpen)}
          style={{
            backgroundColor: theme.card,
            padding: 14,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
          }}
        >
          <Text
            style={{
              color: theme.white,
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            Filters & Sorting {filtersOpen ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>

        {filtersOpen && (
          <View
            style={{
              backgroundColor: theme.card,
              padding: 14,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.goldSoftGlow,
              marginTop: 10,
              gap: 10,
            }}
          >
            <Text
              style={{
                color: theme.goldDeep,
                fontWeight: "700",
                fontSize: 18,
              }}
            >
              Sorting
            </Text>

            <SortButton
              label="Highest Profit"
              mode="profit"
              sortMode={sortMode}
              setSortMode={setSortMode}
              theme={theme}
            />
            <SortButton
              label="Highest Flip Score"
              mode="score"
              sortMode={sortMode}
              setSortMode={setSortMode}
              theme={theme}
            />
            <SortButton
              label="Newest Added"
              mode="newest"
              sortMode={sortMode}
              setSortMode={setSortMode}
              theme={theme}
            />
            <SortButton
              label="Fastest Sellers"
              mode="fast"
              sortMode={sortMode}
              setSortMode={setSortMode}
              theme={theme}
            />
            <SortButton
              label="Lowest Mileage"
              mode="mileage"
              sortMode={sortMode}
              setSortMode={setSortMode}
              theme={theme}
            />
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {sorted.map((v, i) => (
          <TouchableOpacity
            key={i}
            onPress={() =>
              router.push(`/motors/vehicle-detail?id=${v.id}`)
            }
          >
            <VehicleCard vehicle={v} theme={theme} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------
   TAB BUTTON
------------------------------------------------------- */

function TabButton({
  label,
  active,
  onPress,
  theme,
}: TabButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: active ? theme.goldDeep : theme.card,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
      }}
    >
      <Text
        style={{
          color: active ? theme.black : theme.white,
          fontWeight: "700",
          fontSize: 16,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------
   SORT BUTTON
------------------------------------------------------- */

function SortButton({
  label,
  mode,
  sortMode,
  setSortMode,
  theme,
}: SortButtonProps) {
  const active = sortMode === mode;

  return (
    <TouchableOpacity
      onPress={() => setSortMode(mode)}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: active ? theme.goldDeep : theme.card,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
      }}
    >
      <Text
        style={{
          color: active ? theme.black : theme.white,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------
   VEHICLE CARD (V50)
------------------------------------------------------- */

function VehicleCard({ vehicle, theme }: VehicleCardProps) {
  const router = useRouter();

  const market = simulateMarketIntel(vehicle);

  const profit =
    (vehicle.sellPrice ?? vehicle.valuation ?? 0) -
    (vehicle.buyPrice ?? 0);

  const flipScore = vehicle.flipScore ?? 0;

  const motExpiry =
    vehicle.mot?.motExpiry ?? vehicle.mot?.expiryDate ?? null;

  const motDaysRemaining = motExpiry
    ? Math.ceil(
        (new Date(motExpiry).getTime() - Date.now()) / 86400000
      )
    : null;

  const motColor =
    motDaysRemaining !== null && motDaysRemaining < 30
      ? "#FF4444"
      : motDaysRemaining !== null && motDaysRemaining < 90
      ? "#FFAA33"
      : "#66FF99";

  const tags: string[] = [];

  if (flipScore > 70) tags.push("🔥 High Demand");
  if (profit > 1000) tags.push("💰 Strong Profit");
  if ((vehicle.mileage ?? vehicle.mot?.mileage ?? 0) < 60000)
    tags.push("🟢 Low Mileage");
  if (motDaysRemaining !== null && motDaysRemaining < 30)
    tags.push("⚠️ MOT Soon");

  const rarityScore = Math.min(
    100,
    Math.max(
      10,
      100 -
        ((vehicle.mileage ?? vehicle.mot?.mileage ?? 80000) /
          1000)
    )
  );

  const rarityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rarityAnim, {
      toValue: rarityScore,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [rarityScore]);

  const rarityWidth = rarityAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const liquidityScore = vehicle.sellDate ? 80 : 60;

  const liquidityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(liquidityAnim, {
      toValue: liquidityScore,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [liquidityScore]);

  const liquidityWidth = liquidityAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const buyerSentiment = market.sentimentScore;
  const sentimentColor =
    buyerSentiment > 70
      ? "#66FF99"
      : buyerSentiment > 40
      ? "#FFAA33"
      : "#FF4444";

  const wheelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(wheelAnim, {
      toValue: flipScore,
      duration: 900,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start();
  }, [flipScore]);

  const wheelRotation = wheelAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0deg", "360deg"],
  });

  const tickerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(tickerAnim, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  const tickerTranslate = tickerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "-100%"],
  });

  const swipeX = useRef(new Animated.Value(0)).current;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 10,
    onPanResponderMove: (_, gesture) => {
      swipeX.setValue(gesture.dx);
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -120) {
        router.push({
          pathname: "/dealer/dealer-sales",
          params: { id: vehicle.id, lead: "{}", buyer: "{}" },
        });
      } else if (gesture.dx > 120) {
        router.push({
          pathname: "/motors/dealer-dashboard",
          params: { id: vehicle.id, lead: "{}", buyer: "{}" },
        });
      }

      Animated.spring(swipeX, {
        toValue: 0,
        useNativeDriver: false,
      }).start();
    },
  });

  const [showAI, setShowAI] = useState(false);

  const aiSellStrategy = `
• Sell within ${market.sellTimeDays} days for best price
• Highlight low mileage + strong flip score
• Push urgency if MOT < 30 days
• Offer flexible deposit options
`;

  const aiBuyerMatch = `
• Ideal buyer: budget-conscious, reliability-focused
• Responds well to quick follow-ups
• Prefers transparent pricing
`;

  const sellProbability = Math.round(
    market.buyerLikelihood
  );

  const riskScore = market.riskScore;
  const riskColor =
    riskScore > 70
      ? "#FF4444"
      : riskScore > 40
      ? "#FFAA33"
      : "#66FF99";

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        transform: [{ translateX: swipeX }],
        backgroundColor: theme.card,
        padding: 18,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        marginBottom: 18,
        shadowColor: theme.goldSoftGlow,
        shadowOpacity: 0.3,
        shadowRadius: 8,
      }}
    >
      {/* SWIPE LEFT QUICK ACTION */}
      <Animated.View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 120,
          backgroundColor: theme.goldDeep,
          justifyContent: "center",
          alignItems: "center",
          opacity: swipeX.interpolate({
            inputRange: [-150, -50],
            outputRange: [1, 0],
            extrapolate: "clamp",
          }),
        }}
      >
        <TouchableOpacity
          onPress={() =>
            router.push(
              `/dealer/dealer-sales?id=${vehicle.id}`
            )
          }
        >
          <Text
            style={{ color: theme.black, fontWeight: "700" }}
          >
            Quick Sell
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* SWIPE RIGHT QUICK ACTION */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 120,
          backgroundColor: "#55CCFF",
          justifyContent: "center",
          alignItems: "center",
          opacity: swipeX.interpolate({
            inputRange: [50, 150],
            outputRange: [0, 1],
            extrapolate: "clamp",
          }),
        }}
      >
        <TouchableOpacity
          onPress={() =>
            router.push(
              `/motors/dealer-dashboard?id=${vehicle.id}`
            )
          }
        >
          <Text
            style={{ color: theme.black, fontWeight: "700" }}
          >
            Dashboard
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* HEADER */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {vehicle.images?.[0] && (
            <Image
              source={{ uri: vehicle.images[0] }}
              style={{
                width: 80,
                height: 80,
                borderRadius: 10,
                marginRight: 10,
              }}
            />
          )}

          <Text
            style={{
              color: theme.white,
              fontSize: 22,
              fontWeight: "800",
            }}
          >
            #{vehicle.id}
          </Text>
        </View>

        <Animated.View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.black,
            justifyContent: "center",
            alignItems: "center",
            transform: [{ rotate: wheelRotation }],
          }}
        >
          <Text
            style={{
              color: theme.white,
              fontWeight: "700",
            }}
          >
            {flipScore}
          </Text>
        </Animated.View>
      </View>

      {/* MARKET TICKER */}
      <View
        style={{
          overflow: "hidden",
          marginTop: 10,
          height: 20,
          backgroundColor: theme.black,
          borderRadius: 8,
        }}
      >
        <Animated.Text
          style={{
            color: theme.goldDeep,
            fontWeight: "700",
            transform: [{ translateX: tickerTranslate }],
            paddingHorizontal: 10,
          }}
        >
          Market Avg £{market.marketAvg} • Demand{" "}
          {market.demandIndex}% • Competitors{" "}
          {market.competitorCount} •{" "}
          {market.pressureLevel.toUpperCase()}
        </Animated.Text>
      </View>

      {/* TAGS */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 8,
        }}
      >
        {tags.map((t, i) => (
          <View
            key={i}
            style={{
              backgroundColor: theme.goldDeep,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 10,
            }}
          >
            <Text
              style={{
                color: theme.black,
                fontWeight: "700",
              }}
            >
              {t}
            </Text>
          </View>
        ))}
      </View>

      {/* BASIC INFO */}
      <Text
        style={{
          color: theme.muted,
          marginTop: 6,
        }}
      >
        Mileage:{" "}
        {vehicle.mileage ?? vehicle.mot?.mileage ?? "N/A"}
      </Text>

      <Text
        style={{
          color: profit >= 0 ? "#66FF99" : "#FF6666",
          marginTop: 6,
          fontWeight: "700",
          fontSize: 18,
        }}
      >
        Profit: £{profit.toFixed(0)}
      </Text>

      {motExpiry && (
        <View
          style={{
            marginTop: 6,
            backgroundColor: motColor,
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 10,
            alignSelf: "flex-start",
          }}
        >
          <Text
            style={{
              color: theme.black,
              fontWeight: "700",
            }}
          >
            MOT: {motDaysRemaining} days left
          </Text>
        </View>
      )}

      {/* RARITY BAR */}
      <View
        style={{
          marginTop: 10,
          height: 8,
          backgroundColor: theme.black,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            width: rarityWidth,
            height: "100%",
            backgroundColor: "#8F5FFF",
          }}
        />
      </View>

      {/* LIQUIDITY BAR */}
      <View
        style={{
          marginTop: 10,
          height: 8,
          backgroundColor: theme.black,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            width: liquidityWidth,
            height: "100%",
            backgroundColor: "#55CCFF",
          }}
        />
      </View>

      {/* BUYER SENTIMENT */}
      <View
        style={{
          marginTop: 10,
          backgroundColor: sentimentColor,
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: 10,
          alignSelf: "flex-start",
        }}
      >
        <Text
          style={{
            color: theme.black,
            fontWeight: "700",
          }}
        >
          Buyer Sentiment: {buyerSentiment}%
        </Text>
      </View>

      {/* AI SELL PROBABILITY */}
      <View style={{ marginTop: 12 }}>
        <Text
          style={{
            color: theme.white,
            fontWeight: "700",
          }}
        >
          Sell Probability: {sellProbability}%
        </Text>

        <View
          style={{
            height: 8,
            backgroundColor: theme.black,
            borderRadius: 10,
            overflow: "hidden",
            marginTop: 4,
          }}
        >
          <Animated.View
            style={{
              width: `${sellProbability}%`,
              height: "100%",
              backgroundColor:
                sellProbability > 70
                  ? "#66FF99"
                  : sellProbability > 40
                  ? "#FFAA33"
                  : "#FF4444",
            }}
          />
        </View>
      </View>

      {/* RISK SCORE */}
      <View style={{ marginTop: 10 }}>
        <Text
          style={{
            color: theme.white,
            fontWeight: "700",
          }}
        >
          Risk Score: {riskScore}%
        </Text>

        <View
          style={{
            height: 8,
            backgroundColor: theme.black,
            borderRadius: 10,
            overflow: "hidden",
            marginTop: 4,
          }}
        >
          <Animated.View
            style={{
              width: `${riskScore}%`,
              height: "100%",
              backgroundColor: riskColor,
            }}
          />
        </View>
      </View>

      {/* AI PANELS */}
      <TouchableOpacity
        onPress={() => setShowAI(!showAI)}
        style={{ marginTop: 10 }}
      >
        <Text
          style={{
            color: theme.goldDeep,
            fontWeight: "700",
          }}
        >
          {showAI ? "Hide AI Insights ▲" : "Show AI Insights ▼"}
        </Text>
      </TouchableOpacity>

      {showAI && (
        <View style={{ marginTop: 10, gap: 10 }}>
          <View
            style={{
              backgroundColor: theme.black,
              padding: 12,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.goldSoftGlow,
            }}
          >
            <Text
              style={{
                color: theme.goldDeep,
                fontWeight: "700",
              }}
            >
              AI Sell Strategy
            </Text>
            <Text
              style={{
                color: theme.white,
                marginTop: 6,
              }}
            >
              {aiSellStrategy}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: theme.black,
              padding: 12,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.goldSoftGlow,
            }}
          >
            <Text
              style={{
                color: theme.goldDeep,
                fontWeight: "700",
              }}
            >
              Buyer Persona Match
            </Text>
            <Text
              style={{
                color: theme.white,
                marginTop: 6,
              }}
            >
              {aiBuyerMatch}
            </Text>
          </View>
        </View>
      )}

      {/* DEALER BUTTONS */}
      <View style={{ marginTop: 16, gap: 10 }}>
        <DealerButton
          label="Dealer Dashboard"
          icon="📊"
          theme={theme}
          onPress={() =>
            router.push({
              pathname: "/motors/dealer-dashboard",
              params: {
                id: vehicle.id,
                lead: "{}",
                buyer: "{}",
              },
            })
          }
        />

        <DealerButton
          label="Sales Hub"
          icon="💬"
          theme={theme}
          onPress={() =>
            router.push({
              pathname: "/dealer/dealer-sales",
              params: {
                id: vehicle.id,
                lead: "{}",
                buyer: "{}",
              },
            })
          }
        />

        <DealerButton
          label="Finance Desk"
          icon="💷"
          theme={theme}
          onPress={() =>
            router.push({
              pathname: "/dealer/dealer-finance",
              params: {
                id: vehicle.id,
                buyer: "{}",
              },
            })
          }
        />

        <DealerButton
          label="Intelligence Hub"
          icon="🧠"
          theme={theme}
          onPress={() =>
            router.push({
              pathname: "/dealer/dealer-intelligence",
              params: {
                id: vehicle.id,
                lead: "{}",
                buyer: "{}",
              },
            })
          }
        />

        <DealerButton
          label="Risk Hub"
          icon="⚠️"
          theme={theme}
          onPress={() =>
            router.push({
              pathname: "/dealer/dealer-risk",
              params: {
                id: vehicle.id,
                lead: "{}",
                buyer: "{}",
              },
            })
          }
        />
      </View>
    </Animated.View>
  );
}

/* -------------------------------------------------------
   DEALER BUTTON
------------------------------------------------------- */

function DealerButton({
  label,
  icon,
  theme,
  onPress,
}: DealerButtonProps) {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: theme.goldDeep,
        padding: 12,
        borderRadius: theme.radius.md,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
      }}
      onPress={onPress}
    >
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text
        style={{
          color: theme.black,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
