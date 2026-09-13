import React, { useMemo } from "react";
import { ScrollView, View, Text } from "react-native";

import { useTheme } from "@/styles/ThemeContext";

import { DealerGlowCard } from "@/components/DealerGlowCard";
import { MetricRow } from "@/components/MetricRow";
import { AnimatedBar } from "@/components/AnimatedBar";
import { GradientChip } from "@/components/GradientChip";

import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import { DealerGridButton } from "@/components/dealer/DealerGridButton";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { calculateSupernovaScore } from "@/features/vehicles/models/SupernovaScore";

export default function DealerDashboardV11() {
  const theme = useTheme();

  const { vehicles } = useVehicleHistory();

  const insights = useMemo(() => {
    const total = vehicles.length;

    const totalValuation = vehicles.reduce(
      (sum, x) => sum + (x.valuation ?? x.sellPrice ?? x.buyPrice ?? 0),
      0
    );

    const avgFlipScore =
      total === 0
        ? 0
        : Math.round(
            vehicles.reduce((sum, x) => sum + (x.flipScore ?? 0), 0) / total
          );

    const motRisk = vehicles.filter((x) => {
      const expiry = x.mot?.motExpiry ?? x.mot?.expiryDate;
      if (!expiry) return false;

      const daysLeft = (new Date(expiry).getTime() - Date.now()) / 86400000;

      return daysLeft <= 30;
    }).length;

    return { total, totalValuation, avgFlipScore, motRisk };
  }, [vehicles]);

  const supernova = useMemo(() => calculateSupernovaScore(vehicles), [vehicles]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DealerNeonHeader
        title="Dealer Intelligence Dashboard"
        subtitle="Live insights powered by FlipPilot"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.lg }}
      >
        {/* ⭐ Dealer OS Navigation Grid */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            marginBottom: 25,
          }}
        >
          <DealerGridButton label="Dashboard" icon="📊" route="/dealer/DealerDashboardV11" />
          <DealerGridButton label="Stock Hub" icon="🚗" route="/dealer/dealer-stock" />
          <DealerGridButton label="Finance Hub" icon="💳" route="/dealer/dealer-finance" />
          <DealerGridButton label="CRM Hub" icon="👥" route="/dealer/DealerCRMIntelligence" />
          <DealerGridButton label="Marketing Hub" icon="📣" route="/dealer/DealerMarketingHub" />
          <DealerGridButton label="Risk Hub" icon="⚠️" route="/dealer/dealer-risk" />
          <DealerGridButton label="Sales Hub" icon="💰" route="/dealer/dealer-sales" />
        </View>

        {/* ⭐ Intelligence Section (injected here) */}
        <Text
          style={{
            color: theme.goldDeep,
            fontSize: 22,
            fontWeight: "800",
            marginTop: 30,
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

        {/* ⭐ Dealership Overview */}
        {insights && (
          <DealerGlowCard title="Dealership Overview" theme={theme}>
            <MetricRow label="Total Stock" value={insights.total} theme={theme} />
            <MetricRow
              label="Total Valuation"
              value={`£${insights.totalValuation.toLocaleString()}`}
              theme={theme}
            />
            <MetricRow label="Avg FlipScore" value={insights.avgFlipScore} theme={theme} />
            <MetricRow label="MOT Risk Vehicles" value={insights.motRisk} theme={theme} />

            <AnimatedBar value={insights.avgFlipScore} theme={theme} />
          </DealerGlowCard>
        )}

        {/* ⭐ Supernova Intelligence — real per-vehicle risk/profit/MOT/efficiency engine */}
        <DealerGlowCard title="Supernova Intelligence" theme={theme}>
          <GradientChip text={`Supernova Score: ${supernova.score}`} theme={theme} />
          <MetricRow label="Risk" value={supernova.risk} theme={theme} />
          <MetricRow label="Profit" value={supernova.profit} theme={theme} />
          <MetricRow label="Buy Efficiency" value={supernova.buyEfficiency} theme={theme} />
          <MetricRow label="Flip Speed" value={supernova.flipSpeed} theme={theme} />
          <AnimatedBar value={supernova.score} theme={theme} />

          {supernova.insights.map((line, i) => (
            <Text
              key={i}
              style={{ color: theme.muted, fontSize: 13, marginTop: 8, lineHeight: 18 }}
            >
              • {line}
            </Text>
          ))}
        </DealerGlowCard>

        {/* ⭐ MOT Health */}
        <DealerGlowCard title="MOT Health Index" theme={theme}>
          <GradientChip text="Reliability Overview" theme={theme} />
          <MetricRow label="MOT Health Score" value={supernova.motHealth} theme={theme} />
          <MetricRow label="Vehicles at Risk (≤30 days)" value={insights.motRisk} theme={theme} />
          <AnimatedBar value={supernova.motHealth} theme={theme} />
        </DealerGlowCard>

        <GradientChip text="Powered by Unified Data Layer" theme={theme} />

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
