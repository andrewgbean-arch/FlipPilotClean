import React from "react";
import { View } from "react-native";

import ThemedText from "@/styles/theme/ThemedText";
import ThemedView from "@/styles/theme/ThemedView";
import { useTheme } from "@/context/ThemeContext";

import { CarRecord } from "../carTypes";
import { getCarProfit, getCarROI, getCarFlipScore } from "../carUtils";

interface CarStatPanelProps {
  cars: CarRecord[];
}

export const CarStatPanel: React.FC<CarStatPanelProps> = ({ cars }) => {
  const theme = useTheme();

  if (!cars.length) {
    return (
      <View style={{ marginTop: 20, padding: 18 }}>
        <ThemedText style={{ color: theme.text }}>No cars added yet.</ThemedText>
      </View>
    );
  }

  const profits = cars.map(getCarProfit);
  const rois = cars.map(getCarROI);
  const scores = cars.map(getCarFlipScore);

  const avgProfit =
    profits.reduce((a: number, b: number) => a + b, 0) / profits.length;

  const avgROI =
    rois.reduce((a: number, b: number) => a + b, 0) / rois.length;

  const avgScore =
    scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

  return (
    <View
      style={{
        marginTop: 20,
        marginBottom: 16,
        padding: 18,
        borderRadius: 18,
        borderWidth: 3,
        borderColor: theme.goldDeep,
        backgroundColor: theme.card,
      }}
    >
      <ThemedText
        style={{
          fontSize: 20,
          fontWeight: "900",
          color: theme.accent,
          marginBottom: 8,
        }}
      >
        🚗 Car Flip Overview
      </ThemedText>

      <ThemedText style={{ fontSize: 15, color: theme.text, marginBottom: 4 }}>
        Avg Profit: £{avgProfit.toFixed(2)}
      </ThemedText>

      <ThemedText style={{ fontSize: 15, color: theme.text, marginBottom: 4 }}>
        Avg ROI: {avgROI.toFixed(1)}%
      </ThemedText>

      <ThemedText style={{ fontSize: 15, color: theme.text, marginBottom: 4 }}>
        Avg FlipScore: {avgScore.toFixed(1)}/100
      </ThemedText>
    </View>
  );
};
