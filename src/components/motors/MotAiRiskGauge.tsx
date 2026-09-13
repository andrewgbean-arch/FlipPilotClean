import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiRiskGauge({ ai, theme }: Props) {
  const colors: Record<"low" | "medium" | "high", string> = {
    low: "#4CAF50",
    medium: "#FFC107",
    high: "#F44336",
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
        ⚠️ MOT Risk Gauge
      </Text>

      <View
        style={{
          height: 12,
          backgroundColor: theme.blackSoft,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${ai.healthScore}%`,
            height: "100%",
            backgroundColor: colors[ai.riskLevel],
          }}
        />
      </View>

      <Text
        style={{
          marginTop: 10,
          color: colors[ai.riskLevel],
          fontWeight: "700",
        }}
      >
        {ai.riskLevel.toUpperCase()} RISK
      </Text>
    </View>
  );
}
