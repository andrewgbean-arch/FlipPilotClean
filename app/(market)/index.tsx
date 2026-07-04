import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";

const COLORS = {
  bg: "#0A1931",
  card: "#112240",
  gold: "#FFD700",
  silver: "#AAB4C3",
  darkBorder: "#1C2F4A",
};

// Enable smooth animation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MarketTab() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      <Section title="🔥 Trending Flips">
        <TrendingFlips />
      </Section>

      <Section title="🛒 Categories">
        <Categories />
      </Section>

      <Section title="💾 Saved Flips">
        <SavedFlips />
      </Section>

      <Section title="📦 Barcode History">
        <BarcodeHistory />
      </Section>

      <Section title="🤖 AI Insights">
        <AIInsights />
      </Section>
    </ScrollView>
  );
}

/* ------------------------------
   SECTION WRAPPER (Animated)
--------------------------------*/
function Section({ title, children }: any) {
  const [open, setOpen] = useState(true);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);
  };

  return (
    <View style={styles.section}>
      <Pressable onPress={toggle} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionArrow}>{open ? "▼" : "▲"}</Text>
      </Pressable>

      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

/* ------------------------------
   TRENDING FLIPS (Static Demo)
--------------------------------*/
function TrendingFlips() {
  const items = [
    { name: "Vintage Console", roi: 120 },
    { name: "Designer Jacket", roi: 85 },
    { name: "Retro Toys Bundle", roi: 140 },
  ];

  return (
    <View>
      {items.map((i, idx) => (
        <View key={idx} style={styles.trendingCard}>
          <Text style={styles.trendingName}>{i.name}</Text>
          <Text style={styles.trendingROI}>ROI {i.roi}%</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------
   CATEGORIES
--------------------------------*/
function Categories() {
  const cats = [
    "Toys",
    "Electronics",
    "Clothing",
    "Collectibles",
    "Home",
    "Books",
    "Other",
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {cats.map((c) => (
        <View key={c} style={styles.categoryChip}>
          <Text style={styles.categoryText}>{c}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/* ------------------------------
   SAVED FLIPS (Placeholder)
--------------------------------*/
function SavedFlips() {
  return (
    <Text style={styles.placeholder}>
      Saved flips will appear here soon boss.
    </Text>
  );
}

/* ------------------------------
   BARCODE HISTORY (Placeholder)
--------------------------------*/
function BarcodeHistory() {
  return (
    <Text style={styles.placeholder}>
      Your barcode lookup history will show here.
    </Text>
  );
}

/* ------------------------------
   AI INSIGHTS (Static Demo)
--------------------------------*/
function AIInsights() {
  const insights = [
    "Top 5 flips under £5",
    "Items rising this week",
    "Categories cooling down",
    "Best places to source today",
  ];

  return (
    <View>
      {insights.map((i, idx) => (
        <View key={idx} style={styles.aiCard}>
          <Text style={styles.aiText}>🤖 {i}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------
   STYLES
--------------------------------*/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
  },

  section: {
    marginBottom: 22,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    overflow: "hidden",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "rgba(255,215,0,0.08)",
  },

  sectionTitle: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: "900",
  },

  sectionArrow: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: "900",
  },

  sectionBody: {
    padding: 16,
  },

  trendingCard: {
    backgroundColor: COLORS.darkBorder,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },

  trendingName: {
    color: COLORS.silver,
    fontWeight: "700",
    fontSize: 15,
  },

  trendingROI: {
    color: COLORS.gold,
    fontWeight: "900",
    marginTop: 4,
  },

  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.card,
    marginRight: 10,
  },

  categoryText: {
    color: COLORS.gold,
    fontWeight: "700",
  },

  placeholder: {
    color: COLORS.silver,
    fontStyle: "italic",
  },

  aiCard: {
    backgroundColor: COLORS.darkBorder,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },

  aiText: {
    color: COLORS.gold,
    fontWeight: "700",
  },
});
