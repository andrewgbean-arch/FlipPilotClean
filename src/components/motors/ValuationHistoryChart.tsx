import { View, Text } from "react-native";

type Props = {
  history: { date: string; value: number }[] | null | undefined;
  theme: any;
};

export default function ValuationHistoryChart({ history, theme }: Props) {
  if (!history || history.length === 0) return null;

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
        📈 Valuation History
      </Text>

      {history.map((h, i) => (
        <View key={i} style={{ marginBottom: 10 }}>
          <Text style={{ color: theme.text }}>
            {new Date(h.date).toLocaleDateString()} — £{h.value.toLocaleString()}
          </Text>

          <View
            style={{
              height: 10,
              backgroundColor: theme.blackSoft,
              borderRadius: 10,
              overflow: "hidden",
              marginTop: 4,
            }}
          >
            <View
              style={{
                width: `${Math.min(h.value / 50, 100)}%`,
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
