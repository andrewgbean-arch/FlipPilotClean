import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";

export default function MOTHealthScore({
  history,
  theme,
}: {
  history: { mileage: number; date: string }[];
  theme: any;
}) {
  // ⭐ Compute MOT Health Score (mileage consistency)
  const motHealthScore = (() => {
    if (!history || history.length < 2) return 70;

    let score = 80;
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].mileage;
      const curr = history[i].mileage;
      if (curr < prev) score -= 15;
    }
    return Math.max(0, Math.min(100, score));
  })();

  // ⭐ Animated Gauge
  const gauge = useSharedValue(0);
  gauge.value = withTiming(motHealthScore, { duration: 800 });

  const gaugeStyle = useAnimatedStyle(() => ({
    width: `${gauge.value}%`,
  }));

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: theme.goldDeep,
        backgroundColor: theme.card,
        marginBottom: 20,
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: theme.accent,
          marginBottom: 6,
        }}
      >
        🚦 MOT Health Score
      </Text>

      {/* Gauge Bar */}
      <View
        style={{
          height: 14,
          backgroundColor: theme.muted,
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 10,
        }}
      >
        <Animated.View
          style={[
            {
              height: "100%",
              backgroundColor: theme.accent,
            },
            gaugeStyle,
          ]}
        />
      </View>

      {/* Score Number */}
      <Text
        style={{
          fontSize: 32,
          fontWeight: "700",
          color: theme.accent,
          marginBottom: 4,
          textAlign: "center",
        }}
      >
        {motHealthScore}/100
      </Text>

      <Text style={{ fontSize: 14, color: theme.text }}>
        Based on mileage consistency over MOT history.
      </Text>
    </View>
  );
}
