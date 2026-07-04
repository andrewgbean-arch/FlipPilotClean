import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, ViewStyle } from "react-native";
import ThemedText from "./ThemedText";

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------
interface GoldButtonProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  theme: {
    goldDeep: string;
    accent: string;
    black: string;
  };
}

// ------------------------------------------------------
// COMPONENT
// ------------------------------------------------------
export default function GoldButton({
  title,
  subtitle,
  onPress,
  theme,
}: GoldButtonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const glow = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          borderColor: theme.goldDeep,
          shadowColor: theme.goldDeep,
          shadowOpacity: glow,
        } as ViewStyle,
      ]}
    >
      <Pressable
        style={[styles.button, { backgroundColor: theme.accent }]}
        onPress={onPress}
      >
        <ThemedText style={[styles.title, { color: theme.black }]}>
          {title}
        </ThemedText>

        {subtitle && (
          <ThemedText style={[styles.subtitle, { color: theme.black }]}>
            {subtitle}
          </ThemedText>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  wrapper: {
    width: "92%",
    alignSelf: "center",
    borderWidth: 3,
    borderRadius: 20,
    marginTop: 22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  button: {
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    opacity: 0.85,
    fontSize: 14,
    marginTop: 4,
  },
});
