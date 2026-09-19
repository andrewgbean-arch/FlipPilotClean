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
import {
  Barcode,
  Camera,
  CameraSlash,
  CaretRight,
  ChatCircle,
  ClockCounterClockwise,
  CloudSun,
  CurrencyGbp,
  Car,
  Stack,
  Star,
  Storefront,
  Tent,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useTheme } from "@/styles/useTheme";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { getProfit } from "@/components/FlipCard";
import { formatMoney } from "@/features/vehicles/utils/vehicleStats";
import WeatherCard from "@/components/WeatherCard";
import FeedbackSheet from "@/components/sheets/FeedbackSheet";

const TOOLS: { key: string; label: string; Icon: PhosphorIcon; route: string; tint: string }[] = [
  { key: "scan", label: "AI Scan", Icon: Camera, route: "/scan", tint: "#FFD700" },
  { key: "barcode", label: "Barcode Lookup", Icon: Barcode, route: "/scan", tint: "#4FA3FF" },
  { key: "flips", label: "Your Flips", Icon: Stack, route: "/history", tint: "#4CAF50" },
  { key: "market", label: "Marketplace", Icon: Storefront, route: "/marketplace", tint: "#FF9F43" },
  { key: "vehicles", label: "Vehicles Hub", Icon: Car, route: "/vehicles", tint: "#B78CFF" },
];

const INSIGHTS: { key: string; title: string; meta: string; Icon: PhosphorIcon; route: string }[] = [
  { key: "weather", title: "Weather", meta: "Bootfair conditions", Icon: CloudSun, route: "/weather" },
  { key: "bootfairs", title: "Bootfairs", meta: "Find local fairs", Icon: Tent, route: "/bootfairs" },
  { key: "reviews", title: "Reviews", meta: "Rate FlipPilot", Icon: Star, route: "/rate" },
];

const signedMoney = (value: number) =>
  `${value >= 0 ? "+" : "-"}£${Math.abs(value).toFixed(2)}`;

