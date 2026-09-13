import React from "react";
import { View, Text, StyleSheet } from "react-native";

const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

export default function MOTAdvisoriesList({ advisories }: { advisories?: string[] | null }) {
  if (!advisories || advisories.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Advisories</Text>
      {advisories.map((a, i) => (
        <Text key={i} style={styles.item}>• {a}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: GOLD,
    marginTop: 12,
  },
  title: { color: GOLD, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  item: { color: SILVER, fontSize: 13, marginTop: 2 },
});

