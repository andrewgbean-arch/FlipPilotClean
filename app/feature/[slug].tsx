import { useLocalSearchParams } from "expo-router";
import {
  AirplaneTilt,
  ClockCounterClockwise,
  CurrencyGbp,
  FloppyDisk,
  GearSix,
  Heart,
  Lightbulb,
  Lightning,
  Megaphone,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/useTheme";

// The Explore tab hands over the feature's title as `slug`. The route parameters stay as they
// were, so the icon is looked up here by title, matching the one Explore shows for it.
const ICONS: Record<string, PhosphorIcon> = {
  "Market Check": CurrencyGbp,
  "Save Flip": FloppyDisk,
  Favourites: Heart,
  History: ClockCounterClockwise,
  "Advertising Hub": Megaphone,
  "Supernova AI Pricing": Lightning,
  "FlipPilot Method": AirplaneTilt,
  "Pro Tips": Lightbulb,
  "Advanced Rules": GearSix,
};

// The copy is written as plain lines, with "•" for bullets. Show it as a heading, paragraphs and a list.
function parseContent(raw: string) {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: { kind: "text" | "bullet" | "heading"; text: string }[] = [];
  for (const line of lines) {
    if (line.startsWith("•")) blocks.push({ kind: "bullet", text: line.replace(/^•\s*/, "") });
    else if (line.endsWith(":")) blocks.push({ kind: "heading", text: line.slice(0, -1) });
    else blocks.push({ kind: "text", text: line });
  }
  return blocks;
}

export default function FeatureDetailScreen() {
  const { slug, content } = useLocalSearchParams<{
    slug: string;
    content: string;
    icon: string;
  }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const Icon = (slug && ICONS[slug]) || Lightbulb;
  const blocks = parseContent(content ?? "");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 40 }]}
    >
      <View style={[styles.iconBadge, { backgroundColor: theme.card, borderColor: theme.goldSoftGlow }]}>
        <Icon size={32} color={theme.gold} />
      </View>

      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        {slug}
      </Text>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        {blocks.map((block, i) =>
          block.kind === "bullet" ? (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: theme.gold }]} />
              <Text style={[styles.body, styles.bulletText, { color: theme.text }]}>{block.text}</Text>
            </View>
          ) : block.kind === "heading" ? (
            <Text key={i} style={[styles.heading, { color: theme.text }]}>
              {block.text}
            </Text>
          ) : (
            <Text key={i} style={[styles.body, { color: theme.text }]}>
              {block.text}
            </Text>
          )
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    alignItems: "stretch",
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
  },
  bulletText: {
    flex: 1,
  },
});
