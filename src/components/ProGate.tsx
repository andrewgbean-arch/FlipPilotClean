import { useSubscription } from "../context/SubscriptionContext";

import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ProGate({ children }: { children: React.ReactNode }) {
  const { isPro } = useSubscription();

  if (isPro) return <>{children}</>;

  return (
    <View style={styles.locked}>
      <Text style={styles.title}>🔒 Pro Feature</Text>
      <Text style={styles.subtitle}>Unlock FlipPilot Pro to access this feature</Text>

      <Pressable style={styles.button} onPress={() => router.push("/upgrade")}>
        <Text style={styles.buttonText}>Upgrade to Pro</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  locked: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFD700",
    marginBottom: 10,
  },
  subtitle: {
    color: "#AFC6FF",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#FFD700",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  buttonText: {
    color: "#0A1128",
    fontWeight: "800",
    fontSize: 16,
  },
});
