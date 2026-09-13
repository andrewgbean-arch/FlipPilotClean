import React, { useEffect, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TextStyle } from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { useDealerAI } from "@/features/dealer-ai/DealerAIContext";
import DealerFab from "@/components/dealer/DealerFab";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useLocalSearchParams } from "expo-router";

export default function DealerClosingScreen() {
  const theme = useTheme();
  const ai = useDealerAI();

  const { id } = useLocalSearchParams();
  const { vehicles, dealerMode, setDealerMode, setFlashTrigger } =
    useVehicleHistory();

  useEffect(() => {
    if (!dealerMode && vehicles.length > 0) {
      setDealerMode(true);
      setFlashTrigger(Date.now());
    }
  }, [dealerMode, vehicles.length]);

  const vehicle = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return null;
    if (!id) return vehicles[0];

    const found = vehicles.find(v => String(v.id) === String(id));
    return found ?? vehicles[0];
  }, [vehicles, id]);

  if (!vehicle) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", color: theme.text }}>
          Loading vehicle…
        </Text>
      </View>
    );
  }

  const styles = StyleSheet.create({
    header: {
      fontSize: 26,
      fontWeight: "900" as TextStyle["fontWeight"],
      color: theme.accent,
      marginBottom: 10,
    },
    title: {
      color: theme.text,
      fontWeight: "800" as TextStyle["fontWeight"],
      fontSize: 18,
      marginBottom: 6,
    },
    value: {
      color: theme.secondary,
      fontSize: 16,
      fontWeight: "600" as TextStyle["fontWeight"],
    },
  });

  // Safe defaults for DealerAI
  const lead: any = {};
  const buyer: any = {};

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ padding: 20 }}>
        {/* ⭐ FIX: Add required props */}
        <DealerNeonHeader
          title="Deal‑Closing Engine"
          subtitle="AI‑Driven Sales Psychology & Strategy"
        />

        {/* Closing Probability */}
        <SupernovaCard title="Closing Probability" glow>
          <Text style={styles.value}>
            {ai.closingProbability(vehicle, lead)}%
          </Text>
        </SupernovaCard>

        {/* Buyer Emotion */}
        <SupernovaCard title="Buyer Emotion" glow>
          <Text style={styles.value}>{ai.buyerEmotion(lead)}</Text>
        </SupernovaCard>

        {/* Best Next Move */}
        <SupernovaCard title="Best Next Move" glow>
          <Text style={styles.value}>
            {ai.dealClosingMove(vehicle, lead, buyer)}
          </Text>
        </SupernovaCard>

        {/* AI Closing Script */}
        <SupernovaCard title="AI Closing Script" glow>
          <Text style={styles.value}>
            {ai.followUpScript(vehicle, lead, buyer)}
          </Text>
        </SupernovaCard>

        <View style={{ height: 80 }} />
      </ScrollView>

      <DealerFab vehicleId={vehicle.id} />
    </View>
  );
}
