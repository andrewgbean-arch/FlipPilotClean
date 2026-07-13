import React from "react";
import { View, Pressable } from "react-native";

import ThemedText from "@/styles/theme/ThemedText";
import ThemedView from "@/styles/theme/ThemedView";
import { useTheme } from "@/context/ThemeContext";

import { CarRecord } from "../../../src/car/carTypes";
import { getCarProfit, getCarROI, getCarFlipScore } from "../../../src/car/carUtils";

interface CarCardProps {
  car: CarRecord;
  onPress?: () => void;
}

export const CarCard: React.FC<CarCardProps> = ({ car, onPress }) => {
  const theme = useTheme();
  const profit = getCarProfit(car);
  const roi = getCarROI(car);
  const score = getCarFlipScore(car);

  return (
    <Pressable
      onPress={onPress}
      style={{
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: 3,
        borderColor: theme.goldDeep,
        backgroundColor: theme.card,
      }}
    >
      <ThemedText style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}>
        {car.make} {car.model} ({car.year})
      </ThemedText>

      <ThemedText style={{ fontSize: 14, color: theme.text }}>
        Mileage: {car.mileage.toLocaleString()} miles
      </ThemedText>

      <ThemedText style={{ fontSize: 14, color: theme.text }}>
        Profit: £{profit.toFixed(2)} | ROI: {roi.toFixed(1)}%
      </ThemedText>

      <ThemedText style={{ fontSize: 14, color: theme.accent }}>
        FlipScore: {score}/100
      </ThemedText>
    </Pressable>
  );
};
