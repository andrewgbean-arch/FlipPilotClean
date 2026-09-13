import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import GoldButton from "@/components/ui/GoldButton";

import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
} from "@expo/vector-icons";

export default function VehiclesHome() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* HEADER */}
      <Text style={styles.title}>Vehicles</Text>
      <Text style={styles.subtitle}>Manage, track and enhance your fleet.</Text>

      {/* ADD NEW VEHICLE */}
      <View style={styles.fullWidth}>
        <GoldButton onPress={() => router.push("/vehicles/new")}>
          <Ionicons name="car-outline" size={22} /> Add New Vehicle
        </GoldButton>
      </View>

      {/* QUICK ACTIONS */}
      <Text style={styles.sectionHeader}>Quick Actions</Text>
      <View style={styles.quickRow}>
        <GoldButton onPress={() => router.push("/vehicles/list")}>
          <MaterialCommunityIcons name="garage" size={20} /> Your Flips
        </GoldButton>

        <GoldButton onPress={() => router.push("/scan")}>
          <MaterialCommunityIcons name="barcode-scan" size={20} /> VIN Scanner
        </GoldButton>
      </View>

      {/* TOOLS */}
      <Text style={styles.sectionHeader}>Tools</Text>
      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <GoldButton onPress={() => router.push("/vehicles/mot-lookup")}>
            <FontAwesome5 name="clipboard-check" size={18} /> MOT Checker
          </GoldButton>
        </View>

        <View style={styles.gridItem}>
          <GoldButton onPress={() => router.push("/marketplace")}>
            <MaterialCommunityIcons name="storefront-outline" size={20} /> Browse Listings
          </GoldButton>
        </View>

        <View style={styles.gridItem}>
          <GoldButton onPress={() => router.push("/marketplace/PublishFlip")}>
            <MaterialCommunityIcons name="upload" size={20} /> Publish a Flip
          </GoldButton>
        </View>
      </View>
    </ScrollView>
  );
}

const FP_BLUE = "#0A1128";
const GOLD = "#FFD700";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FP_BLUE,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  title: {
    color: GOLD,
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 6,
  },

  subtitle: {
    color: "#aaa",
    fontSize: 15,
    marginBottom: 25,
  },

  sectionHeader: {
    color: GOLD,
    fontSize: 20,
    fontWeight: "600",
    marginVertical: 14,
  },

  fullWidth: {
    width: "100%",
    marginBottom: 25,
  },

  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  gridItem: {
    width: "48%",
    marginBottom: 20,
  },
});
