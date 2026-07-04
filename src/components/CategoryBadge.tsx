import React from "react";
import { StyleSheet, View } from "react-native";
import ThemedText from "./ThemedText";

const COLORS: Record<string, string> = {
  Electronics: "#4A6FFF",
  Toys: "#FF6F61",
  Fashion: "#C56FFF",
  Books: "#A67C52",
  Tools: "#888888",
  Unknown: "#555555",
};

const ICONS: Record<string, string> = {
  Electronics: "⚡",
  Toys: "🧸",
  Fashion: "👗",
  Books: "📚",
  Tools: "🔧",
  Unknown: "❓",
};

export default function CategoryBadge({ category }: { category: string }) {
  const color = COLORS[category] ?? COLORS.Unknown;
  const icon = ICONS[category] ?? ICONS.Unknown;

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <ThemedText style={styles.text}>{icon} {category}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  text: {
    color: "white",
    fontWeight: "700",
    fontSize: 12,
  },
});
