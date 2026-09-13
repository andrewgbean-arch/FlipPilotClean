import React, { useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";

import { useTheme } from "@/styles/ThemeContext";
import { useDealerAIState } from "@/features/dealer-ai/DealerAIProvider";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { DealerGridButton } from "@/components/dealer/DealerGridButton"; // ⭐ Needed for Intelligence section

export default function DealerMotorsDashboard() {
  const theme = useTheme();
  const { cars } = useDealerAIState();

  /* -------------------------------------------------------
     ⭐ INSIGHTS
  ------------------------------------------------------- */
  const insights = useMemo(() => {
    const total = cars.length;

    const totalValuation = cars.reduce(
      (sum: number, v: FlipRecord) =>
        sum + (v.valuation ?? v.sellPrice ?? v.buyPrice ?? 0),
      0
    );

    const avgFlipScore =
      total === 0
        ? 0
        : Math.round(
            cars.reduce(
              (sum: number, v: FlipRecord) => sum + (v.flipScore ?? 0),
              0
            ) / total
          );

    const motRisk = cars.filter((v: FlipRecord) => {
      const expiry = v.mot?.motExpiry ?? v.mot?.expiryDate;
      if (!expiry) return false;
      const days =
        (new Date(expiry).getTime() - Date.now()) / 86400000;
      return days <= 30;
    }).length;

    const undervalued = cars.filter((v: FlipRecord) => {
      const valuation = v.valuation ?? 0;
      const buy = v.buyPrice ?? 0;
      return valuation - buy >= 1500;
    }).length;

    return {
      total,
      totalValuation,
      avgFlipScore,
      motRisk,
      undervalued,
    };
  }, [cars]);

  /* -------------------------------------------------------
     ⭐ TOP PERFORMER
  ------------------------------------------------------- */
  const bestFlip =
    cars.length > 0
      ? [...cars].sort((a, b) => {
          const profitA =
            (a.sellPrice ?? a.valuation ?? 0) - (a.buyPrice ?? 0);
          const profitB =
            (b.sellPrice ?? b.valuation ?? 0) - (b.buyPrice ?? 0);
          return profitB - profitA;
        })[0]
      : null;

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      {/* ⭐ HEADER */}
      <Text
        style={{
          fontSize: 34,
          fontWeight: "900",
          color: theme.accent,
          marginBottom: 10,
        }}
      >
        Motors Dashboard
      </Text>

      <Text
        style={{
          fontSize: 18,
          color: theme.secondary,
          marginBottom: 20,
        }}
      >
        Dealership overview at a glance.
      </Text>

      {/* ⭐ INTELLIGENCE SECTION (Injected here) */}
      <Text
        style={{
          color: theme.goldDeep,
          fontSize: 22,
          fontWeight: "800",
          marginTop: 10,
          marginBottom: 12,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        Intelligence
      </Text>

      <View
        style={{
          height: 2,
          backgroundColor: theme.goldSoftGlow,
          marginBottom: 16,
          borderRadius: 2,
          shadowColor: theme.goldDeep,
          shadowOpacity: 0.4,
          shadowRadius: 6,
        }}
      />

      <DealerGridButton
        label="Predictive Engine"
        icon="🔮"
        route="/dealer/DealerPredictiveEngine"
      />

      <DealerGridButton
        label="Performance Hub"
        icon="📊"
        route="/dealer/DealerPerformanceHub"
      />

      {/* ⭐ INSIGHTS CARD */}
      <SupernovaCard title="Key Metrics" glow style={{ marginBottom: 20 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: "800" }}>
          Key Metrics
        </Text>

        <Text style={{ color: theme.secondary }}>
          Total Stock: {insights.total}
        </Text>
        <Text style={{ color: theme.secondary }}>
          Total Valuation: £{insights.totalValuation}
        </Text>
        <Text style={{ color: theme.secondary }}>
          Avg FlipScore: {insights.avgFlipScore}
        </Text>
        <Text style={{ color: theme.secondary }}>
          MOT Risk: {insights.motRisk}
        </Text>
        <Text style={{ color: theme.secondary }}>
          Undervalued: {insights.undervalued}
        </Text>
      </SupernovaCard>

      {/* ⭐ SPOTLIGHT */}
      <SupernovaCard title="Motors Dashboard" glow style={{ marginBottom: 20 }}>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: "800" }}>
          Spotlight
        </Text>

        {bestFlip ? (
          <Text style={{ color: theme.accent, marginTop: 8 }}>
            Best Flip: {bestFlip.title}  
            Profit: £
            {(bestFlip.sellPrice ?? bestFlip.valuation ?? 0) -
              (bestFlip.buyPrice ?? 0)}
          </Text>
        ) : (
          <Text style={{ color: theme.muted, marginTop: 8 }}>
            No flips yet.
          </Text>
        )}
      </SupernovaCard>

      {/* ⭐ DEALER HUB NAVIGATION */}
      <Text
        style={{
          fontSize: 22,
          fontWeight: "800",
          color: theme.text,
          marginBottom: 10,
        }}
      >
        Dealer Hubs
      </Text>

      <DealerNavButton
        label="Stock Hub"
        onPress={() => router.push("/dealer/dealer-stock")}
        theme={theme}
      />

      <DealerNavButton
        label="Intelligence Hub"
        onPress={() => router.push("/dealer/dealer-motors")}
        theme={theme}
      />

      <DealerNavButton
        label="Risk Hub"
        onPress={() => router.push("/dealer/dealer-risk")}
        theme={theme}
      />

      <DealerNavButton
        label="Sales Hub"
        onPress={() => router.push("/dealer/dealer-sales")}
        theme={theme}
      />

      <DealerNavButton
        label="CRM Hub"
        onPress={() => router.push("/dealer/dealer-crm")}
        theme={theme}
      />

      <DealerNavButton
        label="Finance Hub"
        onPress={() => router.push("/dealer/dealer-finance")}
        theme={theme}
      />

      <DealerNavButton
        label="Marketing Hub"
        onPress={() => router.push("/dealer/dealer-marketing")}
        theme={theme}
      />

      <DealerNavButton
        label="Motors Dashboard"
        onPress={() => router.push("/dealer/dealer-motors")}
        theme={theme}
      />

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

/* -------------------------------------------------------
   ⭐ COMPONENTS
------------------------------------------------------- */

function DealerNavButton({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: theme.accent,
        padding: 16,
        borderRadius: theme.radius.md,
        marginBottom: 12,
      }}
    >
      <Text
        style={{
          color: theme.background,
          fontWeight: "800",
          fontSize: 18,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
