import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiVerdictCard({ ai, theme }: Props) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
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
        🤖 MOT AI Verdict
      </Text>

      <Text style={{ color: theme.text, fontSize: 16 }}>
        {ai.verdict}
      </Text>
    </View>
  );
}
