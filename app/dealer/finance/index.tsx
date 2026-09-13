import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import DealerNeonHeader from "../../../src/components/dealer/DealerNeonHeader";
import SupernovaCard from "../../../src/components/dealer/SupernovaCard";

export default function FinanceSuiteHome() {
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
    <ScrollView style={styles.container}>
      {/* ⭐ FIX: Add required props */}
      <DealerNeonHeader 
        title="Finance Suite V16"
        subtitle="Advanced Dealer Finance Intelligence"
      />

      <Text style={styles.heading}>Finance Suite V16</Text>
      <Text style={styles.subheading}>Advanced Dealer Finance Intelligence</Text>

      {/* Dashboard */}
      <SupernovaCard title="Finance Dashboard" glow style={styles.card}>
        <Pressable onPress={() => go("dashboard")}>
          <Text style={styles.link}>📊 Finance Dashboard</Text>
        </Pressable>
      </SupernovaCard>

      {/* Deposit */}
      <SupernovaCard title="Deposit Optimiser" glow style={styles.card}>
        <Pressable onPress={() => go("deposit")}>
          <Text style={styles.link}>💰 Deposit Optimiser</Text>
        </Pressable>
      </SupernovaCard>

      {/* APR */}
      <SupernovaCard title="APR Sensitivity Model" glow style={styles.card}>
        <Pressable onPress={() => go("apr")}>
          <Text style={styles.link}>📈 APR Sensitivity Model</Text>
        </Pressable>
      </SupernovaCard>

      {/* Stress Test */}
      <SupernovaCard title="Payment Stress Test" glow style={styles.card}>
        <Pressable onPress={() => go("stress")}>
          <Text style={styles.link}>⚠️ Payment Stress Test</Text>
        </Pressable>
      </SupernovaCard>

      {/* Lender Match */}
      <SupernovaCard title="Lender Match Engine" glow style={styles.card}>
        <Pressable onPress={() => go("lender")}>
          <Text style={styles.link}>🏦 Lender Match Engine</Text>
        </Pressable>
      </SupernovaCard>

      {/* Closing Script */}
      <SupernovaCard title="Finance Closing Script" glow style={styles.card}>
        <Pressable onPress={() => go("closing")}>
          <Text style={styles.link}>📝 Finance Closing Script</Text>
        </Pressable>
      </SupernovaCard>

      {/* Compliance */}
      <SupernovaCard title="FCA Compliance Check" glow style={styles.card}>
        <Pressable onPress={() => go("compliance")}>
          <Text style={styles.link}>⚖️ FCA Compliance Check</Text>
        </Pressable>
      </SupernovaCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
    paddingHorizontal: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFD700",
    marginTop: 20,
    textAlign: "center",
  },
  subheading: {
    fontSize: 16,
    color: "#ccc",
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    marginTop: 20,
  },
  link: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFD700",
  },
});
