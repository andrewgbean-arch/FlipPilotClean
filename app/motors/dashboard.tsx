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

const NAVY = "#0A1128";
const GOLD = "#FFD700";
const SILVER = "#AAB4C3";
const CARD = "#111827";

export default function MotorsDashboard() {
  const { vehicles: flips } = useVehicleHistory();
  const { notifications } = useDealerNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  /* -------------------------------------------------------
     ⭐ STATS
  ------------------------------------------------------- */
  const stats = useMemo(() => {
    const total = flips.length;

    const totalProfit = flips.reduce(
      (sum, f) =>
        sum +
        ((f.sellPrice ?? f.valuation ?? 0) - (f.buyPrice ?? 0)),
      0
    );

    const avgScoreRaw = flips.reduce(
      (sum, f) => sum + (f.flipScore ?? 0),
      0
    );
    const scoreCount = flips.filter((f) => f.flipScore != null).length;
    const avgScore =
      scoreCount > 0 ? Math.round(avgScoreRaw / scoreCount) : null;

    return { total, totalProfit, avgScore };
  }, [flips]);

  const latest = flips[0] ?? null;

  /* -------------------------------------------------------
     ⭐ MOT ATTENTION
  ------------------------------------------------------- */
  const motAttention = flips.filter((v) => {
    const expiry = v.mot?.motExpiry ?? v.mot?.expiryDate;
    if (!expiry) return false;
    const days = Math.ceil(
      (new Date(expiry).getTime() - Date.now()) / 86400000
    );
    return days <= 30;
  });

  /* -------------------------------------------------------
     ⭐ TOP PERFORMERS
  ------------------------------------------------------- */
  const topPerformers = [...flips]
    .sort((a, b) => {
      const profitA =
        (a.sellPrice ?? a.valuation ?? 0) - (a.buyPrice ?? 0);
      const profitB =
        (b.sellPrice ?? b.valuation ?? 0) - (b.buyPrice ?? 0);
      return profitB - profitA;
    })
    .slice(0, 3);

  /* -------------------------------------------------------
     ⭐ MONTHLY PROFIT TIMELINE
  ------------------------------------------------------- */
  const monthly = useMemo(() => {
    const map: Record<string, number> = {};
    flips.forEach((v) => {
      const month = new Date(v.timestamp).toLocaleString("en-GB", {
        month: "short",
      });
      const profit =
        (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
      map[month] = (map[month] ?? 0) + profit;
    });
    return Object.entries(map);
  }, [flips]);

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
                <Feather name="layers" size={18} color={GOLD} />{" "}
                {stats.total}
              </Text>
            </View>

            <View style={styles.statsBlock}>
              <Text style={styles.statsLabel}>Total Profit</Text>
              <Text style={styles.statsValue}>
                <Feather name="dollar-sign" size={18} color={GOLD} /> £
                {stats.totalProfit.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statsBlock}>
              <Text style={styles.statsLabel}>Avg Flip Score</Text>
              <Text style={styles.statsValue}>
                <Feather name="star" size={18} color={GOLD} />{" "}
                {stats.avgScore ?? "?"}/100
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
                <Feather name="dollar-sign" size={16} color={GOLD} /> Profit: £
                {(latest.sellPrice ?? latest.valuation ?? 0) -
                  (latest.buyPrice ?? 0)}
              </Text>

              <Text style={styles.spotlightMeta}>
                <Feather name="star" size={16} color={GOLD} /> Score:{" "}
                {latest.flipScore ?? "?"}/100
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
            motAttention.map((v) => {
              const expiry =
                v.mot?.motExpiry ?? v.mot?.expiryDate ?? null;
              const daysLeft = expiry
                ? Math.ceil(
                    (new Date(expiry).getTime() - Date.now()) /
                      86400000
                  )
                : null;

              return (
                <Pressable
                  key={v.id}
                  style={styles.motCard}
                  onPress={() =>
                    router.push(`/vehicles/overview/${v.id}`)
                  }
                >
                  <Text style={styles.motTitle}>{v.title}</Text>
                  <Text style={styles.motMeta}>
                    Expires in {daysLeft} days
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>

        {/* TOP PERFORMERS */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>
            <Feather name="award" size={20} color={GOLD} /> Top Performers
          </Text>

          {topPerformers.length === 0 ? (
            <Text style={styles.emptyText}>No flips yet.</Text>
          ) : (
            topPerformers.map((v) => {
              const profit =
                (v.sellPrice ?? v.valuation ?? 0) -
                (v.buyPrice ?? 0);

              return (
                <Pressable
                  key={v.id}
                  style={styles.topCard}
                  onPress={() =>
                    router.push(`/vehicles/overview/${v.id}`)
                  }
                >
                  <Text style={styles.topTitle}>{v.title}</Text>
                  <Text style={styles.topMeta}>Profit: £{profit}</Text>
                </Pressable>
              );
            })
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
            monthly.map(([month, profit]) => (
              <View key={month} style={{ marginBottom: 10 }}>
                <Text style={{ color: SILVER }}>
                  {month}: £{profit.toFixed(0)}
                </Text>

                <View style={styles.timelineBar}>
                  <View
                    style={[
                      styles.timelineFill,
                      {
                        width: Math.min(100, profit / 10),
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
