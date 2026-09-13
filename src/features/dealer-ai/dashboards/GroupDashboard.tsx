// src/features/dealer-ai/dashboards/GroupDashboard.tsx
import React from "react";
import { ScrollView, Text } from "react-native";
import AICard from "../../../components/AICard";

type GroupDashboardProps = {
  brain: any;
};

export default function GroupDashboard({ brain }: GroupDashboardProps) {
  return (
    <ScrollView>
      <Text
        style={{
          color: "#FFD700",
          fontSize: 22,
          fontWeight: "700",
          marginBottom: 20,
        }}
      >
        Dealer Group AI Dashboard
      </Text>

      <AICard title="Operations" data={brain.brain.operationsBrain} />
      <AICard title="Routing" data={brain.brain.routingEngine} />
      <AICard title="Logistics" data={brain.brain.logisticsOptimizer} />
      <AICard title="Regional Intelligence" data={brain.brain.regionalIntelligence} />
    </ScrollView>
  );
}
