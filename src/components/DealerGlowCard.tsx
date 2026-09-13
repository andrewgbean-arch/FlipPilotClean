import { View, Text, Animated } from "react-native";
import { ReactNode, useRef, useEffect } from "react";
import { Theme } from "@/styles/theme";

interface DealerGlowCardProps {
  title: string;
  children: ReactNode;
  theme: Theme;

  // ⭐ NEW optional premium props
  subtitle?: string;
  icon?: string;
  badge?: string;
  footer?: ReactNode;
  compact?: boolean;
  shimmer?: boolean;
  gradientBar?: boolean;
}

export function DealerGlowCard({
  title,
  children,
  theme,
  subtitle,
  icon,
  badge,
  footer,
  compact,
  shimmer,
  gradientBar,
}: DealerGlowCardProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shimmer) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [shimmer]);

  const shimmerColor = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,215,0,0.15)", "rgba(255,215,0,0.45)"],
  });

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: theme.radius.lg,
        padding: compact ? theme.spacing.md : theme.spacing.lg,
        marginBottom: theme.spacing.lg,

        shadowColor: theme.accent,
        shadowOpacity: 0.45,
        shadowRadius: 18,
        elevation: 10,

        borderWidth: 1,
        borderColor: theme.goldSoftGlow,

        position: "relative",
        overflow: "hidden",
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
          }}
        />
      )}

      {/* ⭐ Title Row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {icon && (
          <Text style={{ fontSize: 26 }}>
            {icon}
          </Text>
        )}

        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: theme.text,
            marginBottom: subtitle ? theme.spacing.xs : theme.spacing.sm,
          }}
        >
          {title}
        </Text>

        {badge && (
          <View
            style={{
              backgroundColor: theme.accent,
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: theme.radius.md,
              marginLeft: "auto",
            }}
          >
            <Text
              style={{
                color: theme.background,
                fontWeight: "800",
              }}
            >
              {badge}
            </Text>
          </View>
        )}
      </View>

      {/* ⭐ Optional subtitle */}
      {subtitle && (
        <Text
          style={{
            color: theme.secondary,
            marginBottom: theme.spacing.sm,
            fontSize: 15,
            opacity: 0.85,
          }}
        >
          {subtitle}
        </Text>
      )}

      {/* ⭐ Divider */}
      <View
        style={{
          height: 1,
          backgroundColor: theme.cardElevated,
          marginBottom: theme.spacing.md,
          opacity: 0.4,
        }}
      />

      {/* ⭐ Content */}
      {children}

      {/* ⭐ Optional footer */}
      {footer && (
        <View style={{ marginTop: theme.spacing.md }}>
          {footer}
        </View>
      )}

      {/* ⭐ Optional gradient underline */}
      {gradientBar && (
        <View
          style={{
            height: 3,
            marginTop: theme.spacing.md,
            borderRadius: 3,
            backgroundColor: theme.goldSoftGlow,
            opacity: 0.55,
          }}
        />
      )}
    </View>
  );
}
