import { useSubscription } from "../context/SubscriptionContext";
import { useTheme } from "@/styles/ThemeContext";

import { StyleSheet, Text, View } from "react-native";

// A small, quiet marker shown while the Trader plan is active: a thin gold outline, no fill.
export default function ProBadge() {
  const { isPro } = useSubscription();
  const theme = useTheme();

  if (!isPro) return null;

  return (
    <View
      accessible
      accessibilityLabel="Trader plan"
      style={[styles.badge, { backgroundColor: theme.background, borderColor: theme.gold }]}
    >
      <Text style={[styles.text, { color: theme.gold }]}>TRADER</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-end",
    marginRight: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
});
