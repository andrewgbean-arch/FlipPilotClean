// src/features/dealer-ai/dashboards/PlanetDashboard.tsx
import React from "react";
import { ScrollView, Text } from "react-native";
import AICard from "../../../components/AICard";

type PlanetDashboardProps = {
  brain: any;
};

export default function PlanetDashboard({ brain }: PlanetDashboardProps) {
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
        Planetary Automotive AI Dashboard
      </Text>

      <AICard title="Simulation" data={brain.brain.simulation[0]} />
      <AICard title="Demand Forecast" data={brain.brain.demandForecast[0]} />
      <AICard title="EV Shift" data={brain.brain.evShift[0]} />
      <AICard title="Balancing" data={brain.brain.balancing[0]} />
      <AICard
        title="Foresight Status"
        data={{ status: brain.brain.foresightBrain.foresightStatus }}
      />
    </ScrollView>
  );
}
