import { View, Text } from "react-native";
import GlowPulseCard from "@/components/ui/GlowPulseCard";


export default function SellerProfileCard({ seller }: { seller: any }) {
  if (!seller) return null;

  const trustPercent = (seller.rating ?? 4) * 20;

  return (
    <GlowPulseCard style={{ marginTop: 20 }}>
      {/* Seller Name */}
      <Text
        style={{
          color: "#FFD700",
          fontWeight: "bold",
          fontSize: 18,
          marginBottom: 4,
        }}
      >
        {seller.name}
      </Text>

      {/* Verified Badge */}
      {seller.verified && (
        <Text style={{ color: "#4CAF50", fontWeight: "bold", marginBottom: 6 }}>
          ✔ Verified Seller
        </Text>
      )}

      {/* Trust Meter */}
      <View style={{ marginTop: 6 }}>
        <Text style={{ color: "#ccc", marginBottom: 4 }}>Trust Score</Text>

        <View
          style={{
            height: 10,
            backgroundColor: "#222",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${trustPercent}%`,
              height: "100%",
              backgroundColor:
                trustPercent >= 80
                  ? "#4CAF50"
                  : trustPercent >= 60
                  ? "#FFD700"
                  : "#FF5252",
            }}
          />
        </View>

        <Text style={{ color: "#ccc", marginTop: 4 }}>
          Rating: {(seller.rating ?? 4).toFixed(1)}/5 • Trust:{" "}
          {Math.round(trustPercent)}%
        </Text>
      </View>

      {/* Stats */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: "#ccc" }}>Cars Sold: {seller.totalSales ?? 0}</Text>
        <Text style={{ color: "#ccc" }}>
          Avg FlipScore: {seller.avgFlipScore ?? "N/A"}
        </Text>
        <Text style={{ color: "#ccc" }}>
          Response Time: {seller.responseTime ?? "Unknown"}
        </Text>
      </View>

      {/* Bio */}
      {seller.bio && (
        <Text
          style={{
            color: "#aaa",
            marginTop: 12,
            fontStyle: "italic",
          }}
        >
          "{seller.bio}"
        </Text>
      )}
    </GlowPulseCard>
  );
}
