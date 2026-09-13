import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { useDealerAI } from "@/features/dealer-ai/DealerAIContext";

import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import DealerFab from "@/components/dealer/DealerFab";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import { DealerGridButton } from "@/components/dealer/DealerGridButton";

import { useLocalSearchParams, router } from "expo-router";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

export default function DealerFinanceScreen() {
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

  /* ⭐ Finance AI Intelligence */
  const apr = ai.financeAPR(vehicle);
  const monthly = ai.monthlyPayment(vehicle);
  const affordability = ai.affordabilityScore(vehicle);
  const holdingCost = ai.holdingCost(vehicle);
  const roi = ai.roiScore(vehicle);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DealerNeonHeader
        title="Dealer Finance Hub"
        subtitle="AI‑Powered Financial Intelligence"
      />

      <ScrollView style={{ padding: 20 }}>
        
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
          <DealerGridButton label="CRM Hub" icon="👥" route="/dealer/dealer-crm" />
          <DealerGridButton label="Marketing Hub" icon="📣" route="/dealer/dealer-marketing" />
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
          Finance Intelligence
        </Text>

        {/* ⭐ APR */}
        <SupernovaCard title="APR Estimate" glow icon="📈" badge="AI">
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            APR Estimate
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {apr}% estimated APR
          </Text>
        </SupernovaCard>

        {/* ⭐ Monthly Payment */}
        <SupernovaCard title="Monthly Payment" glow icon="💳" badge="AI">
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Monthly Payment
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            £{monthly} per month
          </Text>
        </SupernovaCard>

        {/* ⭐ Affordability */}
        <SupernovaCard title="Affordability Score" glow icon="🧮" badge="AI">
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Affordability Score
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {affordability}/100 buyer affordability
          </Text>
        </SupernovaCard>

        {/* ⭐ Holding Cost */}
        <SupernovaCard title="Holding Cost" glow icon="⏳" badge="AI">
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Holding Cost
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            £{holdingCost} estimated holding cost
          </Text>
        </SupernovaCard>

        {/* ⭐ ROI */}
        <SupernovaCard title="ROI Score" glow icon="📈" badge="AI">
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            ROI Score
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {roi}/100 return on investment
          </Text>
        </SupernovaCard>

        <View style={{ height: 80 }} />
      </ScrollView>

      <DealerFab vehicleId={vehicle.id} />
    </View>
  );
}
