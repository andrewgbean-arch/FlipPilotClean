import { View, Text } from "react-native";

export default function PhotoAnalyzer({ listing }: any) {
  const photos = listing.photos || [];

  let score = 50;

  // Number of photos
  if (photos.length >= 8) score += 20;
  else if (photos.length >= 5) score += 15;
  else if (photos.length >= 3) score += 10;
  else if (photos.length >= 1) score += 5;
  else score -= 20;

  // Basic clarity check (resolution heuristic)
  const highResCount = photos.filter((p: string) => p.includes("1200") || p.includes("1080")).length;
  if (highResCount >= 3) score += 10;
  else if (highResCount >= 1) score += 5;

  // Angle variety heuristic
  const angleKeywords = ["front", "rear", "side", "interior", "engine"];
  const variety = angleKeywords.filter((k) =>
    photos.some((p: string) => p.toLowerCase().includes(k))
  ).length;

  if (variety >= 4) score += 10;
  else if (variety >= 2) score += 5;
  else score -= 5;

  // Cap score
  score = Math.max(0, Math.min(100, score));

  const getColor = () => {
    if (score >= 80) return "#4CAF50";
    if (score >= 60) return "#FFD700";
    return "#FF5252";
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
        Photo Quality Analysis
      </Text>

      <Text style={{ color: getColor(), fontSize: 18, fontWeight: "bold" }}>
        {score}/100
      </Text>

      <Text style={{ color: "#ccc", marginTop: 6 }}>
        This score reflects clarity, angles, and photo completeness.
      </Text>
    </View>
  );
}
