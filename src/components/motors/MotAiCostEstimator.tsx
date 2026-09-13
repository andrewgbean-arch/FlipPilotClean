import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiCostEstimator({ ai, theme }: Props) {
  const cost =
    ai.failureSeverity * 12 +
    ai.advisorySeverity * 6 +
    ai.mileageRisk * 4;

  const rounded = Math.round(cost);

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
        💷 Estimated Repair Cost
      </Text>

      <Text
        style={{
          color: theme.accent,
          fontSize: 32,
          fontWeight: "800",
        }}
      >
        £{rounded}
      </Text>

      <Text style={{ color: theme.text, marginTop: 6 }}>
        Estimated cost to bring vehicle to MOT‑ready condition.
      </Text>
    </View>
  );
}
