import { View, Text } from "react-native";

export default function DealProbabilityAI({ listing, prediction }: any) {
  const { price, score, seller } = listing;
  const vehicle = listing.vehicle ?? {};

  let probability = 40; // base chance

  // Price competitiveness
  if (price < prediction.profitEstimate * 1.2) probability += 10;
  if (price < prediction.profitEstimate) probability += 15;

  // FlipScore influence
  if (prediction.flipScore >= 80) probability += 15;
  else if (prediction.flipScore >= 70) probability += 10;

  // Seller rating
  if (seller?.rating >= 4.8) probability += 10;
  else if (seller?.rating >= 4.5) probability += 5;

  // Listing quality
  if (listing.photos?.length >= 5) probability += 10;
  if (listing.description?.length > 150) probability += 5;

  // Hot deal boost
  if (score >= 85 && price <= 5000) probability += 15;

  // Make/model demand heuristic
  const popularModels = ["fiesta", "focus", "corsa", "golf", "a3", "astra"];
  const model = vehicle.model?.toLowerCase() || "";
  if (popularModels.some((m) => model.includes(m))) probability += 10;

  // Age & mileage synergy
  const age = new Date().getFullYear() - (vehicle.year || 2010);
  const mileage = listing.mileage || 0;

  if (age < 10 && mileage < 100000) probability += 10;

  // Cap probability
  probability = Math.min(100, Math.max(0, probability));

  const getColor = () => {
    if (probability >= 80) return "#4CAF50";
    if (probability >= 60) return "#FFD700";
    return "#FF5252";
  };

  const getLabel = () => {
    if (probability >= 80) return "Very High Chance";
    if (probability >= 60) return "High Chance";
    if (probability >= 40) return "Moderate Chance";
    return "Low Chance";
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
        Deal Probability (7‑Day Forecast)
      </Text>

      <Text style={{ color: getColor(), fontSize: 18, fontWeight: "bold" }}>
        {getLabel()} ({probability}%)
      </Text>

      <Text style={{ color: "#ccc", marginTop: 6 }}>
        Based on price, FlipScore, seller rating, listing quality, and market demand.
      </Text>
    </View>
  );
}
