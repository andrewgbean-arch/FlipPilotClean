import { View, Text } from "react-native";
import GlowPulseCard from "../ui/GlowPulseCard";


export default function ConfidenceMeter({ score }: { score: number }) {
  const width = Math.max(10, Math.min(score, 100));

  const getColor = () => {
    if (score >= 75) return "#4CAF50"; // green
    if (score >= 55) return "#FFD700"; // gold
    return "#FF5252"; // red
  };

  return (
    <GlowPulseCard style={{ marginTop: 20 }}>
      {/* Title */}
      <Text
        style={{
          color: "#FFD700",
          fontWeight: "bold",
          fontSize: 18,
          marginBottom: 6,
        }}
      >
        Confidence Meter
      </Text>

      {/* Score Number */}
      <Text
        style={{
          color: getColor(),
          fontSize: 24,
          fontWeight: "bold",
          marginBottom: 10,
        }}
      >
        {score}/100
      </Text>

      {/* Bar */}
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
            width: `${width}%`,
            height: "100%",
            backgroundColor: getColor(),
          }}
        />
      </View>

      {/* Description */}
      <Text style={{ color: "#ccc" }}>
        Higher confidence means stronger deal stability and lower risk.
      </Text>
    </GlowPulseCard>
  );
}
