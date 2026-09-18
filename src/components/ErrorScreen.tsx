import { Feather } from "@expo/vector-icons";
import { router, type ErrorBoundaryProps } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { freeTheme as theme } from "@/styles/theme";

// Static palette on purpose: this renders in place of the whole app, so the
// providers the normal screens rely on (theme context etc.) may not exist.
export function RouteErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const goHome = () => {
    router.replace("/home");
    void retry();
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Feather name="alert-triangle" size={32} color={theme.gold} />
      </View>

      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>
        FlipPilot hit an unexpected problem on this screen. Try again, or head back to the home tab.
      </Text>

      {__DEV__ ? (
        <Text style={styles.devError} numberOfLines={5}>
          {error.message}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        onPress={() => void retry()}
      >
        <Text style={styles.primaryText}>Try again</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        onPress={goHome}
      >
        <Text style={styles.secondaryText}>Back to home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: theme.background,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.goldSoftGlow,
    marginBottom: 20,
  },
  title: {
    color: theme.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  devError: {
    color: theme.danger,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
  },
  primary: {
    minWidth: 220,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.gold,
  },
  primaryText: {
    color: theme.black,
    fontSize: 16,
    fontWeight: "800",
  },
  secondary: {
    minWidth: 220,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryText: {
    color: theme.gold,
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
});
