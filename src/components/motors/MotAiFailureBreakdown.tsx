import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiFailureBreakdown({ ai, theme }: Props) {
  const breakdown = [
    { label: "Brakes", chance: ai.failureSeverity * 0.4 },
    { label: "Suspension", chance: ai.failureSeverity * 0.3 },
    { label: "Tyres", chance: ai.failureSeverity * 0.2 },
    { label: "Lights", chance: ai.failureSeverity * 0.1 },
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
        🔧 Failure Probability Breakdown
      </Text>

      {breakdown.map((item, i) => (
        <View key={i} style={{ marginBottom: 10 }}>
          <Text style={{ color: theme.text, marginBottom: 4 }}>
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
                width: `${Math.min(item.chance, 100)}%`,
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
