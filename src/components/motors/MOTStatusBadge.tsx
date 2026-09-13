import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const GREEN = "#4CAF50";
const ORANGE = "#FF9800";
const RED = "#F44336";
const GOLD = "#FFD700";

export default function MOTStatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;

  const color =
    status.toLowerCase().includes("valid") ? GREEN :
    status.toLowerCase().includes("expire") ? ORANGE :
    RED;

  return (
    <View style={[styles.badge, { borderColor: GOLD }]}>
      <MaterialCommunityIcons name="file-check-outline" size={16} color={color} />
      <Text style={[styles.text, { color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  text: {
    fontSize: 13,
    fontWeight: "700",
  },
});
