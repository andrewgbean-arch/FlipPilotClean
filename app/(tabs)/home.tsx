import React, { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/styles/useTheme";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import WeatherCard from "../components/WeatherCard";
import FeedbackSheet from "../FeedbackSheet";
import GlowPulseCard from "@/components/ui/GlowPulseCard";

import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

type IconFamily = "feather" | "mci";

const TOOLS: {
  key: string;
  label: string;
  icon: string;
  family: IconFamily;
  route: string;
  tint: string;
}[] = [
  { key: "scan", label: "AI Scan", icon: "camera", family: "feather", route: "/scan", tint: "#FFD700" },
  { key: "barcode", label: "Barcode Lookup", icon: "barcode", family: "mci", route: "/scan", tint: "#4FA3FF" },
  { key: "flips", label: "Your Flips", icon: "layers", family: "feather", route: "/history", tint: "#4CAF50" },
  { key: "market", label: "Marketplace", icon: "storefront-outline", family: "mci", route: "/marketplace", tint: "#FF9F43" },
  { key: "vehicles", label: "Vehicles Hub", icon: "car-multiple", family: "mci", route: "/vehicles", tint: "#B78CFF" },
];

const INSIGHTS: {
  key: string;
  title: string;
  meta: string;
  icon: string;
  family: IconFamily;
  route: string;
}[] = [
  { key: "weather", title: "Weather", meta: "Bootfair conditions", icon: "weather-partly-cloudy", family: "mci", route: "/weather" },
  { key: "bootfairs", title: "Bootfairs", meta: "Find local fairs", icon: "tent", family: "mci", route: "/bootfairs" },
  { key: "reviews", title: "Reviews", meta: "Rate FlipPilot", icon: "star", family: "feather", route: "/rate" },
];

function ToolIcon({ family, name, size, color }: { family: IconFamily; name: string; size: number; color: string }) {
  return family === "feather" ? (
    <Feather name={name as any} size={size} color={color} />
  ) : (
    <MaterialCommunityIcons name={name as any} size={size} color={color} />
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { vehicles: flips } = useVehicleHistory();
  const theme = useTheme();

  // ⭐ Bottom sheet
  const [showSheet, setShowSheet] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [warning, setWarning] = useState(false);
  const translateY = useRef(new Animated.Value(500)).current;

  const openSheet = () => {
    setShowSheet(true);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(translateY, {
      toValue: 500,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowSheet(false);
      setFeedbackText("");
      setWarning(false);
    });
  };

  const sendFeedback = async () => {
    if (!feedbackText.trim()) {
      setWarning(true);
      return;
    }

    try {
      const existing = await AsyncStorage.getItem("@flippilot_feedback");
      const items = existing ? JSON.parse(existing) : [];
      items.push({ text: feedbackText, date: new Date().toISOString() });
      await AsyncStorage.setItem("@flippilot_feedback", JSON.stringify(items));
    } catch (e) {
      console.log("Failed to save feedback", e);
    }

    closeSheet();
  };

  // ⭐ Stats
  const stats = useMemo(() => {
    const total = flips.length;
    const totalProfit = flips.reduce(
      (sum, f) => sum + (f.pricing?.predictedProfit ?? f.profit ?? 0),
      0
    );

    const avgScoreRaw = flips.reduce((sum, f) => sum + (f.flipScore ?? 0), 0);
    const scoreCount = flips.filter((f) => f.flipScore != null).length;
    const avgScore =
      scoreCount > 0 ? Math.round(avgScoreRaw / scoreCount) : null;

    return { total, totalProfit, avgScore };
  }, [flips]);

  const latestFlip = flips[0] ?? null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* LOGO HEADER */}
        <View style={[styles.logoHeaderWrapper, { paddingTop: insets.top + 10 }]}>
          <Image
            source={require("@/assets/images/logopulse.png")}
            style={styles.logoHeaderImage}
            resizeMode="contain"
          />
        </View>

        {/* WEATHER */}
        <WeatherCard theme={theme} />

        {/* STATS */}
        <GlowPulseCard style={styles.glowCardOverride}>
          <Text style={[styles.sectionTitle, { color: theme.gold }]}>
            <Feather name="bar-chart-2" size={20} color={theme.gold} /> Flip Stats
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statsBlock}>
              <View style={[styles.statBadge, { backgroundColor: "rgba(255,215,0,0.14)" }]}>
                <Feather name="layers" size={16} color={theme.gold} />
              </View>
              <Text style={[styles.statsLabel, { color: theme.muted }]}>TOTAL FLIPS</Text>
              <Text style={[styles.statsValue, { color: theme.white }]}>{stats.total}</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statsBlock}>
              <View style={[styles.statBadge, { backgroundColor: "rgba(76,175,80,0.14)" }]}>
                <Feather name="dollar-sign" size={16} color={theme.success} />
              </View>
              <Text style={[styles.statsLabel, { color: theme.muted }]}>TOTAL PROFIT</Text>
              <Text style={[styles.statsValue, { color: theme.success }]}>
                £{stats.totalProfit.toFixed(2)}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statsBlock}>
              <View style={[styles.statBadge, { backgroundColor: "rgba(79,163,255,0.14)" }]}>
                <Feather name="star" size={16} color={theme.secondary} />
              </View>
              <Text style={[styles.statsLabel, { color: theme.muted }]}>AVG SCORE</Text>
              <Text style={[styles.statsValue, { color: theme.white }]}>
                {stats.avgScore != null ? stats.avgScore : "—"}
                <Text style={{ fontSize: 13, color: theme.muted }}>/100</Text>
              </Text>
            </View>
          </View>
        </GlowPulseCard>

        {/* LATEST FLIP */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionTitle, { color: theme.gold }]}>
            <Feather name="zap" size={20} color={theme.gold} /> Latest Flip
          </Text>

          {latestFlip ? (
            <Pressable
              style={[styles.spotlightCard, { backgroundColor: theme.card, borderColor: theme.goldSoftGlow }]}
              onPress={() => router.push(`/flip/${latestFlip.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.spotlightTitle, { color: theme.white }]} numberOfLines={1}>
                  {latestFlip.title}
                </Text>
                <View style={styles.spotlightMetaRow}>
                  <Feather name="dollar-sign" size={14} color={theme.success} />
                  <Text style={[styles.spotlightMeta, { color: theme.success }]}>
                    £{(latestFlip.pricing?.predictedProfit ?? latestFlip.profit ?? 0).toFixed(2)} profit
                  </Text>
                </View>
                <View style={styles.spotlightMetaRow}>
                  <Feather name="star" size={14} color={theme.gold} />
                  <Text style={[styles.spotlightMeta, { color: theme.muted }]}>
                    Score {latestFlip.flipScore ?? "?"}/100
                  </Text>
                </View>

                <Pressable
                  style={styles.historyButton}
                  onPress={() => router.push("/history")}
                >
                  <Feather name="clock" size={16} color={theme.muted} />
                  <Text style={[styles.historyLabel, { color: theme.muted }]}>View History</Text>
                </Pressable>
              </View>
              <Feather name="chevron-right" size={22} color={theme.muted} />
            </Pressable>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: "rgba(255,255,255,0.06)" }]}>
              <Feather name="camera-off" size={22} color={theme.muted} />
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                No flips yet. Start scanning to build your dashboard.
              </Text>
            </View>
          )}
        </View>

        {/* TOOLS */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionTitle, { color: theme.gold }]}>
            <Feather name="tool" size={20} color={theme.gold} /> Tools
          </Text>

          <View style={styles.toolsRow}>
            {TOOLS.map((tool) => (
              <Pressable
                key={tool.key}
                style={[styles.toolCard, { backgroundColor: theme.card }]}
                onPress={() => router.push(tool.route as any)}
              >
                <View style={[styles.iconBadge, { backgroundColor: tool.tint + "22" }]}>
                  <ToolIcon family={tool.family} name={tool.icon} size={22} color={tool.tint} />
                </View>
                <Text style={[styles.toolLabel, { color: theme.text }]}>{tool.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* INSIGHTS */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionTitle, { color: theme.gold }]}>
            <Feather name="info" size={20} color={theme.gold} /> Insights
          </Text>

          <View style={styles.insightsRow}>
            {INSIGHTS.map((insight) => (
              <Pressable
                key={insight.key}
                style={[styles.insightCard, { backgroundColor: theme.card }]}
                onPress={() => router.push(insight.route as any)}
              >
                <ToolIcon family={insight.family} name={insight.icon} size={22} color={theme.muted} />
                <Text style={[styles.insightTitle, { color: theme.text }]}>{insight.title}</Text>
                <Text style={[styles.insightMeta, { color: theme.muted }]}>{insight.meta}</Text>
              </Pressable>
            ))}

            <Pressable
              style={[styles.insightCard, { backgroundColor: theme.card }]}
              onPress={openSheet}
            >
              <Feather name="message-circle" size={22} color={theme.muted} />
              <Text style={[styles.insightTitle, { color: theme.text }]}>Feedback</Text>
              <Text style={[styles.insightMeta, { color: theme.muted }]}>Tell us your thoughts</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {showSheet && (
        <FeedbackSheet
          translateY={translateY}
          closeSheet={closeSheet}
          feedbackText={feedbackText}
          setFeedbackText={setFeedbackText}
          warning={warning}
          sendFeedback={sendFeedback}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  logoHeaderWrapper: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  logoHeaderImage: {
    width: "100%",
    height: 170,
  },

  glowCardOverride: { marginHorizontal: 16 },

  sectionTitle: { fontSize: 19, fontWeight: "800", marginBottom: 14 },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statsBlock: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 44, backgroundColor: "rgba(255,255,255,0.08)" },
  statBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statsLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  statsValue: { fontSize: 19, fontWeight: "800", marginTop: 4 },

  sectionWrapper: { marginTop: 26, marginHorizontal: 16 },

  spotlightCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  spotlightTitle: { fontSize: 18, fontWeight: "800" },
  spotlightMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  spotlightMeta: { fontSize: 13, fontWeight: "600" },

  emptyCard: {
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    gap: 8,
  },
  emptyText: { fontSize: 13, textAlign: "center" },

  historyButton: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyLabel: { fontSize: 13, fontWeight: "700" },

  toolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  toolCard: {
    width: "48%",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  toolLabel: { fontSize: 13, fontWeight: "700", textAlign: "center" },

  insightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  insightCard: {
    width: "47%",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  insightTitle: { fontSize: 15, fontWeight: "700", marginTop: 8 },
  insightMeta: { fontSize: 12, marginTop: 3 },
});

