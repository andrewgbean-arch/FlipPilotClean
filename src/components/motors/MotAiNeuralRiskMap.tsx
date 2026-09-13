import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiNeuralRiskMap({ ai, theme }: Props) {
  const nodes = [
    { label: "Mileage", value: ai.mileageRisk },
    { label: "Advisories", value: ai.advisorySeverity },
    { label: "Failures", value: ai.failureSeverity },
    { label: "Health", value: ai.healthScore },
    { label: "Pass Chance", value: ai.predictedPassChance },
  ];

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
        🧠 Neural Risk Map
      </Text>

      {nodes.map((n, i) => (
        <View key={i} style={{ marginBottom: 12 }}>
          <Text style={{ color: theme.text, marginBottom: 4 }}>
            {n.label}
          </Text>

          <View
            style={{
              height: 10,
              backgroundColor: theme.blackSoft,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.min(n.value, 100)}%`,
                height: "100%",
                backgroundColor: theme.accent,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
