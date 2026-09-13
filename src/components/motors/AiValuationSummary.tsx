import { View, Text } from "react-native";

type Props = {
  aiValuation: {
    estimatedValue?: number | null;
    confidence?: number | null;
    notes?: string | null;
  } | null | undefined;
  theme: any;
};

export default function AiValuationSummary({ aiValuation, theme }: Props) {
  if (!aiValuation) return null;

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
        🤖 AI Valuation Summary
      </Text>

      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: theme.accent,
        }}
      >
        £{(aiValuation.estimatedValue ?? 0).toLocaleString()}
      </Text>

      <Text style={{ color: theme.text, marginTop: 6 }}>
        Confidence: {aiValuation.confidence ?? 0}%
      </Text>

      {aiValuation.notes && (
        <Text style={{ color: theme.text, marginTop: 6 }}>
          {aiValuation.notes}
        </Text>
      )}
    </View>
  );
}
