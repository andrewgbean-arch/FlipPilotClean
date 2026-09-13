import { View, Text, Animated, StyleSheet } from "react-native";
import { useEffect, useRef } from "react";

export interface HeroHeaderProps {
  title: string;
  subtitle?: string;
  glow?: boolean;
  icon?: string;            // ⭐ NEW — optional emoji/icon
  badge?: string;           // ⭐ NEW — optional dealer mode badge
  action?: React.ReactNode; // ⭐ NEW — optional right‑side action button
  theme?: any;              // ⭐ theme support (preserved)
}

export default function HeroHeader({
  title,
  subtitle,
  glow,
  icon,
  badge,
  action,
  theme,
}: HeroHeaderProps) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-20)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

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

  const shimmerColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,215,0,0.15)", "rgba(255,215,0,0.45)"],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity: fade,
          transform: [{ translateY: slide }],
          shadowColor: glow ? "#FFD700" : "transparent",
          shadowOpacity: glow ? 0.45 : 0,
          shadowRadius: glow ? 18 : 0,
          borderBottomWidth: glow ? 2 : 0,
          borderColor: glow ? "#FFD700" : "transparent",

          // ⭐ theme support (preserved)
          backgroundColor: theme?.background ?? "#0A1128",
        },
      ]}
    >
      {glow && (
        <Animated.View
          style={[
            styles.shimmerLayer,
            {
              backgroundColor: shimmerColor,
            },
          ]}
        />
      )}

      {/* ⭐ NEW — top row with optional action */}
      <View style={styles.topRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {icon && (
            <Text style={{ fontSize: 32, marginRight: 4 }}>
              {icon}
            </Text>
          )}

          <Text
            style={[
              styles.title,
              {
                color: theme?.accent ?? "#FFD700",
                textShadowColor: theme?.accent ?? "#FFD700",
              },
            ]}
          >
            {title}
          </Text>
        </View>

        {action && <View>{action}</View>}
      </View>

      {subtitle && (
        <Text
          style={[
            styles.subtitle,
            {
              color: theme?.secondary ?? "#E5ECFF",
            },
          ]}
        >
          {subtitle}
        </Text>
      )}

      {/* ⭐ NEW — Dealer Mode Badge */}
      {badge && (
        <View
          style={{
            marginTop: 10,
            alignSelf: "flex-start",
            backgroundColor: theme?.accent ?? "#FFD700",
            paddingVertical: 4,
            paddingHorizontal: 12,
            borderRadius: 8,
          }}
        >
          <Text
            style={{
              color: theme?.background ?? "#0A1128",
              fontWeight: "800",
            }}
          >
            {badge}
          </Text>
        </View>
      )}

      {/* ⭐ NEW — Gradient underline bar */}
      <View
        style={{
          height: 4,
          marginTop: 18,
          borderRadius: 4,
          backgroundColor: theme?.goldSoftGlow ?? "rgba(255,215,0,0.35)",
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 34,
    paddingHorizontal: 22,
    position: "relative",
  },

  shimmerLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "100%",
    opacity: 0.35,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    textShadowRadius: 14,
  },

  subtitle: {
    fontSize: 16,
    marginTop: 6,
    opacity: 0.85,
  },
});
