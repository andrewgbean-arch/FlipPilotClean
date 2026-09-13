// src/features/dealer-ai/dashboards/DealerDashboard.tsx
import React from "react";
import { ScrollView, Text } from "react-native";
import AICard from "../../../components/AICard";
type DealerDashboardProps = {
  brain: any;
};

export default function DealerDashboard({ brain }: DealerDashboardProps) {

  return (
    <ScrollView>
      <Text style={{ color: "#FFD700", fontSize: 22, fontWeight: "700", marginBottom: 20 }}>
        Dealer AI Dashboard
      </Text>

      <AICard title="Status" data={{ status: brain.status }} />
      <AICard title="Pricing" data={brain.brain.pricing} />
      <AICard title="Profit" data={brain.brain.profitAnalysis} />
      <AICard title="Rotation" data={brain.brain.rotationStrategy} />
      <AICard title="Buyer Matching" data={brain.brain.buyerMatching} />
    </ScrollView>
  );
}
