import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord"; // ⭐ FIXED



const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

export default function MOTInsightsPanel({ mot }: { mot?: FlipRecord["mot"] }) {
  if (!mot) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>MOT Insights</Text>

      <View style={styles.row}>
        <MaterialCommunityIcons name="file-check-outline" size={20} color={GOLD} />
        <Text style={styles.meta}>Status: {mot.motStatus ?? "Unknown"}</Text>
      </View>

      <View style={styles.row}>
        <MaterialCommunityIcons name="calendar" size={20} color={GOLD} />
        <Text style={styles.meta}>Expiry: {mot.motExpiry ?? "Unknown"}</Text>
      </View>

      <View style={styles.row}>
        <MaterialCommunityIcons name="car" size={20} color={GOLD} />
        <Text style={styles.meta}>Mileage: {mot.mileage?.toLocaleString() ?? "Unknown"}</Text>
      </View>

      <View style={styles.row}>
        <MaterialCommunityIcons name="account" size={20} color={GOLD} />
        <Text style={styles.meta}>Keepers: {mot.keepers ?? "Unknown"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: GOLD,
    marginTop: 20,
  },
  title: { color: GOLD, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  meta: { color: SILVER, fontSize: 14 },
});
