import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiFutureTimeline({ ai, theme }: Props) {
  const years = [1, 2, 3];

  const predict = (year: number) => {
    const decay = year * 0.12; // 12% per year
    const score = Math.max(0, ai.healthScore * (1 - decay));
    const passChance =
      score >= 80 ? 90 :
      score >= 60 ? 75 :
      score >= 40 ? 55 :
      score >= 20 ? 35 : 15;

    return { score: Math.round(score), passChance };
  };

  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: 14,
        marginBottom: 20,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: theme.accent,
          marginBottom: 10,
        }}
      >
        📅 Future MOT Timeline
      </Text>

      {years.map((y) => {
        const p = predict(y);
        return (
          <View key={y} style={{ marginBottom: 12 }}>
            <Text style={{ color: theme.text, fontSize: 16 }}>
              Year +{y}
            </Text>

            <Text
              style={{
                color: theme.accent,
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Health: {p.score} / 100
            </Text>

            <Text style={{ color: theme.text }}>
              Pass Chance: {p.passChance}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}
