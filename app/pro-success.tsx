import { router } from "expo-router";
import { Check } from "phosphor-react-native";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";

export default function ProSuccess() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    // Straight to Home: "/" would replay the launch animation after a purchase.
    const timer = setTimeout(() => router.replace("/home"), 2000);
    return () => clearTimeout(timer);
  }, [scale]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <Animated.View
        style={[styles.badge, { backgroundColor: theme.gold, transform: [{ scale }] }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Check size={44} weight="bold" color={theme.black} />
      </Animated.View>

      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        You're Pro
      </Text>
      <Text style={[styles.message, { color: theme.muted }]} accessibilityLiveRegion="polite">
        Everything in Pro is now unlocked.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    fontSize: 16,
    textAlign: "center",
  },
});
