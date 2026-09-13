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

import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import DealerFab from "@/components/dealer/DealerFab";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import AffordabilitySummaryCard from "@/components/dealer/AffordabilitySummaryCard";
import { matchEngine } from "@/features/dealer-ai/MatchEngine";

import FinanceSuiteSummaryCard from "@/components/dealer/FinanceSuiteSummaryCard";

import { useLocalSearchParams, router } from "expo-router";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

export default function DealerCRMHub() {
  const theme = useTheme();
  const ai = useDealerAI();

  const { id } = useLocalSearchParams();
  const { vehicles, dealerMode, setDealerMode, setFlashTrigger } =
    useVehicleHistory();

  /* -------------------------------------------------------
     ⭐ Auto‑activate Dealer Mode
  ------------------------------------------------------- */
  useEffect(() => {
    if (!dealerMode && vehicles.length > 0) {
      setDealerMode(true);
      setFlashTrigger(Date.now());
    }
  }, [dealerMode, vehicles.length]);

  /* -------------------------------------------------------
     ⭐ Bulletproof vehicle lookup
  ------------------------------------------------------- */
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

/* ⭐ Buyer placeholder for AffordabilityEngine */
const buyer: any = {
  income: 2800,
  expenses: 1400,
  deposit: 500,
  creditScore: 620,
  riskScore: 0.3,
};

/* ⭐ CRM AI Intelligence */
const buyerIntent = ai.buyerIntentScore(vehicle);
const followUpScore = ai.followUpUrgency(vehicle);
const communicationScore = ai.communicationQuality(vehicle);
const testDriveLikelihood = ai.testDriveProbability(vehicle);
const buyerProfile = ai.buyerProfile(vehicle);


  return (
    <View style={{ flex: 1 }}>
      <DealerNeonHeader
  title="Dealer Screen"
  subtitle="AI‑Powered Intelligence"
/>


      <ScrollView style={{ padding: 20 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700" as TextStyle["fontWeight"],
            color: theme.accent,
            marginBottom: 20,
          }}
        >
          Dealer CRM Hub
        </Text>

        {/* ⭐ FinanceSuite SummaryCard */}
        <FinanceSuiteSummaryCard
          vehicle={vehicle}
          buyer={{}} // placeholder buyer until CRM wiring
          
        />
<AffordabilitySummaryCard vehicle={vehicle} buyer={buyer} theme={theme} />


       {/* ⭐ Buyer Intent */}
<SupernovaCard title="Buyer Intent Score" glow>
  <Text
    style={{
      color: theme.text,
      fontWeight: "800",
      fontSize: 18,
      marginBottom: 6,
    }}
  >
    Buyer Intent Score
  </Text>
  <Text
    style={{
      color: theme.secondary,
      fontSize: 16,
      fontWeight: "600",
    }}
  >
    {buyerIntent}/100 likelihood of purchase
  </Text>
</SupernovaCard>

{/* ⭐ Follow Up */}
<SupernovaCard title="Follow‑Up Urgency" glow>
  <Text
    style={{
      color: theme.text,
      fontWeight: "800",
      fontSize: 18,
      marginBottom: 6,
    }}
  >
    Follow‑Up Urgency
  </Text>
  <Text
    style={{
      color: theme.secondary,
      fontSize: 16,
      fontWeight: "600",
    }}
  >
    {followUpScore}/100 urgency rating
  </Text>
</SupernovaCard>

{/* ⭐ Communication */}
<SupernovaCard title="Communication Quality" glow>
  <Text
    style={{
      color: theme.text,
      fontWeight: "800",
      fontSize: 18,
      marginBottom: 6,
    }}
  >
    Communication Quality
  </Text>
  <Text
    style={{
      color: theme.secondary,
      fontSize: 16,
      fontWeight: "600",
    }}
  >
    {communicationScore}/100 buyer engagement
  </Text>
</SupernovaCard>

{/* ⭐ Test Drive */}
<SupernovaCard title="Test Drive Probability" glow>
  <Text
    style={{
      color: theme.text,
      fontWeight: "800",
      fontSize: 18,
      marginBottom: 6,
    }}
  >
    Test Drive Probability
  </Text>
  <Text
    style={{
      color: theme.secondary,
      fontSize: 16,
      fontWeight: "600",
    }}
  >
    {testDriveLikelihood}% chance of booking
  </Text>
</SupernovaCard>

{/* ⭐ Buyer Profile */}
<SupernovaCard title="Buyer Profile" glow>
  <Text
    style={{
      color: theme.text,
      fontWeight: "800",
      fontSize: 18,
      marginBottom: 6,
    }}
  >
    Buyer Profile
  </Text>
  <Text
    style={{
      color: theme.secondary,
      fontSize: 16,
      fontWeight: "600",
    }}
  >
    {buyerProfile}
  </Text>
</SupernovaCard>

{/* ⭐ Match Engine */}
<SupernovaCard title="Match Score" glow>
  <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
    Match Score
  </Text>
  <Text style={{ color: theme.secondary, fontSize: 16, fontWeight: "600" }}>
    {matchEngine.evaluate(vehicle, buyer, ai).score}/100 overall match
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
