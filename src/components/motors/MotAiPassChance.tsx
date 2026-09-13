import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiPassChance({ ai, theme }: Props) {
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
          marginBottom: 6,
        }}
      >
        📈 Predicted MOT Pass Chance
      </Text>

      <Text
        style={{
          fontSize: 32,
          fontWeight: "800",
          color: theme.accent,
        }}
      >
        {ai.predictedPassChance}%
      </Text>

      <Text style={{ color: theme.text, marginTop: 6 }}>
        {ai.nextTestRisk}
      </Text>
    </View>
  );
}
