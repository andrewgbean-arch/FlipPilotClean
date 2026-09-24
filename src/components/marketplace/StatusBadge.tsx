import React from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/styles/ThemeContext";

/**
 * "Reserved" or "Sold" on a listing. Nothing at all for an available one, so
 * an ordinary listing looks the way it always did. `long` spells out what a
 * reservation means, for the listing's own page.
 */
export default function StatusBadge({
  status,
  long,
}: {
  status?: string | null;
  long?: boolean;
}) {
  const theme = useTheme();
  if (status !== "reserved" && status !== "sold" && status !== "expired") return null;

  const sold = status === "sold";
  const expired = status === "expired";
  const colour = sold ? theme.danger : expired ? theme.muted : theme.warning;
  const label = sold
    ? "Sold"
    : expired
    ? long
      ? "Expired · relist to put it back"
      : "Expired"
    : long
    ? "Reserved · awaiting outcome"
    : "Reserved";

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colour,
        backgroundColor: theme.background,
      }}
    >
      <Text style={{ color: colour, fontWeight: "800", fontSize: 12 }}>{label}</Text>
    </View>
  );
}
