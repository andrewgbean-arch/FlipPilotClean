import React from "react";
import { StyleSheet } from "react-native";
import ThemedView from "./ThemedView";
import ThemedText from "./ThemedText";

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
    <ThemedView
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.goldDeep,
          borderWidth: 3,
        },
      ]}
    >
      <ThemedText style={[styles.title, { color: theme.accent }]}>
        Boot Fair Radar
      </ThemedText>

      <ThemedText style={styles.text}>{nearest.name}</ThemedText>
      <ThemedText style={styles.text}>
        Distance: {nearest.distance.toFixed(1)} km
      </ThemedText>
      <ThemedText style={styles.text}>
        Next: {nearest.nextOpen}
      </ThemedText>

      <ThemedText style={[styles.tip, { color: theme.accent }]}>
        {nearest.distance < 10
          ? "Close enough to visit today"
          : "Bit of a drive, boss"}
      </ThemedText>
    </ThemedView>
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
    color: "white",
    fontSize: 15,
    marginBottom: 4,
  },
  tip: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
  },
});
