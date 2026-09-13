import React, { useEffect, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import { useDealerAI } from "@/features/dealer-ai/DealerAIContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useLocalSearchParams } from "expo-router";

export default function DealerPsychologyScreen() {
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

  /* -------------------------------------------------------
     ⭐ Fallback guard
  ------------------------------------------------------- */
  if (!vehicle) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", color: theme.text }}>
          Loading vehicle…
        </Text>
      </View>
    );
  }

  /* -------------------------------------------------------
     ⭐ Safe defaults for lead + buyer
     (FlipRecord does NOT contain these fields)
  ------------------------------------------------------- */
  const lead: any = {};
  const buyer: any = {};

  /* -------------------------------------------------------
     ⭐ Styles
  ------------------------------------------------------- */
  const styles = StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      padding: 18,
      borderRadius: 14,
      marginTop: 22,
      borderWidth: 1,
      borderColor: theme.accent + "55",
    },
    title: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 18,
      marginBottom: 6,
    },
    value: {
      color: theme.secondary,
      fontSize: 16,
      fontWeight: "600",
    },
    header: {
      fontSize: 26,
      fontWeight: "900",
      color: theme.accent,
      marginBottom: 10,
    },
  });

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={styles.header}>Buyer Psychology Hub</Text>

      <View style={styles.card}>
        <Text style={styles.title}>Emotion Detection</Text>
        <Text style={styles.value}>{ai.buyerEmotion(lead)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Personality Profile</Text>
        <Text style={styles.value}>{ai.buyerPersonalityProfile(lead)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Funnel Stage</Text>
        <Text style={styles.value}>{ai.salesFunnelStage(lead)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Recommended Follow‑Up Timing</Text>
        <Text style={styles.value}>{ai.followUpTiming(lead)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>AI Follow‑Up Script</Text>
        <Text style={styles.value}>{ai.followUpScript(vehicle, lead, buyer)}</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
