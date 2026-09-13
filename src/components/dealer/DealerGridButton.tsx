import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { router } from "expo-router";

const NAVY = "#0A1128";
const GOLD = "#FFD700";
const SILVER = "#AAB4C3";
const CARD = "#111827";

export type DealerGridButtonProps = {
  label: string;
  icon: string;
  route: string;
};

export function DealerGridButton({ label, icon, route }: DealerGridButtonProps) {
  return (
    <TouchableOpacity
      onPress={() => router.push(route)}
      style={{
        backgroundColor: CARD,
        borderRadius: 20,
        paddingVertical: 24,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: GOLD,
        width: "48%",
        marginBottom: 16,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: GOLD, fontSize: 28, fontWeight: "900" }}>
        {icon}
      </Text>
      <Text
        style={{
          color: SILVER,
          fontSize: 16,
          marginTop: 8,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
