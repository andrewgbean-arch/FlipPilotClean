import React, { useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import {
  CalendarBlank,
  Car,
  CaretRight,
  ChartLineUp,
  Clock,
  Package,
  Tag,
  Timer,
  TrendDown,
  TrendUp,
  Warning,
  WarningCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { motDaysLeft } from "@/features/vehicles/utils/motDates";
import {
  formatMoney,
  isVehicleRecord,
  realisedProfit,
} from "@/features/vehicles/utils/vehicleStats";

type AppTheme = ReturnType<typeof useTheme>;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-03" reads as "Mar 2026"; anything unexpected is shown as it is.
function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name} ${year}` : key;
}

// Profit and loss always carry a sign: "+£300" / "-£45".
function signedMoney(value: number): string {
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}

function profitColor(theme: AppTheme, value: number): string {
  return value > 0 ? theme.success : value < 0 ? theme.danger : theme.text;
}

const SCORE_RANGES = ["0–19", "20–39", "40–59", "60–79", "80+"];

export default function MotorsAnalytics() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vehicles: records, loaded, loadError } = useVehicleHistory();

  // Scans share the store with vehicles but are not vehicles.
  const vehicles = records.filter(isVehicleRecord);

  const sold = vehicles.filter((v) => v.sellDate);
  const stock = vehicles.filter((v) => !v.sellDate);

  const totalProfit = sold.reduce((sum, v) => sum + (realisedProfit(v) ?? 0), 0);

  const flipTimes = sold.map((v) => {
    const start = new Date(v.buyDate ?? v.timestamp).getTime();
    const end = new Date(v.sellDate ?? v.timestamp).getTime();
    return Math.ceil((end - start) / 86400000);
  });

  const avgFlipTime =
    flipTimes.length > 0
      ? Math.round(flipTimes.reduce((a, b) => a + b, 0) / flipTimes.length)
      : 0;

  const bestFlip = sold.reduce(
    (best, v) => {
      const profit = realisedProfit(v);
      if (profit !== null && profit > best.profit) {
        return { vehicle: v, profit };
      }
      return best;
    },
    { vehicle: null as any, profit: -Infinity }
  );

  const worstFlip = sold.reduce(
    (worst, v) => {
      const profit = realisedProfit(v);
      if (profit !== null && profit < worst.profit) {
        return { vehicle: v, profit };
      }
      return worst;
    },
    { vehicle: null as any, profit: Infinity }
  );

  // MOT buckets (a MOT is valid through the whole of its expiry day)
  const expiredMOT = vehicles.filter((v) => {
    const days = motDaysLeft(v);
    return days !== null && days < 0;
  });

  const mot30 = vehicles.filter((v) => {
    const days = motDaysLeft(v);
    return days !== null && days >= 0 && days <= 30;
  });

  const mot60 = vehicles.filter((v) => {
    const days = motDaysLeft(v);
    return days !== null && days > 30 && days <= 60;
  });

  // Monthly profit
  const monthlyProfitMap: Record<string, number> = {};
  sold.forEach((v) => {
    const month = new Date(v.sellDate ?? v.timestamp)
      .toISOString()
      .slice(0, 7);
    const profit = realisedProfit(v) ?? 0;
    monthlyProfitMap[month] = (monthlyProfitMap[month] ?? 0) + profit;
  });

  const months = Object.keys(monthlyProfitMap).sort();
  const profits = months.map((m) => monthlyProfitMap[m]);
  const maxProfit = Math.max(...profits, 1);

  // Flip score distribution
  const scoreBuckets = [0, 0, 0, 0, 0];
  vehicles.forEach((v) => {
    const score = v.flipScore ?? 0;
    const index = Math.min(4, Math.floor(score / 20));
    scoreBuckets[index]++;
  });
  const maxBucket = Math.max(...scoreBuckets, 1);

  // Saved vehicles are read from storage after launch; do not call the list
  // empty before that has finished.
  if (!loaded) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.muted} />
        <Text style={[styles.stateBody, { color: theme.muted }]}>Loading your figures</Text>
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <View
          style={[styles.emptyIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
        >
          {loadError ? (
            <Warning size={30} color={theme.warning} />
          ) : (
            <ChartLineUp size={30} color={theme.muted} />
          )}
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]} accessibilityRole="header">
          {loadError ? "Couldn't load your vehicles" : "No figures yet"}
        </Text>
        <Text style={[styles.stateBody, { color: theme.muted }]}>
          {loadError ??
            "Add a vehicle and its profit, stock and MOT figures will appear here."}
        </Text>
      </View>
    );
  }

  const card = { backgroundColor: theme.card, borderColor: theme.hairline };

  const bestValue = bestFlip.vehicle ? signedMoney(bestFlip.profit) : "N/A";
  const bestColor = bestFlip.vehicle ? profitColor(theme, bestFlip.profit) : theme.muted;
  const worstValue = worstFlip.vehicle ? signedMoney(worstFlip.profit) : "N/A";
  const worstColor = worstFlip.vehicle ? profitColor(theme, worstFlip.profit) : theme.muted;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* TOTAL PROFIT */}
      <View
        accessible
        accessibilityLabel={`Total profit ${signedMoney(totalProfit)}, from ${sold.length} sold`}
        style={[styles.heroCard, card]}
      >
        <Text style={[styles.heroLabel, { color: theme.muted }]}>Total profit</Text>
        <Text
          style={[styles.heroValue, { color: profitColor(theme, totalProfit) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {signedMoney(totalProfit)}
        </Text>
        <Text style={[styles.heroNote, { color: theme.muted }]}>
          {sold.length === 0
            ? "No vehicles sold yet"
            : `From ${sold.length} sold ${sold.length === 1 ? "vehicle" : "vehicles"}`}
        </Text>
      </View>

      {/* STOCK */}
      <View style={styles.statsRow}>
        <StatTile Icon={Car} label="Vehicles" value={String(vehicles.length)} />
        <StatTile Icon={Package} label="Stock" value={String(stock.length)} />
        <StatTile Icon={Tag} label="Sold" value={String(sold.length)} />
      </View>

      {/* FLIPS */}
      <SectionTitle>Flips</SectionTitle>
      <View style={styles.statsRow}>
        <StatTile Icon={TrendUp} label="Best flip" value={bestValue} color={bestColor} />
        <StatTile Icon={TrendDown} label="Worst flip" value={worstValue} color={worstColor} />
        <StatTile Icon={Timer} label="Avg flip time" value={`${avgFlipTime} ${avgFlipTime === 1 ? "day" : "days"}`} />
      </View>

      {/* MOT */}
      <SectionTitle>MOT</SectionTitle>
      <View style={styles.statsRow}>
        <StatTile
          Icon={WarningCircle}
          label="Expired"
          value={String(expiredMOT.length)}
          color={expiredMOT.length > 0 ? theme.danger : undefined}
        />
        <StatTile
          Icon={Clock}
          label="Within 30 days"
          value={String(mot30.length)}
          color={mot30.length > 0 ? theme.warning : undefined}
        />
        <StatTile Icon={CalendarBlank} label="30 to 60 days" value={String(mot60.length)} />
      </View>

      {/* Link to MOT alerts screen */}
      <View style={[styles.group, styles.linkGroup, card]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View MOT alerts"
          onPress={() => router.push("/motors/mot-alerts")}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <WarningCircle size={22} color={theme.muted} />
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
            View MOT alerts
          </Text>
          <CaretRight size={16} color={theme.muted} />
        </Pressable>
      </View>

      {/* Monthly profit line chart */}
      <SectionTitle>Monthly profit</SectionTitle>
      <View style={[styles.chartCard, card]}>
        {months.length === 0 ? (
          <View style={styles.chartEmpty}>
            <ChartLineUp size={20} color={theme.muted} />
            <Text style={[styles.chartEmptyText, { color: theme.muted }]}>
              No sales recorded yet. Sold vehicles will show up here.
            </Text>
          </View>
        ) : (
          <ProfitLineChart months={months} profits={profits} maxProfit={maxProfit} />
        )}
      </View>

      {/* Flip score bar chart */}
      <SectionTitle>Flip score distribution</SectionTitle>
      <View
        accessible
        accessibilityLabel={`Flip score distribution. ${scoreBuckets
          .map((count, i) => `${SCORE_RANGES[i]}: ${count} ${count === 1 ? "vehicle" : "vehicles"}`)
          .join(". ")}`}
        style={[styles.chartCard, card]}
      >
        <View style={styles.barsRow}>
          {scoreBuckets.map((count, i) => {
            const barHeight = (count / maxBucket) * 100;
            return (
              <View key={i} style={styles.barCol}>
                <Text style={[styles.barCount, { color: theme.text }]}>{count}</Text>
                <View style={[styles.barSlot, { backgroundColor: theme.background }]}>
                  <View
                    style={[styles.barFill, { height: barHeight, backgroundColor: theme.muted }]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: theme.muted }]}>{SCORE_RANGES[i]}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

/* SMALL LOCAL COMPONENTS */

function StatTile({
  Icon,
  label,
  value,
  color,
}: {
  Icon: PhosphorIcon;
  label: string;
  value: string;
  color?: string;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.statTile, { backgroundColor: theme.card, borderColor: theme.hairline }]}
    >
      <Icon size={18} color={theme.muted} />
      <Text
        style={[styles.statValue, { color: color ?? theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

// The monthly profit line, drawn to the width of its card. A month's height is
// its profit as a share of the best month; the baseline is a profit of zero.
function ProfitLineChart({
  months,
  profits,
  maxProfit,
}: {
  months: string[];
  profits: number[];
  maxProfit: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const pad = 12;
  const points = profits.map((p, i) => {
    const x =
      profits.length === 1
        ? width / 2
        : pad + (i * (width - pad * 2)) / (profits.length - 1);
    const y = Math.min(130, Math.max(10, 120 - (p / maxProfit) * 100));
    return { x, y };
  });

  const summary = months
    .map((m, i) => `${monthLabel(m)}: ${signedMoney(profits[i])}`)
    .join(". ");

  return (
    <View accessible accessibilityLabel={`Monthly profit. ${summary}`}>
      <View onLayout={onLayout} style={styles.chartBox}>
        {width > 0 ? (
          <Svg width={width} height={140}>
            <Line
              x1={pad}
              y1={120}
              x2={Math.max(pad, width - pad)}
              y2={120}
              stroke={theme.hairline}
              strokeWidth={1}
            />
            <Polyline
              points={points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
              fill="none"
              stroke={theme.gold}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((pt, i) => (
              <Circle key={i} cx={pt.x} cy={pt.y} r={3.5} fill={theme.gold} />
            ))}
          </Svg>
        ) : null}
      </View>

      <View style={styles.chartLabels}>
        <Text style={[styles.chartLabel, { color: theme.muted }]}>{monthLabel(months[0])}</Text>
        {months.length > 1 ? (
          <Text style={[styles.chartLabel, { color: theme.muted }]}>
            {monthLabel(months[months.length - 1])}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  stateBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },

  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  heroLabel: { fontSize: 13 },
  heroValue: {
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 42,
    fontVariant: ["tabular-nums"],
  },
  heroNote: { fontSize: 13, marginTop: 4 },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  statTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statLabel: { fontSize: 12 },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 28 },

  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  linkGroup: { marginTop: 12 },
  row: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: "600" },

  chartCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  chartBox: { height: 140, alignSelf: "stretch" },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  chartLabel: { fontSize: 12 },
  chartEmpty: { flexDirection: "row", alignItems: "center", gap: 10 },
  chartEmptyText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },

  barsRow: { flexDirection: "row", gap: 8 },
  barCol: { flex: 1, minWidth: 0, alignItems: "center", gap: 6 },
  barCount: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  barSlot: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: { width: "100%", borderRadius: 8 },
  barLabel: { fontSize: 12 },

  pressed: { opacity: 0.7 },
});
