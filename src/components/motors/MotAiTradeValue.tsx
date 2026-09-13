import { View, Text } from "react-native";

type Props = {
  baseValue: number;
  ai: any;
  theme: any;
};

export default function MotAiTradeValue({ baseValue, ai, theme }: Props) {
  const multiplier =
    ai.healthScore > 80 ? 1.1 :
    ai.healthScore > 60 ? 1.0 :
    ai.healthScore > 40 ? 0.85 :
    0.7;

  const value = Math.round(baseValue * multiplier);

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
        💰 Trade‑in Value Estimate
      </Text>

      <Text
        style={{
          color: theme.accent,
          fontSize: 32,
          fontWeight: "800",
        }}
      >
        £{value}
      </Text>

      <Text style={{ color: theme.text, marginTop: 6 }}>
        Based on MOT health, advisories, failures, and mileage.
      </Text>
    </View>
  );
}
