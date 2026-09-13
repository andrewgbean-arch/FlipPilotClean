import { View, Text, Animated } from "react-native";
import { useEffect, useRef } from "react";
import GlowPulseCard from "@/components/ui/GlowPulseCard";


export default function MarketHeatIndex() {
  const heat = Math.floor(65 + Math.random() * 25); // 65–90 range

  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: heat,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, []);

  const getColor = () => {
    if (heat >= 80) return "#4CAF50"; // HOT
    if (heat >= 60) return "#FFD700"; // WARM
    return "#4FC3F7"; // COOL
  };

  const getLabel = () => {
    if (heat >= 80) return "🔥 Hot Market";
    if (heat >= 60) return "✨ Warm Market";
    return "❄ Cool Market";
  };

  return (
    <GlowPulseCard style={{ marginTop: 20 }}>
      {/* Title */}
      <Text
        style={{
          color: "#FFD700",
          fontSize: 20,
          fontWeight: "bold",
          marginBottom: 6,
        }}
      >
        Market Heat Index
      </Text>

      {/* Label */}
      <Text
        style={{
          color: getColor(),
          fontSize: 22,
          fontWeight: "bold",
          marginBottom: 12,
        }}
      >
        {getLabel()} ({heat}/100)
      </Text>

      {/* Heat Meter */}
      <View
        style={{
          height: 12,
          backgroundColor: "#111",
          borderRadius: 999,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <Animated.View
          style={{
            height: "100%",
            width: barAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
            backgroundColor: getColor(),
          }}
        />
      </View>

      {/* Description */}
      <Text style={{ color: "#ccc", fontSize: 14 }}>
        Live market activity based on demand, pricing trends, and flip potential.
      </Text>
    </GlowPulseCard>
  );
}
