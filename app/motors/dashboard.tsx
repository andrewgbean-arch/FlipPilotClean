import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import {
  Bell,
  Car,
  CaretRight,
  ChartLineUp,
  CheckCircle,
  CurrencyGbp,
  List,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SquaresFour,
  Star,
  Trophy,
  WarningCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useDealerNotifications } from "@/features/vehicles/context/DealerNotificationsContext";
import { useTheme } from "@/styles/ThemeContext";
import {
  motAttentionList,
  motExpiryPhrase,
} from "@/features/vehicles/utils/motDates";
import {
  barPercent,
  formatMoney,
  formatScore,
  monthlyProfit,
  realisedProfit,
  summariseVehicles,
} from "@/features/vehicles/utils/vehicleStats";

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
    <View style={[styles.statTile, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      <Icon size={18} color={theme.muted} />
      <Text
        style={[styles.statValue, { color: color ?? theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
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

// A tappable row with an icon, a title, an optional second line and a chevron.
function Row({
  Icon,
  iconColor,
  title,
  subtitle,
  trailing,
  onPress,
  divider,
}: {
  Icon?: PhosphorIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress: () => void;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: 1, borderTopColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      {Icon ? <Icon size={22} color={iconColor ?? theme.muted} /> : null}

      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: theme.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}
      <CaretRight size={16} color={theme.muted} />
    </Pressable>
  );
}

export default function MotorsDashboard() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { vehicles: records } = useVehicleHistory();
  const { notifications } = useDealerNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Scans share the store with vehicles but are not vehicles, so only records
  // with MOT data are counted or listed here.
  const { vehicles, total, totalProfit, avgScore, ranked } = useMemo(
    () => summariseVehicles(records),
    [records]
  );

  const latest = vehicles[0] ?? null;
  const motAttention = useMemo(() => motAttentionList(vehicles), [vehicles]);
  const topPerformers = ranked.slice(0, 3);
  const monthly = useMemo(() => monthlyProfit(vehicles), [vehicles]);
  const maxMonthly = Math.max(...monthly.map((m) => m.profit), 1);

  const profitColor =
    totalProfit > 0 ? theme.success : totalProfit < 0 ? theme.danger : theme.text;

  const card = { backgroundColor: theme.card, borderColor: theme.hairline };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
              Motors
            </Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>Your vehicle dashboard</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
            }
            style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
            onPress={() => router.push("/motors/notifications")}
          >
            <Bell size={24} color={theme.text} />
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: theme.gold }]}>
                <Text style={[styles.badgeText, { color: theme.background }]}>{unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* STATS */}
        <View style={styles.statsRow}>
          <StatTile Icon={Car} label="Vehicles" value={String(total)} />
          <StatTile Icon={CurrencyGbp} label="Profit" value={formatMoney(totalProfit)} color={profitColor} />
          <StatTile Icon={Star} label="Avg score" value={avgScore == null ? "-" : String(avgScore)} />
        </View>

        {/* PRIMARY ACTIONS */}
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add vehicle"
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.gold },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/vehicles/new")}
          >
            <Plus size={20} color={theme.black} weight="bold" />
            <Text style={[styles.primaryLabel, { color: theme.black }]}>Add vehicle</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="MOT lookup"
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.hairline, backgroundColor: theme.card },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/vehicles/mot-lookup")}
          >
            <MagnifyingGlass size={20} color={theme.text} />
            <Text style={[styles.secondaryLabel, { color: theme.text }]}>MOT lookup</Text>
          </Pressable>
        </View>

        {/* LATEST VEHICLE */}
        <SectionTitle>Latest vehicle</SectionTitle>
        {latest ? (
          <View style={[styles.group, card]}>
            <Row
              Icon={Car}
              title={latest.title}
              subtitle={`Profit ${formatMoney(realisedProfit(latest))} · Score ${formatScore(latest.flipScore)}`}
              onPress={() => router.push(`/vehicles/overview/${latest.id}`)}
            />
            <Row
              Icon={List}
              title="View all vehicles"
              onPress={() => router.push("/vehicles/list")}
              divider
            />
          </View>
        ) : (
          <View style={[styles.emptyCard, card]}>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              No vehicles yet. Add your first one to track its MOT and profit.
            </Text>
          </View>
        )}

        {/* MOT ATTENTION */}
        <SectionTitle>MOT attention</SectionTitle>
        {motAttention.length === 0 ? (
          <View style={[styles.emptyCard, styles.emptyRow, card]}>
            <CheckCircle size={20} color={theme.success} />
            <Text style={[styles.emptyText, { color: theme.muted }]}>No MOT issues.</Text>
          </View>
        ) : (
          <View style={[styles.group, card]}>
            {motAttention.map(({ vehicle: v, days }, i) => (
              <Row
                key={v.id}
                Icon={WarningCircle}
                iconColor={days != null && days < 0 ? theme.danger : theme.warning}
                title={v.title}
                subtitle={`MOT ${motExpiryPhrase(days)}`}
                onPress={() => router.push(`/vehicles/overview/${v.id}`)}
                divider={i > 0}
              />
            ))}
          </View>
        )}

        {/* TOP PERFORMERS */}
        <SectionTitle>Top performers</SectionTitle>
        {topPerformers.length === 0 ? (
          <View style={[styles.emptyCard, card]}>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              Add a buy and sell price to a vehicle to see it here.
            </Text>
          </View>
        ) : (
          <View style={[styles.group, card]}>
            {topPerformers.map(({ vehicle: v, profit }, i) => (
              <Row
                key={v.id}
                Icon={Trophy}
                iconColor={i === 0 ? theme.gold : theme.muted}
                title={v.title}
                subtitle={`Profit ${formatMoney(profit)}`}
                onPress={() => router.push(`/vehicles/overview/${v.id}`)}
                divider={i > 0}
              />
            ))}
          </View>
        )}

        {/* MONTHLY PROFIT */}
        <SectionTitle>Monthly profit</SectionTitle>
        {monthly.length === 0 ? (
          <View style={[styles.emptyCard, styles.emptyRow, card]}>
            <ChartLineUp size={20} color={theme.muted} />
            <Text style={[styles.emptyText, { color: theme.muted }]}>No sales recorded yet.</Text>
          </View>
        ) : (
          <View style={[styles.emptyCard, card]}>
            {monthly.map(({ key, label, profit }, i) => (
              <View key={key} style={i > 0 && styles.monthGap}>
                <View style={styles.monthHeader}>
                  <Text style={[styles.monthLabel, { color: theme.muted }]}>{label}</Text>
                  <Text
                    style={[
                      styles.monthValue,
                      { color: profit >= 0 ? theme.success : theme.danger },
                    ]}
                  >
                    {formatMoney(profit)}
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: theme.background }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${barPercent(profit, maxMonthly)}%`,
                        backgroundColor: profit >= 0 ? theme.success : theme.danger,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* MORE */}
        <SectionTitle>More</SectionTitle>
        <View style={[styles.group, card]}>
          <Row Icon={PencilSimple} title="Edit a vehicle" onPress={() => router.push("/vehicles/edit-lookup")} />
          <Row Icon={SquaresFour} title="Motors hub" onPress={() => router.push("/motors/hub")} divider />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: { flex: 1 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 2 },
  bellButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "700" },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statLabel: { fontSize: 12 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryLabel: { fontSize: 16, fontWeight: "600" },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 28, marginBottom: 10 },

  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 13, marginTop: 2 },

  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },

  monthGap: { marginTop: 14 },
  monthHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  monthLabel: { fontSize: 13 },
  monthValue: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 6 },
  fill: { height: "100%", borderRadius: 4 },

  pressed: { opacity: 0.7 },
});
