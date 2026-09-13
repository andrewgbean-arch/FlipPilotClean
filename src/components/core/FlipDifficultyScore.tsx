import { View, Text } from "react-native";
import GlowPulseCard from "@/components/ui/GlowPulseCard";



export default function FlipDifficultyScore({ listing, prediction }: any) {
  const { mileage, motFails, price } = listing;
  const vehicle = listing.vehicle ?? {};

  let difficulty = 50;

  // Mileage impact
  if (mileage > 150000) difficulty += 20;
  else if (mileage > 120000) difficulty += 15;
  else if (mileage > 90000) difficulty += 10;

  // MOT fails
  if (motFails >= 3) difficulty += 20;
  else if (motFails >= 1) difficulty += 10;

  // Known model issues
  const riskyModels = ["insignia", "avensis", "mondeo", "passat", "mini cooper", "range rover"];
  const model = vehicle.model?.toLowerCase() || "";
  if (riskyModels.some((m) => model.includes(m))) difficulty += 15;

  // Parts availability
  const cheapParts = ["fiesta", "corsa", "focus", "golf", "a3"];
  if (cheapParts.some((m) => model.includes(m))) difficulty -= 10;

  // Price competitiveness
  if (prediction.profitEstimate > price) difficulty -= 10;

  // Market heat
  const hotModels = ["fiesta", "corsa", "golf", "a3", "focus", "yaris"];
  if (hotModels.some((m) => model.includes(m))) difficulty -= 10;

  // Listing quality
  if (listing.photos?.length < 3) difficulty += 10;
  if (listing.description?.length < 60) difficulty += 10;

  difficulty = Math.min(100, Math.max(0, difficulty));

  const getColor = () => {
    if (difficulty <= 40) return "#4CAF50"; // easy flip
    if (difficulty <= 70) return "#FFD700"; // moderate flip
    return "#FF5252"; // hard flip
  };

  const getLabel = () => {
    if (difficulty <= 40) return "Easy Flip";
    if (difficulty <= 70) return "Moderate Flip";
    return "Hard Flip";
  };

  return (
    <GlowPulseCard style={{ marginTop: 20 }}>
      {/* Title */}
      <Text
        style={{
          color: "#FFD700",
          fontWeight: "bold",
          fontSize: 20,
          marginBottom: 6,
        }}
      >
        Flip Difficulty Score
      </Text>

      {/* Difficulty Label */}
      <Text
        style={{
          color: getColor(),
          fontSize: 24,
          fontWeight: "bold",
          marginBottom: 10,
        }}
      >
        {getLabel()} ({difficulty}/100)
      </Text>

      {/* Difficulty Meter */}
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
            width: `${difficulty}%`,
            height: "100%",
            backgroundColor: getColor(),
          }}
        />
      </View>

      {/* Explanation */}
      <Text style={{ color: "#ccc" }}>
        Based on mileage, MOT history, model reliability, parts availability, and market demand.
      </Text>
    </GlowPulseCard>
  );
}
