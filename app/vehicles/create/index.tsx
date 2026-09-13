import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

const NAVY = "#0A1128";
const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

export default function CreateVehicleMenu() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Vehicle Flip</Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push("/vehicles/create/new")}
      >
        <Feather name="plus-circle" size={22} color={GOLD} />
        <Text style={styles.buttonLabel}>Add New Flip</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() => router.push("/vehicles/edit")}
      >
        <MaterialCommunityIcons
          name="file-edit-outline"
          size={22}
          color={GOLD}
        />
        <Text style={styles.buttonLabel}>Edit Existing Flip</Text>
      </Pressable>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    padding: 20,
  },
  title: {
    color: GOLD,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: GOLD,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  buttonLabel: {
    color: SILVER,
    fontSize: 16,
    fontWeight: "700",
  },
});
