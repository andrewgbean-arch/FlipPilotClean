// src/features/dealer-ai/dashboards/OEMDashboard.tsx
import React from "react";
import { ScrollView, Text } from "react-native";
import AICard from "../../../components/AICard";
type OEMDashboardProps = {
  brain: any;
};
export default function OEMDashboard({ brain }: OEMDashboardProps) {

  return (
    <ScrollView>
      <Text style={{ color: "#FFD700", fontSize: 22, fontWeight: "700", marginBottom: 20 }}>
        OEM Ecosystem AI Dashboard
      </Text>

      <AICard title="OEM Intelligence" data={brain.brain.oemIntel} />
      <AICard title="Supply Chain" data={brain.brain.supplyChain} />
      <AICard title="Market Model" data={brain.brain.marketModel} />
      <AICard title="Strategy" data={brain.brain.strategyEngine} />
    </ScrollView>
  );
}
