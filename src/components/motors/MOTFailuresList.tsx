import React from "react";
import { View, Text, StyleSheet } from "react-native";

const RED = "#F44336";
const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

export default function MOTFailuresList({ failures }: { failures?: string[] | null }) {
  if (!failures || failures.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Failures</Text>
      {failures.map((f, i) => (
        <Text key={i} style={styles.item}>• {f}</Text>
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
    borderColor: RED,
    marginTop: 12,
  },
  title: { color: RED, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  item: { color: SILVER, fontSize: 13, marginTop: 2 },
});
