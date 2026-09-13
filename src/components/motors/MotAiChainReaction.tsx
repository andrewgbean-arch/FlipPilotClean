import { View, Text } from "react-native";
import { MotAiResult } from "@/features/vehicles/ai/motAiEngine";

type Props = {
  ai: MotAiResult;
  theme: any;
};

export default function MotAiChainReaction({ ai, theme }: Props) {
  const chain = [
    {
      label: "Brakes → Suspension",
      value: ai.failureSeverity * 0.6,
    },
    {
      label: "Suspension → Tyres",
      value: ai.failureSeverity * 0.5,
    },
    {
      label: "Tyres → Steering",
      value: ai.failureSeverity * 0.4,
    },
    {
      label: "Lights → Electrical",
      value: ai.failureSeverity * 0.3,
    },
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
        🔗 Failure Chain Reaction
      </Text>

      {chain.map((c, i) => (
        <View key={i} style={{ marginBottom: 12 }}>
          <Text style={{ color: theme.text, marginBottom: 4 }}>
            {c.label}
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
                width: `${Math.min(c.value, 100)}%`,
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
