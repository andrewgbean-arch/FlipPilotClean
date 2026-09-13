import { View, Text, Animated } from "react-native";
import { Theme } from "@/styles/theme";
import { useRef, useEffect } from "react";

interface MetricRowProps {
  label: string;
  value: string | number;
  theme: Theme;

  // ⭐ NEW optional premium features
  icon?: string;
  badge?: string;
  trend?: "up" | "down";
  danger?: boolean;
  success?: boolean;
  percentage?: boolean;
  compact?: boolean;
  divider?: boolean;
  shimmer?: boolean;
  highlight?: boolean;
  accentValue?: boolean;
}

export function MetricRow({
  label,
  value,
  theme,
  icon,
  badge,
  trend,
  danger,
  success,
  percentage,
  compact,
  divider,
  shimmer,
  highlight,
  accentValue,
}: MetricRowProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shimmer) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [shimmer]);

  const shimmerColor = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,215,0,0.15)", "rgba(255,215,0,0.45)"],
  });

  // ⭐ Trend arrows
  const trendArrow =
    trend === "up" ? "▲" : trend === "down" ? "▼" : null;

  // ⭐ Value color logic
  const valueColor = danger
    ? "#FF4444"
    : success
    ? "#66FF99"
    : accentValue
    ? theme.accent
    : theme.text;

  return (
    <View
      style={{
        marginBottom: compact ? theme.spacing.xs : theme.spacing.sm,
        paddingVertical: compact ? 2 : 4,
        position: "relative",
      }}
    >
      {/* ⭐ Optional shimmer layer */}
      {shimmer && (
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "100%",
            backgroundColor: shimmerColor,
            opacity: 0.35,
            borderRadius: 6,
          }}
        />
      )}

      {/* ⭐ Row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* ⭐ Left side */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {icon && (
            <Text style={{ fontSize: 16 }}>
              {icon}
            </Text>
          )}

          <Text
            style={{
              color: highlight ? theme.accent : theme.secondary,
              fontSize: compact ? 14 : 15,
              fontWeight: "600",
            }}
          >
            {label}
          </Text>
        </View>

        {/* ⭐ Right side */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {trendArrow && (
            <Text
              style={{
                color: trend === "up" ? "#66FF99" : "#FF4444",
                fontWeight: "800",
              }}
            >
              {trendArrow}
            </Text>
          )}

          <Text
            style={{
              color: valueColor,
              fontSize: compact ? 15 : 16,
              fontWeight: "700",
            }}
          >
            {percentage ? `${value}%` : value}
          </Text>

          {badge && (
            <View
              style={{
                backgroundColor: theme.accent,
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: theme.radius.sm,
              }}
            >
              <Text
                style={{
                  color: theme.background,
                  fontWeight: "800",
                  fontSize: 12,
                }}
              >
                {badge}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ⭐ Optional divider */}
      {divider && (
        <View
          style={{
            height: 1,
            backgroundColor: theme.cardElevated,
            opacity: 0.3,
            marginTop: theme.spacing.xs,
          }}
        />
      )}
    </View>
  );
}
