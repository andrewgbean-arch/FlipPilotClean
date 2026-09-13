import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function AICard({ title, data }: { title: string; data: any }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {Object.entries(data).map(([key, value]) => (
        <View key={key} style={styles.row}>
          <Text style={styles.key}>{key}</Text>
          <Text style={styles.value}>{String(value)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0A1128",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  title: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  key: {
    color: "#fff",
    opacity: 0.8,
  },
  value: {
    color: "#fff",
    fontWeight: "600",
  },
});
