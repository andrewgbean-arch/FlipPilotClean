import { useState, useEffect } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  ActivityIndicator,
} from "react-native";

import axios from "axios";
import { useRouter } from "expo-router";

import { useTheme } from "../../src/context/ThemeContext";
import { ThemedText } from "../../src/styles/theme/ThemedText";
import ThemedView from "../../src/styles/theme/ThemedView";

// ⭐ NEW TEXT VARIANTS
const textVariants = StyleSheet.create({
  h3: { fontSize: 20, fontWeight: "900" },
  body: { fontSize: 16 },
});

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MarketTab() {
  const theme = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 80 }}
    >
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

      <Section title="🚐 Van Jobs">
        <VanJobs />
      </Section>

      <Section title="🤖 AI Insights">
        <AIInsights />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: any) {
  const theme = useTheme();
  const [open, setOpen] = useState(true);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);
  };

  return (
    <ThemedView
      style={[
        styles.section,
        {
          backgroundColor: theme.card,
          borderColor: theme.goldDeep,
        },
      ]}
    >
      <Pressable onPress={toggle} style={styles.sectionHeader}>
        <ThemedText style={[textVariants.h3, { color: theme.accent }]}>
          {title}
        </ThemedText>

        <ThemedText style={[textVariants.h3, { color: theme.accent }]}>
          {open ? "▼" : "▲"}
        </ThemedText>
      </Pressable>

      {open && (
        <ThemedView style={styles.sectionBody}>{children}</ThemedView>
      )}
    </ThemedView>
  );
}

/* -------------------------------------------------------
   ⭐ TRENDING FLIPS
------------------------------------------------------- */
function TrendingFlips() {
  const theme = useTheme();

  const items = [
    { name: "Vintage Console", roi: 120 },
    { name: "Designer Jacket", roi: 85 },
    { name: "Retro Toys Bundle", roi: 140 },
  ];

  return (
    <ThemedView>
      {items.map((i, idx) => (
        <ThemedView
          key={idx}
          style={[
            styles.trendingCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
            },
          ]}
        >
          <ThemedText
            style={[
              textVariants.body,
              { color: theme.muted, fontWeight: "700" },
            ]}
          >
            {i.name}
          </ThemedText>

          <ThemedText
            style={[
              textVariants.body,
              { color: theme.accent, fontWeight: "900", marginTop: 4 },
            ]}
          >
            ROI {i.roi}%
          </ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

/* -------------------------------------------------------
   ⭐ CATEGORIES
------------------------------------------------------- */
function Categories() {
  const theme = useTheme();

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
        <ThemedView
          key={c}
          style={[
            styles.categoryChip,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
            },
          ]}
        >
          <ThemedText
            style={[
              textVariants.body,
              { color: theme.accent, fontWeight: "700" },
            ]}
          >
            {c}
          </ThemedText>
        </ThemedView>
      ))}
    </ScrollView>
  );
}

/* -------------------------------------------------------
   ⭐ SAVED FLIPS
------------------------------------------------------- */
function SavedFlips() {
  const theme = useTheme();
  return (
    <ThemedText
      style={[
        textVariants.body,
        { color: theme.muted, fontStyle: "italic" },
      ]}
    >
      Saved flips will appear here soon boss.
    </ThemedText>
  );
}

/* -------------------------------------------------------
   ⭐ BARCODE HISTORY
------------------------------------------------------- */
function BarcodeHistory() {
  const theme = useTheme();
  return (
    <ThemedText
      style={[
        textVariants.body,
        { color: theme.muted, fontStyle: "italic" },
      ]}
    >
      Your barcode lookup history will show here.
    </ThemedText>
  );
}

/* -------------------------------------------------------
   ⭐ VAN JOBS (NEW)
------------------------------------------------------- */
function VanJobs() {
  const theme = useTheme();
  const router = useRouter();

  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const res = await axios.get("http://localhost:4000/jobs");
        setJobs(res.data.jobs);
      } catch (err) {
        console.log("VAN JOBS ERROR:", err);
      }
      setLoading(false);
    };

    loadJobs();
  }, []);

  if (loading)
    return <ActivityIndicator size="large" color={theme.gold} />;

  return (
    <ThemedView>
      {jobs.map((job) => (
        <Pressable
          key={job.id}
          onPress={() => router.push(`/job/${job.id}`)}
        >
          <ThemedView
            style={[
              styles.aiCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.goldDeep,
              },
            ]}
          >
            <ThemedText
              style={[
                textVariants.body,
                { color: theme.accent, fontWeight: "900" },
              ]}
            >
              🚐 {job.title}
            </ThemedText>

            <ThemedText
              style={[
                textVariants.body,
                { color: theme.muted, marginTop: 4 },
              ]}
            >
              Pay: £{job.pay}
            </ThemedText>

            <ThemedText
              style={[
                textVariants.body,
                { color: theme.muted },
              ]}
            >
              Distance: {job.distance_km} km
            </ThemedText>

            <ThemedText
              style={[
                textVariants.body,
                { color: theme.muted },
              ]}
            >
              Time: {job.time_window}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ))}
    </ThemedView>
  );
}

/* -------------------------------------------------------
   ⭐ AI INSIGHTS
------------------------------------------------------- */
function AIInsights() {
  const theme = useTheme();

  const insights = [
    "Top 5 flips under £5",
    "Items rising this week",
    "Categories cooling down",
    "Best places to source today",
  ];

  return (
    <ThemedView>
      {insights.map((i, idx) => (
        <ThemedView
          key={idx}
          style={[
            styles.aiCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
            },
          ]}
        >
          <ThemedText
            style={[
              textVariants.body,
              { color: theme.accent, fontWeight: "700" },
            ]}
          >
            🤖 {i}
          </ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

/* -------------------------------------------------------
   ⭐ STYLES
------------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  section: {
    marginBottom: 22,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },

  sectionBody: {
    padding: 16,
  },

  trendingCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
  },

  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    marginRight: 10,
  },

  aiCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
  },
});
