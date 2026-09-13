import { View, Text } from "react-native";
import GlowPulseCard from "../ui/GlowPulseCard";

import { calculatePrice } from "@/features/ai/priceengine";



export default function ValuationEngine({ listing, prediction }: any) {
  const safeListing = listing ?? {};
  const safePrediction = prediction ?? {};

  const valuation = calculatePrice(safeListing, safePrediction);
  const price = safeListing.price ?? 0;
  const difference = price - valuation;

  const getLabel = () => {
    if (difference < -1000) return "🔥 Under Market Value";
    if (difference < -300) return "👍 Good Price";
    if (difference < 300) return "👌 Fair Price";
    return "⚠ Above Market Value";
  };

  const getColor = () => {
    if (difference < -1000) return "#4CAF50";
    if (difference < -300) return "#FFD700";
    if (difference < 300) return "#ccc";
    return "#FF5252";
  };

  return (
    <GlowPulseCard style={{ marginTop: 20 }}>
      <Text style={{ color: "#FFD700", fontWeight: "bold", fontSize: 20 }}>
        Market Valuation
      </Text>

      <Text style={{ color: "#FFD700", fontSize: 26, fontWeight: "bold" }}>
        £{valuation}
      </Text>

      <View
        style={{
          height: 10,
          backgroundColor: "#222",
          borderRadius: 999,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <View
          style={{
            width: `${Math.min(100, Math.max(5, (valuation / price) * 100))}%`,
            height: "100%",
            backgroundColor: getColor(),
          }}
        />
      </View>

      <Text style={{ color: getColor(), fontWeight: "bold", fontSize: 18 }}>
        {getLabel()}
      </Text>

      <Text style={{ color: "#ccc" }}>
        This valuation uses FlipPilot’s PriceEngine (age, mileage, condition, brand, engine size, market heat).
      </Text>
    </GlowPulseCard>
  );
}
