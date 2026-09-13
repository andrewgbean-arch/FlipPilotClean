import { View, Text } from "react-native";
import GlowPulseCard from "@/components/ui/GlowPulseCard";



export default function BuyerSafetyScore({ listing, prediction }: any) {
  const seller = listing.seller || {};

  // Scoring logic
  let score = 50;

  if (seller.verified) score += 15;
  if (seller.totalSales > 10) score += 10;
  if (seller.rating >= 4.5) score += 10;
  if (seller.responseTime?.includes("hour")) score += 5;

  if (listing.photos?.length >= 3) score += 5;
  if (listing.description?.length > 120) score += 5;

  if (prediction.flipScore >= 75) score += 10;
  if (prediction.recommendation === "Buy") score += 5;

  score = Math.min(100, score);

  const getColor = () => {
    if (score >= 80) return "#4CAF50";
    if (score >= 60) return "#FFD700";
    return "#FF5252";
  };

  return (
    <GlowPulseCard style={{ marginTop: 20 }}>
      <Text
        style={{
          color: "#FFD700",
          fontWeight: "bold",
          fontSize: 20,
          marginBottom: 6,
        }}
      >
        Buyer Safety Score
      </Text>

      {/* Score Number */}
      <Text
        style={{
          color: getColor(),
          fontSize: 26,
          fontWeight: "bold",
          marginBottom: 10,
        }}
      >
        {score}/100
      </Text>

      {/* Safety Meter */}
      <View
        style={{
          height: 10,
          backgroundColor: "#222",
          borderRadius: 999,
          overflow: "hidden",
          marginBottom: 10,
        }}
      >
        <View
          style={{
            width: `${score}%`,
            height: "100%",
            backgroundColor: getColor(),
          }}
        />
      </View>

      {/* Explanation */}
      <Text style={{ color: "#ccc", marginTop: 4 }}>
        This score reflects seller trust, listing quality, and deal safety.
      </Text>

      {/* Breakdown */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: "#FFD700", fontWeight: "bold", marginBottom: 4 }}>
          Breakdown
        </Text>

        <Text style={{ color: "#ccc" }}>
          • Seller Rating: {seller.rating ?? "N/A"} ⭐
        </Text>
        <Text style={{ color: "#ccc" }}>
          • Verified Seller: {seller.verified ? "Yes" : "No"}
        </Text>
        <Text style={{ color: "#ccc" }}>
          • Total Sales: {seller.totalSales ?? 0}
        </Text>
        <Text style={{ color: "#ccc" }}>
          • Listing Quality: {listing.photos?.length ?? 0} photos
        </Text>
        <Text style={{ color: "#ccc" }}>
          • FlipPilot Deal Score: {prediction.flipScore}/100
        </Text>
      </View>
    </GlowPulseCard>
  );
}
