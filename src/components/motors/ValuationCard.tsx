import { View, Text } from "react-native";

type Props = {
  value: number | null | undefined;
  theme: any;
};

export default function ValuationCard({ value, theme }: Props) {
  const display = value ?? 0;

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
          fontSize: 22,
          fontWeight: "800",
          color: theme.accent,
          marginBottom: 6,
        }}
      >
        💰 Vehicle Valuation
      </Text>

      <Text
        style={{
          fontSize: 32,
          fontWeight: "800",
          color: theme.accent,
        }}
      >
        £{display.toLocaleString()}
      </Text>

      <Text style={{ color: theme.text, marginTop: 6 }}>
        Estimated market value based on MOT health, mileage, advisories, and condition.
      </Text>
    </View>
  );
}