function StatBlock({
  Icon,
  tint,
  label,
  value,
  valueColor,
  suffix,
}: {
  Icon: PhosphorIcon;
  tint: string;
  label: string;
  value: string;
  valueColor: string;
  suffix?: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.statsBlock}>
      <View style={[styles.statBadge, { backgroundColor: tint + "24" }]}>
        <Icon size={18} color={tint} />
      </View>
      <Text style={[styles.statsLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.statsValue, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {suffix ? <Text style={[styles.statsSuffix, { color: theme.muted }]}>{suffix}</Text> : null}
      </Text>
    </View>
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

  // ⭐ Stats. Profit comes from the same helper as History, so the two screens
  // agree after a flip's prices are edited.
  const stats = useMemo(() => {
    const total = flips.length;
    const totalProfit = flips.reduce((sum, f) => sum + getProfit(f), 0);

    const avgScoreRaw = flips.reduce((sum, f) => sum + (f.flipScore ?? 0), 0);
    const scoreCount = flips.filter((f) => f.flipScore != null).length;
    const avgScore =
      scoreCount > 0 ? Math.round(avgScoreRaw / scoreCount) : null;

    return { total, totalProfit, avgScore };
  }, [flips]);

  const latestFlip = flips[0] ?? null;
  const latestProfit = latestFlip ? getProfit(latestFlip) : 0;
  const profitColor =
    stats.totalProfit > 0 ? theme.success : stats.totalProfit < 0 ? theme.danger : theme.text;

  const card = { backgroundColor: theme.card, borderColor: theme.hairline };

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
        <WeatherCard theme={theme} style={styles.weatherCard} />

        {/* STATS */}
        <View style={[styles.statsCard, card]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
            Flip stats
          </Text>

          <View style={styles.statsRow}>
            <StatBlock
              Icon={Stack}
              tint={theme.gold}
              label="TOTAL FLIPS"
              value={String(stats.total)}
              valueColor={theme.text}
            />

            <View style={[styles.statDivider, { backgroundColor: theme.hairline }]} />

            <StatBlock
              Icon={CurrencyGbp}
              tint={theme.success}
              label="TOTAL PROFIT"
              value={formatMoney(stats.totalProfit)}
              valueColor={profitColor}
            />

            <View style={[styles.statDivider, { backgroundColor: theme.hairline }]} />

            <StatBlock
              Icon={Star}
              tint={theme.secondary}
              label="AVG SCORE"
              value={stats.avgScore != null ? String(stats.avgScore) : "-"}
              valueColor={theme.text}
              suffix="/100"
            />
          </View>
        </View>

        {/* LATEST FLIP */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
            Latest flip
          </Text>

          {latestFlip ? (
            <View style={[styles.latestCard, card]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${latestFlip.title}, ${latestProfit >= 0 ? "profit" : "loss"} of £${Math.abs(latestProfit).toFixed(2)}. Open details`}
                style={({ pressed }) => [styles.latestMain, pressed && styles.pressed]}
                onPress={() => router.push(`/flip/${latestFlip.id}`)}
              >
                <View style={styles.latestText}>
                  <Text style={[styles.latestTitle, { color: theme.text }]} numberOfLines={1}>
                    {latestFlip.title}
                  </Text>
                  <Text
                    style={[
                      styles.latestProfit,
                      { color: latestProfit >= 0 ? theme.success : theme.danger },
                    ]}
                  >
                    {signedMoney(latestProfit)}
                  </Text>
                  <Text style={[styles.latestMeta, { color: theme.muted }]}>
                    Score {latestFlip.flipScore ?? "-"}/100
                  </Text>
                </View>
                <CaretRight size={20} color={theme.muted} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View history"
                style={({ pressed }) => [
                  styles.historyRow,
                  { borderTopColor: theme.hairline },
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push("/history")}
              >
                <ClockCounterClockwise size={18} color={theme.muted} />
                <Text style={[styles.historyLabel, { color: theme.muted }]}>View history</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.emptyCard, card]}>
              <CameraSlash size={24} color={theme.muted} />
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                No flips yet. Start scanning to build your dashboard.
              </Text>
            </View>
          )}
        </View>

        {/* TOOLS */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
            Tools
          </Text>

          <View style={styles.toolsRow}>
            {TOOLS.map(({ key, label, Icon, route, tint }) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                style={({ pressed }) => [styles.toolCard, card, pressed && styles.pressed]}
                onPress={() => router.push(route as any)}
              >
                <View style={[styles.iconBadge, { backgroundColor: tint + "22" }]}>
                  <Icon size={24} color={tint} />
                </View>
                <Text style={[styles.toolLabel, { color: theme.text }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* INSIGHTS */}
        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
            Insights
          </Text>

          <View style={styles.insightsRow}>
            {INSIGHTS.map(({ key, title, meta, Icon, route }) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${meta}`}
                style={({ pressed }) => [styles.insightCard, card, pressed && styles.pressed]}
                onPress={() => router.push(route as any)}
              >
                <Icon size={22} color={theme.muted} />
                <Text style={[styles.insightTitle, { color: theme.text }]}>{title}</Text>
                <Text style={[styles.insightMeta, { color: theme.muted }]}>{meta}</Text>
              </Pressable>
            ))}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Feedback. Tell us your thoughts"
              style={({ pressed }) => [styles.insightCard, card, pressed && styles.pressed]}
              onPress={openSheet}
            >
              <ChatCircle size={22} color={theme.muted} />
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

  weatherCard: { marginHorizontal: 16, marginTop: 8 },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  sectionWrapper: { marginTop: 26, marginHorizontal: 16 },

  statsCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statsBlock: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 52 },
  statBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statsLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  statsValue: { fontSize: 22, fontWeight: "700", marginTop: 4, fontVariant: ["tabular-nums"] },
  statsSuffix: { fontSize: 13, fontWeight: "500" },

  latestCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  latestMain: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  latestText: { flex: 1, gap: 2 },
  latestTitle: { fontSize: 16, fontWeight: "600" },
  latestProfit: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  latestMeta: { fontSize: 13 },
  historyRow: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
  },
  historyLabel: { fontSize: 14, fontWeight: "600" },

  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 22,
    alignItems: "center",
    gap: 8,
  },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center" },

  toolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  toolCard: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  toolLabel: { fontSize: 14, fontWeight: "600", textAlign: "center" },

  insightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  insightCard: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  insightTitle: { fontSize: 15, fontWeight: "600", marginTop: 8 },
  insightMeta: { fontSize: 12, marginTop: 3 },

  pressed: { opacity: 0.7 },
});
