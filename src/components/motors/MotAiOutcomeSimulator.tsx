import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiOutcomeSimulator({ ai, theme }: Props) {
  let passes = 0;

  for (let i = 0; i < 100; i++) {
    const roll = Math.random() * 100;
    if (roll < ai.predictedPassChance) passes++;
  }

  const probability = Math.round((passes / 100) * 100);

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
        🎲 MOT Outcome Simulator
      </Text>

      <Text
        style={{
          color: theme.accent,
          fontSize: 32,
          fontWeight: "800",
        }}
      >
        {probability}%
      </Text>

      <Text style={{ color: theme.text, marginTop: 6 }}>
        Probability of passing based on 100 simulated MOT tests.
      </Text>
    </View>
  );
}
