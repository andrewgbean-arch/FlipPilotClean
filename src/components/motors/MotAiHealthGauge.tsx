import { View, Animated, Text } from "react-native";
import { useEffect, useRef } from "react";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiHealthGauge({ ai, theme }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: ai.healthScore,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [ai.healthScore]);

  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
      }}
    >
      {/* SCORE TEXT */}
      <View style={{ position: "absolute" }}>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: theme.accent,
          }}
        >
          {ai.healthScore}
        </Text>
      </View>

      {/* BACKGROUND CIRCLE */}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: theme.blackSoft,
          position: "absolute",
        }}
      />

      {/* FOREGROUND ARC */}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: theme.accent,
          position: "absolute",
          transform: [{ rotate: "-90deg" }],
          borderStyle: "solid",
          borderRightColor: "transparent",
          borderBottomColor: "transparent",
          borderLeftColor: "transparent",
          opacity: 0.9,
        }}
      />
    </View>
  );
}
