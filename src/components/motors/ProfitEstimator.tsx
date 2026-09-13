import { View, Text } from "react-native";

type Props = {
  buyPrice: number | null;
  sellPrice: number | null;
  valuation: number | null | undefined;
  theme: any;
};

export default function ProfitEstimator({ buyPrice, sellPrice, valuation, theme }: Props) {
  const buy = buyPrice ?? 0;
  const sell = sellPrice ?? valuation ?? 0;

  const profit = sell - buy;

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
        📊 Profit Estimator
      </Text>

      <Text style={{ color: theme.text }}>
        Buy Price: £{buy.toLocaleString()}
      </Text>

      <Text style={{ color: theme.text }}>
        Estimated Sell: £{sell.toLocaleString()}
      </Text>

      <Text
        style={{
          marginTop: 10,
          fontSize: 28,
          fontWeight: "800",
          color: profit >= 0 ? theme.accent : "#F44336",
        }}
      >
        Profit: £{profit.toLocaleString()}
      </Text>
    </View>
  );
}
