import { View, Text } from "react-native";

export default function PriceDropPredictor({ listing, prediction }: any) {
  const { price, createdAt, seller } = listing;
  const vehicle = listing.vehicle ?? {};

  let chance = 20; // base chance

  // Listing age
  const daysListed =
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);

  if (daysListed > 30) chance += 20;
  else if (daysListed > 14) chance += 10;

  // Seller behaviour
  if (seller?.rating < 4.2) chance += 10;
  if (seller?.totalSales < 3) chance += 10;

  // Price competitiveness
  if (prediction.profitEstimate > price) chance += 15;
  if (prediction.flipScore < 60) chance += 10;

  // Market valuation gap
  const valuationGap = prediction.profitEstimate - price;
  if (valuationGap > 1500) chance += 20;
  else if (valuationGap > 800) chance += 10;

  // Make/model demand
  const slowModels = ["insignia", "avensis", "mondeo", "passat"];
  const model = vehicle.model?.toLowerCase() || "";
  if (slowModels.some((m) => model.includes(m))) chance += 15;

  // Mileage risk
  if (listing.mileage > 120000) chance += 10;

  // Cap chance
  chance = Math.min(100, Math.max(0, chance));

  const getColor = () => {
    if (chance >= 80) return "#4CAF50";
    if (chance >= 60) return "#FFD700";
    return "#FF5252";
  };

  const getLabel = () => {
    if (chance >= 80) return "Very Likely";
    if (chance >= 60) return "Likely";
    if (chance >= 40) return "Possible";
    return "Unlikely";
  };

  return (
    <View
      style={{
        marginTop: 12,
        backgroundColor: "#1A1A1A",
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#FFD700",
      }}
    >
      <Text style={{ color: "#FFD700", fontWeight: "bold", marginBottom: 6 }}>
        Price Drop Prediction
      </Text>

      <Text style={{ color: getColor(), fontSize: 18, fontWeight: "bold" }}>
        {getLabel()} ({chance}%)
      </Text>

      <Text style={{ color: "#ccc", marginTop: 6 }}>
        Based on listing age, seller behaviour, valuation gap, and market demand.
      </Text>
    </View>
  );
}
