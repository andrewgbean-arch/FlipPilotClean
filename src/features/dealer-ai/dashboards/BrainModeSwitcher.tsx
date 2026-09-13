// src/features/dealer-ai/BrainModeSwitcher.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FlipPilotMode } from "../DealerIntelligenceAPI";

type BrainModeSwitcherProps = {
  mode: FlipPilotMode;
  onChange: (mode: FlipPilotMode) => void;
};

const modes: FlipPilotMode[] = ["dealer", "group", "oem", "global", "planet"];


export default function BrainModeSwitcher({ mode, onChange }: BrainModeSwitcherProps) {

  return (
    <View style={styles.container}>
      {modes.map(m => (
        <TouchableOpacity
          key={m}
          style={[styles.button, mode === m && styles.active]}
          onPress={() => onChange(m)}
        >
          <Text style={styles.text}>{m.toUpperCase()}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#0A1128",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  active: {
    backgroundColor: "#FFD700",
  },
  text: {
    color: "#fff",
    fontWeight: "700",
  },
});
