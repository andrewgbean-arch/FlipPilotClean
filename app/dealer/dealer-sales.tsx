import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextStyle,
} from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { useDealerAI } from "@/features/dealer-ai/DealerAIContext";

import AffordabilitySummaryCard from "@/components/dealer/AffordabilitySummaryCard";
import FinanceSuiteSummaryCard from "@/components/dealer/FinanceSuiteSummaryCard";

import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import DealerFab from "@/components/dealer/DealerFab";
import SupernovaCard from "@/components/dealer/SupernovaCard";

import { matchEngine } from "@/features/dealer-ai/MatchEngine";

import { useLocalSearchParams, router } from "expo-router";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

import { DealerGridButton } from "@/components/dealer/DealerGridButton"; // ⭐ Needed for Intelligence section

export default function DealerSalesScreen() {
  const theme = useTheme();
  const ai = useDealerAI();

  const { id } = useLocalSearchParams();
  const { vehicles, dealerMode, setDealerMode, setFlashTrigger } =
    useVehicleHistory();

  /* ⭐ Auto‑activate Dealer Mode */
  useEffect(() => {
    if (!dealerMode && vehicles.length > 0) {
      setDealerMode(true);
      setFlashTrigger(Date.now());
    }
  }, [dealerMode, vehicles.length]);

  /* ⭐ Bulletproof vehicle lookup */
  const vehicle = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return null;
    if (!id) return vehicles[0];

    const found = vehicles.find(v => String(v.id) === String(id));
    return found ?? vehicles[0];
  }, [vehicles, id]);

  /* ⭐ Fallback guard */
  if (!vehicle) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", color: theme.text }}>
          Loading vehicle…
        </Text>
      </View>
    );
  }

  /* ⭐ Safe defaults */
  const lead: any = {};
  const buyer: any = {};

  /* ⭐ Sales AI Intelligence */
  const closing = ai.closingProbability(vehicle, lead);
  const negotiation = ai.negotiationPredictor(vehicle);
  const leadQuality = ai.leadQualityScore(lead);
  const matchScore = matchEngine.evaluate(vehicle, lead, ai).score;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DealerNeonHeader
        title="Dealer Sales Hub"
        subtitle="AI‑Powered Sales Intelligence"
      />

      <ScrollView style={{ padding: 20 }}>

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

        {/* ⭐ Section Header */}
        <Text
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: theme.accent,
            marginBottom: 20,
          }}
        >
          Sales Intelligence
        </Text>

        {/* ⭐ FinanceSuite SummaryCard */}
        <FinanceSuiteSummaryCard vehicle={vehicle} buyer={buyer} />

        {/* ⭐ Affordability Summary */}
        <AffordabilitySummaryCard vehicle={vehicle} buyer={buyer} theme={theme} />

        {/* ⭐ Deal Match Score */}
        <SupernovaCard
          title="Deal Match Score"
          subtitle="AI match strength analysis"
          icon="🤝"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Deal Match Score
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {matchScore}/100 match strength
          </Text>
        </SupernovaCard>

        {/* ⭐ Closing Probability */}
        <SupernovaCard
          title="Closing Probability"
          subtitle="AI closing likelihood"
          icon="🔐"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <Text
            style={{
              color: theme.text,
              fontWeight: "800",
              fontSize: 18,
              marginBottom: 6,
            }}
          >
            Closing Probability
          </Text>
          <Text
            style={{
              color: theme.secondary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {closing}% chance of closing
          </Text>
        </SupernovaCard>

        {/* ⭐ Negotiation Strategy */}
        <SupernovaCard
          title="Negotiation Strategy"
          subtitle="AI negotiation prediction"
          icon="🧠"
          badge="AI"
          gradientBar
          glow
        >
          <Text
            style={{
              color: theme.text,
              fontWeight: "800",
              fontSize: 18,
              marginBottom: 6,
            }}
          >
            Negotiation Strategy
          </Text>
          <Text
            style={{
              color: theme.secondary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {negotiation}
          </Text>
        </SupernovaCard>

        {/* ⭐ Lead Quality */}
        <SupernovaCard
          title="Lead Quality"
          subtitle="AI lead scoring"
          icon="📈"
          badge="AI"
          gradientBar
          glow
        >
          <Text
            style={{
              color: theme.text,
              fontWeight: "800",
              fontSize: 18,
              marginBottom: 6,
            }}
          >
            Lead Quality
          </Text>
          <Text
            style={{
              color: theme.secondary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {leadQuality}/100 overall lead score
          </Text>
        </SupernovaCard>

        {/* ⭐ Dealer Stock Hub Button */}
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/dealer/dealer-stock",
            })
          }
          style={{
            backgroundColor: theme.card,
            paddingVertical: 18,
            paddingHorizontal: 20,
            borderRadius: theme.radius.lg,
            marginTop: 20,
            marginBottom: 22,
            borderWidth: 2,
            borderColor: theme.goldSoftGlow,
            shadowColor: theme.goldDeep,
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <Text
            style={{
              color: theme.accent,
              fontWeight: "900",
              fontSize: 20,
              textAlign: "center",
              letterSpacing: 0.5,
            }}
          >
            Dealer Stock Hub
          </Text>
          <Text
            style={{
              color: theme.secondary,
              fontSize: 14,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            View Stock • Sort • Search • Insights
          </Text>
        </TouchableOpacity>

        {/* ⭐ Dealer Mode V9 Button */}
        <TouchableOpacity
          style={{
            backgroundColor: theme.accent,
            padding: 16,
            borderRadius: 14,
            marginTop: 10,
          }}
          onPress={() =>
            router.push({
              pathname: "/motors/dealer-dashboard",
              params: { id: vehicle.id },
            })
          }
        >
          <Text
            style={{
              color: theme.background,
              fontWeight: "800" as TextStyle["fontWeight"],
              fontSize: 18,
              textAlign: "center",
            }}
          >
            Dealer Mode V9 Dashboard
          </Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>

      <DealerFab vehicleId={vehicle.id} />
    </View>
  );
}
