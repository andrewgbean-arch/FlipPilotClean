import React, { useMemo } from "react";
import { ScrollView, View, Text } from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import { useLocalSearchParams } from "expo-router";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useDealerAI } from "@/features/dealer-ai/DealerAIContext";

import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import DealerFab from "@/components/dealer/DealerFab";

import { matchEngine } from "@/features/dealer-ai/MatchEngine";
import MatchResultCard from "@/components/dealer/MatchResultCard";

export default function DealerMatchScreen() {
  const theme = useTheme();
  const ai = useDealerAI();
  const { vehicles } = useVehicleHistory();

  const buyer = {
    income: 2800,
    expenses: 1400,
    deposit: 500,
    creditScore: 620,
    riskScore: 0.3,
  };

  const results = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return [];
    return matchEngine.matchAll(vehicles, buyer, ai);
  }, [vehicles]);

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
          Dealer Match Engine
        </Text>

        {results.map(result => (
          <MatchResultCard key={result.vehicle.id} result={result} theme={theme} />
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      <DealerFab vehicleId={results[0]?.vehicle?.id} />
    </View>
  );
}
