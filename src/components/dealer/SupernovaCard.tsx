import { View, Text, Animated } from "react-native";
import { ReactNode, useRef, useEffect } from "react";

interface SupernovaCardProps {
  title: string;
  children: ReactNode;
  glow?: boolean;

  // ⭐ NEW optional premium props
  icon?: string;
  badge?: string;
  subtitle?: string;
  footer?: ReactNode;
  compact?: boolean;
  shimmer?: boolean;
  danger?: boolean;
  success?: boolean;
  accentTitle?: boolean;
  divider?: boolean;
  gradientBar?: boolean;

  // ⭐ NEW — required for dealer-motors-dashboard & dealer-stock
  style?: any;
}

export default function SupernovaCard({
  title,
  children,
  glow,
  icon,
  badge,
  subtitle,
  footer,
  compact,
  shimmer,
  danger,
  success,
  accentTitle,
  divider,
  gradientBar,
  style, // ⭐ added
}: SupernovaCardProps) {
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

  const titleColor = danger
    ? "#FF4444"
    : success
    ? "#66FF99"
    : accentTitle
    ? "#FFD700"
    : "#E5ECFF";

  return (
    <View
      style={[
        {
          backgroundColor: "#0A1128",
          borderRadius: 14,
          padding: compact ? 14 : 18,
          marginBottom: 20,

          shadowColor: glow ? "#FFD700" : "transparent",
          shadowOpacity: glow ? 0.45 : 0,
          shadowRadius: glow ? 18 : 0,
          elevation: glow ? 10 : 0,

          borderWidth: glow ? 1 : 0,
          borderColor: glow ? "rgba(255,215,0,0.35)" : "transparent",

          position: "relative",
          overflow: "hidden",
        },

        // ⭐ external style override support
        style,
      ]}
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
            color: titleColor,
            fontSize: 20,
            fontWeight: "800",
          }}
        >
          {title}
        </Text>

        {badge && (
          <View
            style={{
              backgroundColor: "#FFD700",
              paddingVertical: 3,
              paddingHorizontal: 10,
              borderRadius: 8,
              marginLeft: "auto",
            }}
          >
            <Text
              style={{
                color: "#0A1128",
                fontWeight: "800",
                fontSize: 12,
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
            color: "#E5ECFF",
            opacity: 0.85,
            marginTop: 6,
            marginBottom: 10,
            fontSize: 15,
          }}
        >
          {subtitle}
        </Text>
      )}

      {/* ⭐ Divider */}
      {divider !== false && (
        <View
          style={{
            height: 1,
            backgroundColor: "rgba(255,255,255,0.1)",
            marginVertical: 12,
          }}
        />
      )}

      {/* ⭐ Content */}
      {children}

      {/* ⭐ Optional footer */}
      {footer && (
        <View style={{ marginTop: 14 }}>
          {footer}
        </View>
      )}

      {/* ⭐ Optional gradient underline */}
      {gradientBar && (
        <View
          style={{
            height: 3,
            marginTop: 14,
            borderRadius: 3,
            backgroundColor: "rgba(255,215,0,0.45)",
          }}
        />
      )}
    </View>
  );
}
