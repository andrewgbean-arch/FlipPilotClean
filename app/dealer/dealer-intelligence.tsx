import React, { useEffect, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { useDealerAI } from "@/features/dealer-ai/DealerAIContext";
import { useLocalSearchParams, router } from "expo-router";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { matchEngine } from "@/features/dealer-ai/MatchEngine";

import AffordabilitySummaryCard from "@/components/dealer/AffordabilitySummaryCard";
import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import DealerFab from "@/components/dealer/DealerFab";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import FinanceSuiteSummaryCard from "@/components/dealer/FinanceSuiteSummaryCard";

/* ⭐ REAL INTELLIGENCE MODULES */
import MarketHeatEngine from "@/components/dealer/engines/MarketHeatEngine";
import RiskRadar from "@/components/dealer/engines/RiskRadar";
import ProfitConsistency from "@/components/dealer/engines/ProfitConsistency";
import MotHealthIndex from "@/components/dealer/engines/MotHealthIndex";
import FlipTimeAnalyzer from "@/components/dealer/engines/FlipTimeAnalyzer";
import PriceEfficiency from "@/components/dealer/engines/PriceEfficiency";
import SmartAlerts from "@/components/dealer/engines/SmartAlerts";
import BusinessScore from "@/components/dealer/engines/BusinessScore";

/* -------------------------------------------------------
   ⭐ UNIFIED DEALER INTELLIGENCE HUB
------------------------------------------------------- */

export default function DealerIntelligenceScreen() {
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
  const buyer: any = {
    income: 2800,
    expenses: 1400,
    deposit: 500,
    creditScore: 620,
    riskScore: 0.3,
  };

  /* ⭐ Match Engine Evaluation */
  const match = matchEngine.evaluate(vehicle, buyer, ai);

  return (
    <View style={{ flex: 1 }}>
      <DealerNeonHeader
        title="Dealer Screen"
        subtitle="AI‑Powered Intelligence"
      />

      <ScrollView style={{ padding: 20 }}>
        {/* HEADER */}
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: theme.accent,
            marginBottom: 20,
          }}
        >
          Dealer Intelligence Hub
        </Text>

        {/* ⭐ FINANCE SUITE SUMMARY */}
        <FinanceSuiteSummaryCard vehicle={vehicle} buyer={buyer} />
        <AffordabilitySummaryCard vehicle={vehicle} buyer={buyer} theme={theme} />

        {/* ⭐ Match Engine Summary */}
        <SupernovaCard title="Match Engine Score" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Match Engine Score
          </Text>

          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {match.score}/100 match rating
          </Text>

          <Text style={{ color: theme.muted, fontSize: 14 }}>
            Band: {match.band}
          </Text>
        </SupernovaCard>

        {/* ⭐ Dealer Mode Navigation Buttons */}
        <View style={{ marginBottom: 25 }}>
          <DealerButton
            label="Dealer Dashboard"
            onPress={() =>
              router.push({
                pathname: "/dealer/dealer-dashboard",
                params: { id: vehicle.id },
              })
            }
            theme={theme}
          />

          <DealerButton
            label="Dealer Stock Hub"
            onPress={() => router.push("/dealer/dealer-stock")}
            theme={theme}
          />

          <DealerButton
            label="Dealer Finance Hub"
            onPress={() =>
              router.push({
                pathname: "/dealer/dealer-finance",
                params: { id: vehicle.id },
              })
            }
            theme={theme}
          />

          <DealerButton
            label="Dealer CRM Hub"
            onPress={() =>
              router.push({
                pathname: "/dealer/dealer-crm",
                params: { id: vehicle.id },
              })
            }
            theme={theme}
          />

          <DealerButton
            label="Dealer Marketing Hub"
            onPress={() =>
              router.push({
                pathname: "/dealer/dealer-marketing",
                params: { id: vehicle.id },
              })
            }
            theme={theme}
          />

          <DealerButton
            label="Dealer Risk Hub"
            onPress={() =>
              router.push({
                pathname: "/dealer/dealer-risk",
                params: { id: vehicle.id },
              })
            }
            theme={theme}
          />

          <DealerButton
            label="Dealer Sales Hub"
            onPress={() =>
              router.push({
                pathname: "/dealer/dealer-sales",
                params: { id: vehicle.id },
              })
            }
            theme={theme}
          />
        </View>

        {/* ⭐ AI MODULES */}
        <SupernovaCard title="AI Price Suggestion" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            AI Price Suggestion
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            £{ai.priceVehicle(vehicle)}
          </Text>
        </SupernovaCard>

        <SupernovaCard title="Flip Advice" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Flip Advice
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {ai.flipAdvice(vehicle)}
          </Text>
        </SupernovaCard>

        <SupernovaCard title="MOT Risk Score" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            MOT Risk Score
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            {ai.motRiskScore(vehicle).toFixed(0)}%
          </Text>
        </SupernovaCard>

        <SupernovaCard title="Profit Forecast" glow>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
            Profit Forecast
          </Text>
          <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
            £{ai.profitForecast(vehicle)}
          </Text>
        </SupernovaCard>

        <SupernovaCard title="Auto‑Generated Listing" glow>
          <Text
            style={{
              color: theme.secondary,
              fontSize: 16,
              fontWeight: "700",
              marginBottom: 6,
            }}
          >
            Auto‑Generated Listing
          </Text>
          <Text style={{ color: theme.text, fontSize: 15 }}>
            {ai.autoWriteListing(vehicle)}
          </Text>
        </SupernovaCard>

        {/* ⭐ ANALYTICS MODULES */}
        <DealerCard title="Market Heat Engine" theme={theme}>
          <MarketHeatEngine vehicles={vehicles} theme={theme} />
        </DealerCard>

        <DealerCard title="Risk Radar" theme={theme}>
          <RiskRadar vehicles={vehicles} theme={theme} />
        </DealerCard>

        <DealerCard title="Profit Consistency Score" theme={theme}>
          <ProfitConsistency vehicles={vehicles} theme={theme} />
        </DealerCard>

        <DealerCard title="MOT Health Index" theme={theme}>
          <MotHealthIndex vehicles={vehicles} theme={theme} />
        </DealerCard>

        <DealerCard title="Flip Time Analyzer" theme={theme}>
          <FlipTimeAnalyzer vehicles={vehicles} theme={theme} />
        </DealerCard>

        <DealerCard title="Price Efficiency Score" theme={theme}>
          <PriceEfficiency vehicles={vehicles} theme={theme} />
        </DealerCard>

        <DealerCard title="Smart Alerts" theme={theme}>
          <SmartAlerts vehicles={vehicles} theme={theme} />
        </DealerCard>

        <DealerCard title="FlipPilot Business Score" theme={theme}>
          <BusinessScore vehicles={vehicles} theme={theme} />
        </DealerCard>

        <View style={{ height: 80 }} />
      </ScrollView>

      <DealerFab vehicleId={vehicle.id} />
    </View>
  );
}

/* -------------------------------------------------------
   ⭐ Dealer Card Component
------------------------------------------------------- */
function DealerCard({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: any;
}) {
  return (
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
      <Text style={{ color: theme.white, fontSize: 20, fontWeight: "700" }}>
        {title}
      </Text>
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

/* -------------------------------------------------------
   ⭐ Dealer Button Component
------------------------------------------------------- */
function DealerButton({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: any;
}) {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: theme.accent,
        padding: 16,
        borderRadius: 14,
        marginBottom: 12,
      }}
      onPress={onPress}
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
