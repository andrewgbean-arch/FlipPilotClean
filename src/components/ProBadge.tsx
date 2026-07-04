import { useSubscription } from "../context/SubscriptionContext";

import { StyleSheet, Text, View } from "react-native";

export default function ProBadge() {
  const { isPro } = useSubscription();

  if (!isPro) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>⭐ PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-end",
    marginRight: 10,
  },
  text: {
    color: "#0A1128",
    fontWeight: "900",
  },
});


