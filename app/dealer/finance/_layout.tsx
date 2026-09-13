import React from "react";
import { Stack } from "expo-router";
import { View, StyleSheet } from "react-native";

import DealerNeonHeader from "../../../src/components/dealer/DealerNeonHeader";
import FinanceSuiteQuickActions from "./quickactions";

export default function FinanceSuiteLayout() {
  return (
    <View style={styles.container}>
      {/* Global FinanceSuite Header */}
      <DealerNeonHeader 
        title="Finance Suite" 
        subtitle="Advanced Dealer Finance Tools"
      />

      {/* Expo Router Stack */}
      <View style={styles.stackContainer}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
          }}
        />
      </View>

      {/* Floating QuickActions Bar */}
      <FinanceSuiteQuickActions />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
  },
  stackContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
});
