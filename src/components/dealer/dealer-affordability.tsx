import React, { useMemo } from "react";
import { ScrollView, View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import DealerFab from "@/components/dealer/DealerFab";

import AffordabilitySummaryCard from "@/components/dealer/AffordabilitySummaryCard";

export default function DealerAffordabilityScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams();
  const { vehicles } = useVehicleHistory();

  const vehicle = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return null;
    if (!id) return vehicles[0];
    return vehicles.find(v => String(v.id) === String(id)) ?? vehicles[0];
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

  const buyer = {
    income: 2800,
    expenses: 1400,
    deposit: 500,
    creditScore: 620,
    riskScore: 0.3,
  };

  return (
    <View style={{ flex: 1 }}>
      <DealerNeonHeader
  title="Dealer Screen"
  subtitle="AI‑Powered Intelligence"
/>


      <ScrollView style={{ padding: 20 }}>
        <Text
          style={{
            fontSize: 26,
            fontWeight: "800",
            color: theme.accent,
            marginBottom: 20,
          }}
        >
          Buyer Affordability Hub
        </Text>

        <AffordabilitySummaryCard vehicle={vehicle} buyer={buyer} theme={theme} />

        <View style={{ height: 80 }} />
      </ScrollView>

      <DealerFab vehicleId={vehicle.id} />
    </View>
  );
}
