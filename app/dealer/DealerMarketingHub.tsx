import React, { useEffect, useMemo } from "react";
import { View, Text, ScrollView } from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { useDealerAI } from "@/features/dealer-ai/DealerAIContext";

import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import DealerFab from "@/components/dealer/DealerFab";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import { DealerGridButton } from "@/components/dealer/DealerGridButton";

import { useLocalSearchParams } from "expo-router";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

export default function DealerMarketingHub() {
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

  /* ⭐ Marketing AI Intelligence */
  const photos = vehicle.ai?.photos ?? [];

  const photoScore = ai.photoQualityScore(photos);
  const damageHint = ai.damageDetection(photos);
  const marketPrice = ai.autoMarketPrice(vehicle, photos);
  const rotationAdvice = ai.stockRotationAdvice(vehicle);
  const flipChance = ai.flipProbability(vehicle);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DealerNeonHeader
        title="Dealer Marketing Hub"
        subtitle="AI‑Powered Advertising Intelligence"
      />

      <ScrollView style={{ padding: 20 }}>
        
        {/* ⭐ Navigation Grid */}
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
          <DealerGridButton label="Risk Hub" icon="⚠️" route="/dealer/dealer-risk" />
          <DealerGridButton label="Sales Hub" icon="💰" route="/dealer/dealer-sales" />
        </View>

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
            fontSize: 30,
            fontWeight: "900",
            color: theme.accent,
            marginBottom: 20,
          }}
        >
          Marketing Intelligence
        </Text>

        {/* ⭐ Photo Quality */}
        <SupernovaCard
          title="Photo Quality Score"
          subtitle="AI image impact analysis"
          icon="📸"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Photo Quality Score
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {photoScore}/100 image impact rating
          </Text>
        </SupernovaCard>

        {/* ⭐ Damage Detection */}
        <SupernovaCard
          title="Damage Detection"
          subtitle="AI visual inspection"
          icon="🔍"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Damage Detection
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {damageHint}
          </Text>
        </SupernovaCard>

        {/* ⭐ Market Price */}
        <SupernovaCard
          title="Market Price Hint"
          subtitle="AI valuation engine"
          icon="💷"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Market Price Hint
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            £{marketPrice} estimated market value
          </Text>
        </SupernovaCard>

        {/* ⭐ Rotation Advice */}
        <SupernovaCard
          title="Rotation Advice"
          subtitle="Stock movement prediction"
          icon="🔄"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Rotation Advice
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {rotationAdvice}
          </Text>
        </SupernovaCard>

        {/* ⭐ Flip Probability */}
        <SupernovaCard
          title="Flip Probability"
          subtitle="AI sale likelihood"
          icon="🔥"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Flip Probability
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {flipChance}% likelihood of selling
          </Text>
        </SupernovaCard>

        {/* ⭐ AI Ad Builder */}
        <SupernovaCard
          title="AI Ad Builder"
          subtitle="Instant ad generation"
          icon="📝"
          badge="AI"
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            AI Ad Builder
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {ai.generateAd(vehicle)}
          </Text>
        </SupernovaCard>

        {/* ⭐ Keyword Optimiser */}
        <SupernovaCard
          title="Keyword Optimiser"
          subtitle="SEO keyword intelligence"
          icon="🔑"
          badge="AI"
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Keyword Optimiser
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {ai.keywordHints(vehicle)}
          </Text>
        </SupernovaCard>

        {/* ⭐ Social Posting Strategy */}
        <SupernovaCard
          title="Social Posting Strategy"
          subtitle="AI social media optimisation"
          icon="📣"
          badge="AI"
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Social Posting Strategy
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {ai.postingStrategy(vehicle)}
          </Text>
        </SupernovaCard>

        {/* ⭐ Competitor Comparison */}
        <SupernovaCard
          title="Competitor Ad Comparison"
          subtitle="AI competitor analysis"
          icon="⚔️"
          badge="AI"
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Competitor Ad Comparison
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {ai.competitorComparison(vehicle)}
          </Text>
        </SupernovaCard>

        {/* ⭐ Engagement Prediction */}
        <SupernovaCard
          title="Engagement Prediction"
          subtitle="AI engagement forecasting"
          icon="📈"
          badge="AI"
          gradientBar
          glow
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Engagement Prediction
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {ai.engagementPrediction(vehicle)}
          </Text>
        </SupernovaCard>

        <View style={{ height: 80 }} />
      </ScrollView>

      <DealerFab vehicleId={vehicle.id} />
    </View>
  );
}
