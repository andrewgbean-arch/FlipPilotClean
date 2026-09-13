import React from "react";
import { StyleSheet, View, Text } from "react-native";

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------
interface NearestFair {
  name: string;
  distance: number;
  nextOpen: string;
}

interface BootFairRadarProps {
  theme: any;
  nearest: NearestFair | null;
}

// ------------------------------------------------------
// COMPONENT
// ------------------------------------------------------
export default function BootFairRadar({
  theme,
  nearest,
}: BootFairRadarProps) {
  if (!nearest) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.goldDeep,
          borderWidth: 3,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.accent }]}>
        Boot Fair Radar
      </Text>

      <Text style={[styles.text, { color: theme.text }]}>
        {nearest.name}
      </Text>

      <Text style={[styles.text, { color: theme.text }]}>
        Distance: {nearest.distance.toFixed(1)} km
      </Text>

      <Text style={[styles.text, { color: theme.text }]}>
        Next: {nearest.nextOpen}
      </Text>

      <Text style={[styles.tip, { color: theme.accent }]}>
        {nearest.distance < 10
          ? "Close enough to visit today"
          : "Bit of a drive, boss"}
      </Text>
    </View>
  );
}

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    width: "92%",
    alignSelf: "center",
    padding: 18,
    borderRadius: 20,
    marginTop: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  text: {
    fontSize: 15,
    marginBottom: 4,
    fontWeight: "600",
  },
  tip: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
  },
});

