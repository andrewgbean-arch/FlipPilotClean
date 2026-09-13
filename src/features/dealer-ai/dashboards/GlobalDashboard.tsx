// src/features/dealer-ai/dashboards/GlobalDashboard.tsx
import React from "react";
import { ScrollView, Text } from "react-native";
import AICard from "../../../components/AICard";
type GlobalDashboardProps = {
  brain: any;
};
export default function GlobalDashboard({ brain }: GlobalDashboardProps) {

  return (
    <ScrollView>
      <Text style={{ color: "#FFD700", fontSize: 22, fontWeight: "700", marginBottom: 20 }}>
        Global Automotive AI Dashboard
      </Text>

      <AICard title="Global Intel" data={brain.brain.globalIntel} />
      <AICard title="Supply Chain" data={brain.brain.supplyChain} />
      <AICard title="Global Stress" data={brain.brain.globalStress} />
      <AICard title="Stock Strategy" data={brain.brain.stockStrategy} />
    </ScrollView>
  );
}
