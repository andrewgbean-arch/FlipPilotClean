import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiWearEstimator({ ai, theme }: Props) {
  const wear = [
    { label: "Brakes", value: ai.mileageRisk * 0.6 + ai.failureSeverity * 0.4 },
    { label: "Suspension", value: ai.mileageRisk * 0.5 + ai.advisorySeverity * 0.5 },
    { label: "Tyres", value: ai.mileageRisk * 0.7 },
    { label: "Lights", value: ai.failureSeverity * 0.3 },
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
        🔍 Component Wear Estimator
      </Text>

      {wear.map((w, i) => (
        <View key={i} style={{ marginBottom: 10 }}>
          <Text style={{ color: theme.text, marginBottom: 4 }}>
            {w.label}
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
                width: `${Math.min(w.value, 100)}%`,
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
