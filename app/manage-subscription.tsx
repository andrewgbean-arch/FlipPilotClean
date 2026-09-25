import { Pressable, StyleSheet, Text, View } from "react-native";
import GoldFoil from "@/components/ui/GoldFoil";
import Purchases from "react-native-purchases";
import { CreditCard } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";

export default function ManageSubscription() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const openPortal = async () => {
    try {
      await Purchases.showManageSubscriptions();
    } catch (err) {
      console.log("Manage subscription error:", err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.body}>
        <View
          style={[styles.icon, { backgroundColor: theme.card, borderColor: theme.goldSoftGlow }]}
        >
          <CreditCard size={30} color={theme.gold} />
        </View>

        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          Update, cancel, or change your plan
        </Text>
      </View>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.hairline,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open subscription portal"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.gold, overflow: "hidden" },
            pressed && styles.pressed,
          ]}
          onPress={openPortal}
        >
          <GoldFoil />
          <Text style={[styles.buttonText, { color: theme.black }]}>Open subscription portal</Text>
        </Pressable>

        <Text style={[styles.note, { color: theme.muted }]}>
          This will open your device’s subscription settings.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  note: {
    marginTop: 12,
    fontSize: 13,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.75,
  },
});
