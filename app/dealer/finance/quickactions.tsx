import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import DealerNeonHeader from "../../../src/components/dealer/DealerNeonHeader";
import SupernovaCard from "../../../src/components/dealer/SupernovaCard";

export default function FinanceSuiteQuickActions() {
  const { vehicle: v, buyer: b } = useLocalSearchParams();

  const vehicle = typeof v === "string" ? JSON.parse(v) : v;
  const buyer = typeof b === "string" ? JSON.parse(b) : b;

  const go = (path: string) => {
    router.push({
      pathname: `/dealer/finance/${path}`,   // ⭐ FIXED ROUTE
      params: {
        vehicle: JSON.stringify(vehicle),
        buyer: JSON.stringify(buyer),
      },
    });
  };

  return (
    <View style={styles.container}>
      {/* ⭐ FIXED HEADER */}
      <DealerNeonHeader 
        title="FinanceSuite Quick Actions"
        subtitle="Instant access to V16 tools"
      />

      <Text style={styles.heading}>Quick Actions</Text>
      <Text style={styles.subheading}>Instant access to FinanceSuiteV16 tools</Text>

      {/* ⭐ FIXED CARD */}
      <SupernovaCard 
        title="Quick Actions"
        glow
        style={styles.card}
      >
        <Pressable style={styles.action} onPress={() => go("dashboard")}>
          <Text style={styles.actionText}>📊 Finance Dashboard</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => go("deposit")}>
          <Text style={styles.actionText}>💰 Deposit Optimiser</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => go("apr")}>
          <Text style={styles.actionText}>📈 APR Sensitivity</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => go("stress")}>
          <Text style={styles.actionText}>⚠️ Stress Test</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => go("lender")}>
          <Text style={styles.actionText}>🏦 Lender Match</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => go("closing")}>
          <Text style={styles.actionText}>📝 Closing Script</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={() => go("compliance")}>
          <Text style={styles.actionText}>⚖️ Compliance Check</Text>
        </Pressable>
      </SupernovaCard>

      {/* Floating Action Bar */}
      <View style={styles.fabContainer}>
        <Pressable style={styles.fab} onPress={() => go("dashboard")}>
          <Text style={styles.fabText}>📊</Text>
        </Pressable>

        <Pressable style={styles.fab} onPress={() => go("deposit")}>
          <Text style={styles.fabText}>💰</Text>
        </Pressable>

        <Pressable style={styles.fab} onPress={() => go("apr")}>
          <Text style={styles.fabText}>📈</Text>
        </Pressable>

        <Pressable style={styles.fab} onPress={() => go("stress")}>
          <Text style={styles.fabText}>⚠️</Text>
        </Pressable>

        <Pressable style={styles.fab} onPress={() => go("lender")}>
          <Text style={styles.fabText}>🏦</Text>
        </Pressable>

        <Pressable style={styles.fab} onPress={() => go("closing")}>
          <Text style={styles.fabText}>📝</Text>
        </Pressable>

        <Pressable style={styles.fab} onPress={() => go("compliance")}>
          <Text style={styles.fabText}>⚖️</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  heading: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFD700",
    marginTop: 20,
    textAlign: "center",
  },
  subheading: {
    fontSize: 15,
    color: "#ccc",
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    marginTop: 20,
  },
  action: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  actionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFD700",
  },
  fabContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
  fab: {
    backgroundColor: "#FFD700",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  fabText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0A1128",
  },
});
