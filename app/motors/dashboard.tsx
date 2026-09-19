import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useDealerNotifications } from "@/features/vehicles/context/DealerNotificationsContext";
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

const NAVY = "#0A1128";
const GOLD = "#FFD700";
const SILVER = "#AAB4C3";
const CARD = "#111827";

export default function MotorsDashboard() {
  const { vehicles: records } = useVehicleHistory();
  const { notifications } = useDealerNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  /* -------------------------------------------------------
     ⭐ STATS
     Scans share the store with vehicles but are not vehicles, so only
     records with MOT data are counted or listed here.
  ------------------------------------------------------- */
  const { vehicles, total, totalProfit, avgScore, ranked } = useMemo(
    () => summariseVehicles(records),
    [records]
  );

  const latest = vehicles[0] ?? null;

  /* -------------------------------------------------------
     ⭐ MOT ATTENTION
  ------------------------------------------------------- */
  const motAttention = useMemo(() => motAttentionList(vehicles), [vehicles]);

  /* -------------------------------------------------------
     ⭐ TOP PERFORMERS
  ------------------------------------------------------- */
  const topPerformers = ranked.slice(0, 3);

  /* -------------------------------------------------------
     ⭐ MONTHLY PROFIT TIMELINE
  ------------------------------------------------------- */
  const monthly = useMemo(() => monthlyProfit(vehicles), [vehicles]);
  const maxMonthly = Math.max(...monthly.map((m) => m.profit), 1);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.headerWrapper}>
          <View style={styles.headerCard}>
            <Text style={styles.headerTitle}>FlipPilot Motors</Text>
            <Text style={styles.headerSubtitle}>
              Your vehicle dashboard
            </Text>
          </View>
        </View>

        {/* STATS */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>
            <Feather name="bar-chart-2" size={20} color={GOLD} /> Vehicle Stats
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statsBlock}>
              <Text style={styles.statsLabel}>Total Vehicles</Text>
              <Text style={styles.statsValue}>
                <Feather name="layers" size={18} color={GOLD} /> {total}
              </Text>
            </View>

            <View style={styles.statsBlock}>
              <Text style={styles.statsLabel}>Total Profit</Text>
              <Text style={styles.statsValue}>
                <Feather name="dollar-sign" size={18} color={GOLD} />{" "}
                {formatMoney(totalProfit)}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statsBlock}>
              <Text style={styles.statsLabel}>Avg Flip Score</Text>
              <Text style={styles.statsValue}>
                <Feather name="star" size={18} color={GOLD} />{" "}
                {formatScore(avgScore)}
              </Text>
            </View>
          </View>
        </View>

        {/* LATEST VEHICLE */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>
            <Feather name="zap" size={20} color={GOLD} /> Latest Vehicle
          </Text>

          {latest ? (
            <Pressable
              style={styles.spotlightCard}
              onPress={() => router.push(`/vehicles/overview/${latest.id}`)}
            >
              <Text style={styles.spotlightTitle}>{latest.title}</Text>

              <Text style={styles.spotlightMeta}>
                <Feather name="dollar-sign" size={16} color={GOLD} /> Profit:{" "}
                {formatMoney(realisedProfit(latest))}
              </Text>

              <Text style={styles.spotlightMeta}>
                <Feather name="star" size={16} color={GOLD} /> Score:{" "}
                {formatScore(latest.flipScore)}
              </Text>

              <Pressable
                style={styles.historyButton}
                onPress={() => router.push("/vehicles/list")}
              >
                <Feather name="clock" size={18} color={SILVER} />
                <Text style={styles.historyLabel}>View All Vehicles</Text>
              </Pressable>
            </Pressable>
          ) : (
            <Text style={styles.emptyText}>
              No vehicles yet. Add your first one.
            </Text>
          )}
        </View>

        {/* MOT ATTENTION */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>
            <Feather name="alert-triangle" size={20} color={GOLD} /> MOT
            Attention
          </Text>

          {motAttention.length === 0 ? (
            <Text style={styles.emptyText}>No MOT issues.</Text>
          ) : (
            motAttention.map(({ vehicle: v, days }) => (
              <Pressable
                key={v.id}
                style={styles.motCard}
                onPress={() => router.push(`/vehicles/overview/${v.id}`)}
              >
                <Text style={styles.motTitle}>{v.title}</Text>
                <Text style={styles.motMeta}>
                  MOT {motExpiryPhrase(days)}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        {/* TOP PERFORMERS */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>
            <Feather name="award" size={20} color={GOLD} /> Top Performers
          </Text>

          {topPerformers.length === 0 ? (
            <Text style={styles.emptyText}>No completed flips yet.</Text>
          ) : (
            topPerformers.map(({ vehicle: v, profit }) => (
              <Pressable
                key={v.id}
                style={styles.topCard}
                onPress={() => router.push(`/vehicles/overview/${v.id}`)}
              >
                <Text style={styles.topTitle}>{v.title}</Text>
                <Text style={styles.topMeta}>
                  Profit: {formatMoney(profit)}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        {/* MONTHLY PROFIT TIMELINE */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>
            <Feather name="trending-up" size={20} color={GOLD} /> Monthly
            Profit Timeline
          </Text>

          {monthly.length === 0 ? (
            <Text style={styles.emptyText}>No data yet.</Text>
          ) : (
            monthly.map(({ key, label, profit }) => (
              <View key={key} style={{ marginBottom: 10 }}>
                <Text style={{ color: SILVER }}>
                  {label}: {formatMoney(profit)}
                </Text>

                <View style={styles.timelineBar}>
                  <View
                    style={[
                      styles.timelineFill,
                      {
                        width: `${barPercent(profit, maxMonthly)}%`,
                        backgroundColor:
                          profit > 500
                            ? GOLD
                            : profit > 200
                            ? "#FFD966"
                            : "#FF6666",
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>
            <Feather name="tool" size={20} color={GOLD} /> Quick Actions
          </Text>

          <View style={styles.toolsRow}>
            <Pressable
              style={styles.toolCard}
              onPress={() => router.push("/vehicles/new")}
            >
              <Feather name="plus-circle" size={26} color={SILVER} />
              <Text style={styles.toolLabel}>Add Vehicle</Text>
            </Pressable>

            <Pressable
              style={styles.toolCard}
              onPress={() => router.push("/vehicles/mot-lookup")}
            >
              <MaterialCommunityIcons
                name="car-wrench"
                size={26}
                color={SILVER}
              />
              <Text style={styles.toolLabel}>MOT Lookup</Text>
            </Pressable>

            <Pressable
              style={styles.toolCard}
              onPress={() => router.push("/vehicles/edit-lookup")}
            >
              <Feather name="edit" size={26} color={SILVER} />
              <Text style={styles.toolLabel}>Edit Vehicle</Text>
            </Pressable>

            <Pressable
              style={styles.toolCard}
              onPress={() => router.push("/vehicles/list")}
            >
              <Feather name="list" size={26} color={SILVER} />
              <Text style={styles.toolLabel}>Vehicle List</Text>
            </Pressable>

            <Pressable
              style={styles.toolCard}
              onPress={() => router.push("/motors/hub")}
            >
              <MaterialCommunityIcons name="view-dashboard-outline" size={26} color={SILVER} />
              <Text style={styles.toolLabel}>Motors Hub</Text>
            </Pressable>

            <Pressable
              style={styles.toolCard}
              onPress={() => router.push("/motors/notifications")}
            >
              <View>
                <Feather name="bell" size={26} color={SILVER} />
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.toolLabel}>Notifications</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },

  headerWrapper: { paddingHorizontal: 16, marginTop: 20 },
  headerCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
  },
  headerTitle: { color: GOLD, fontSize: 26, fontWeight: "900" },
  headerSubtitle: { color: SILVER, fontSize: 14, marginTop: 4 },

  statsCard: {
    marginTop: 20,
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: GOLD,
  },
  sectionTitle: {
    color: GOLD,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  statsBlock: { flex: 1 },
  statsLabel: { color: SILVER, fontSize: 13 },
  statsValue: {
    color: GOLD,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },

  sectionWrapper: { marginTop: 24, marginHorizontal: 16 },

  spotlightCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: GOLD,
  },
  spotlightTitle: { color: GOLD, fontSize: 18, fontWeight: "700" },
  spotlightMeta: { color: SILVER, fontSize: 13, marginTop: 4 },
  emptyText: { color: SILVER, fontSize: 13, marginTop: 6 },

  historyButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyLabel: { color: SILVER, fontSize: 14, fontWeight: "600" },

  motCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: GOLD,
    marginBottom: 12,
  },
  motTitle: { color: GOLD, fontSize: 16, fontWeight: "700" },
  motMeta: { color: SILVER, fontSize: 13, marginTop: 4 },

  topCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: GOLD,
    marginBottom: 12,
  },
  topTitle: { color: GOLD, fontSize: 16, fontWeight: "700" },
  topMeta: { color: SILVER, fontSize: 13, marginTop: 4 },

  timelineBar: {
    height: 8,
    backgroundColor: NAVY,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 4,
  },
  timelineFill: {
    height: "100%",
    borderRadius: 8,
  },

  toolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  toolCard: {
    width: "48%",
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
  },
  toolLabel: {
    color: SILVER,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
  },
  notifBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: "center",
  },
  notifBadgeText: {
    color: NAVY,
    fontWeight: "800",
    fontSize: 11,
  },
});
