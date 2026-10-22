import React from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/styles/ThemeContext";

/**
 * "Trade" on a card, "Trade seller" on the listing's own page: this car is sold by a business, not a private seller. Outlined
 * rather than filled, so it is never mistaken for "Promoted" or "Sponsored", which are paid for.
 */
export default function TradeBadge({ long }: { long?: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel="Trade seller"
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: long ? 10 : 8,
        paddingVertical: long ? 4 : 2,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.goldDeep,
        backgroundColor: theme.background,
      }}
    >
      <Text style={{ color: theme.goldDeep, fontSize: long ? 12 : 10, fontWeight: "800" }}>{long ? "Trade seller" : "Trade"}</Text>
    </View>
  );
}
