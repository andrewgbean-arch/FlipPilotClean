import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { CloudRain, Sun, Tent, Wind } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/styles/useTheme";
import WeatherCard from "@/components/WeatherCard";

const TIPS: { Icon: PhosphorIcon; text: string }[] = [
  { Icon: Sun, text: "Clear skies mean more sellers and more bargains." },
  { Icon: Wind, text: "Light wind keeps stalls comfortable. Weigh down anything that can blow away." },
  { Icon: CloudRain, text: "Avoid heavy rain. Sellers pack up early." },
  { Icon: Tent, text: "Warm mornings bring out casual sellers with hidden gems." },
];

export default function WeatherScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        <Text style={[styles.intro, { color: theme.muted }]}>
          Live conditions near you, for planning boot fair trips.
        </Text>

        <WeatherCard theme={theme} />

        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
          Boot fair tips
        </Text>

        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          {TIPS.map(({ Icon, text }, i) => (
            <View
              key={text}
              style={[styles.tipRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
            >
              <Icon size={22} color={theme.muted} />
              <Text style={[styles.tipText, { color: theme.text }]}>{text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  intro: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 28, marginBottom: 10 },
  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  tipText: { flex: 1, fontSize: 15, lineHeight: 22 },
});
