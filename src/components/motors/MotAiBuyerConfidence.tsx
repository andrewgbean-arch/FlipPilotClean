import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiBuyerConfidence({ ai, theme }: Props) {
  const score =
    ai.healthScore * 0.5 +
    ai.predictedPassChance * 0.3 -
    ai.failureSeverity * 0.2;

  const rounded = Math.max(0, Math.min(100, Math.round(score)));

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
          fontSize: 22,
          fontWeight: "800",
          color: theme.accent,
          marginBottom: 12,
        }}
      >
        ⭐ Buyer Confidence Score
      </Text>

      <Text
        style={{
          color: theme.accent,
          fontSize: 32,
          fontWeight: "800",
        }}
      >
        {rounded} / 100
      </Text>

      <Text style={{ color: theme.text, marginTop: 6 }}>
        Higher score = easier to sell, stronger buyer trust.
      </Text>
    </View>
  );
}
