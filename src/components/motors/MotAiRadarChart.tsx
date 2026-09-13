import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiRadarChart({ ai, theme }: Props) {
  const items = [
    { label: "Health", value: ai.healthScore },
    { label: "Mileage", value: ai.mileageRisk },
    { label: "Advisories", value: ai.advisorySeverity },
    { label: "Failures", value: ai.failureSeverity },
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
          fontSize: 20,
          fontWeight: "700",
          color: theme.accent,
          marginBottom: 10,
        }}
      >
        🧭 MOT AI Radar Chart
      </Text>

      {items.map((item, i) => (
        <View key={i} style={{ marginBottom: 10 }}>
          <Text
            style={{
              color: theme.text,
              marginBottom: 4,
              fontWeight: "600",
            }}
          >
            {item.label}
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
                width: `${item.value}%`,
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
