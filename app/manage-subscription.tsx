import { Pressable, StyleSheet, Text, View } from "react-native";
import Purchases from "react-native-purchases";
import * as Linking from "expo-linking";

export default function ManageSubscription() {

  const openPortal = async () => {
    try {
      const url = await Purchases.getManageSubscriptionURL();

      if (url) {
        Linking.openURL(url);
      } else {
        console.log("No subscription URL returned");
      }

    } catch (err) {
      console.log("Manage subscription error:", err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Subscription</Text>
      <Text style={styles.sub}>Update, cancel, or change your plan</Text>

      <View style={styles.divider} />

      <Pressable style={styles.button} onPress={openPortal}>
        <Text style={styles.buttonText}>Open Subscription Portal</Text>
      </Pressable>

      <Text style={styles.note}>
        This will open your device’s subscription settings.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFD700",
    marginBottom: 6,
  },
  sub: {
    color: "#AFC6FF",
    fontSize: 16,
    marginBottom: 20,
  },
  divider: {
    width: "70%",
    height: 1,
    backgroundColor: "#1F2A44",
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#FFD700",
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: 12,
    shadowColor: "#FFD700",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  buttonText: {
    color: "#0A1128",
    fontWeight: "800",
    fontSize: 17,
  },
  note: {
    marginTop: 20,
    color: "#AFC6FF",
    fontSize: 13,
    textAlign: "center",
    opacity: 0.8,
  },
});

