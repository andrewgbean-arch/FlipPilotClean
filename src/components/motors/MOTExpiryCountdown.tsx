import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

export default function MOTExpiryCountdown({ expiry }: { expiry?: string | null }) {
  if (!expiry) return null;

  const expiryDate = new Date(expiry);
  const today = new Date();
  const diff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name="calendar" size={16} color={GOLD} />
      <Text style={styles.text}>
        {diff > 0 ? `${diff} days until expiry` : "Expired"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { color: SILVER, fontSize: 13 },
});
