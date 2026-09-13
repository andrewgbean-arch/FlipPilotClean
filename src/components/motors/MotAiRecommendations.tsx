import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiRecommendations({ ai, theme }: Props) {
  const recs = [];

  if (ai.failureSeverity > 40) {
    recs.push("Address critical failures immediately.");
  }
  if (ai.advisorySeverity > 40) {
    recs.push("Resolve advisories before next MOT.");
  }
  if (ai.mileageRisk > 60) {
    recs.push("High mileage — consider servicing brakes & suspension.");
  }
  if (ai.healthScore < 50) {
    recs.push("Full pre‑MOT inspection recommended.");
  }
  if (recs.length === 0) {
    recs.push("Vehicle is in good condition — no urgent actions needed.");
  }

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
        🛠️ Fix Before MOT
      </Text>

      {recs.map((r, i) => (
        <Text
          key={i}
          style={{
            color: theme.text,
            marginBottom: 6,
            fontSize: 16,
          }}
        >
          • {r}
        </Text>
      ))}
    </View>
  );
}
