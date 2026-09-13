import { View } from "react-native";
import ThemedText from "@/styles/theme/ThemedText";

type Props = {
  valuation: number | null | undefined;
  aiPriceMin: number | null | undefined;
  aiPriceMax: number | null | undefined;
  theme: any;
};

export default function MarketplacePricingPanel({
  valuation,
  aiPriceMin,
  aiPriceMax,
  theme,
}: Props) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: 14,
        marginBottom: 20,
      }}
    >
      <ThemedText
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: theme.accent,
          marginBottom: 10,
        }}
      >
        🛒 Marketplace Pricing
      </ThemedText>

      <ThemedText style={{ color: theme.text }}>
        Valuation: £{(valuation ?? 0).toLocaleString()}
      </ThemedText>

      <ThemedText style={{ color: theme.text }}>
        AI Price Range: £{aiPriceMin ?? 0} – £{aiPriceMax ?? 0}
      </ThemedText>

      <ThemedText style={{ color: theme.text, marginTop: 6 }}>
        Suggested Listing Price: £{Math.round((valuation ?? 0) * 1.05)}
      </ThemedText>
    </View>
  );
}
