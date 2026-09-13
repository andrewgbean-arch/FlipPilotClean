import { View, Text, Animated, Easing } from "react-native";
import { useEffect, useRef } from "react";
import { useTheme } from "@/styles/ThemeContext";
import { layout } from "@/styles/layout";

// ⭐ Add this
type DealerNeonHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function DealerNeonHeader({ title, subtitle }: DealerNeonHeaderProps) {
  const theme = useTheme();

  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const glowColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.goldSoftGlow, theme.goldHardGlow],
  });

  return (
    <Animated.View
      style={{
        paddingVertical: layout.spacing.lg,
        paddingHorizontal: layout.spacing.md,
        alignItems: "center",
        backgroundColor: glowColor,
        borderBottomLeftRadius: layout.radius.lg,
        borderBottomRightRadius: layout.radius.lg,
        ...layout.shadow.glow,
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "900",
          color: theme.background,
          textShadowColor: theme.goldHardGlow,
          textShadowRadius: 8,
        }}
      >
        {title}
      </Text>

      {subtitle && (
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: theme.background,
            opacity: 0.8,
            marginTop: 4,
          }}
        >
          {subtitle}
        </Text>
      )}
    </Animated.View>
  );
}
