import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import GlowPulseCard from "@/components/ui/GlowPulseCard";



export default function OfferCalculator({ listing, prediction }: any) {
  const [offer, setOffer] = useState(listing.price);

  const expectedProfit = prediction.profitEstimate - (listing.price - offer);

  const recommendedOffer = Math.round(listing.price * 0.92); // 8% negotiation room
  const maxSafeOffer = Math.round(listing.price * 0.97); // 3% wiggle room

  const getColor = () => {
    if (offer <= recommendedOffer) return "#4CAF50"; // strong offer
    if (offer <= maxSafeOffer) return "#FFD700"; // acceptable
    return "#FF5252"; // risky
  };

  return (
    <GlowPulseCard style={{ marginTop: 20 }}>
      {/* Title */}
      <Text
        style={{
          color: "#FFD700",
          fontWeight: "bold",
          fontSize: 20,
          marginBottom: 10,
        }}
      >
        Offer Calculator
      </Text>

      {/* Offer Input */}
      <TextInput
        value={offer.toString()}
        onChangeText={(v) => setOffer(Number(v))}
        keyboardType="numeric"
        style={{
          backgroundColor: "#111",
          color: "#FFD700",
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#FFD700",
          marginBottom: 14,
          fontSize: 16,
          fontWeight: "bold",
        }}
      />

      {/* Offer Strength Indicator */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: "#ccc", marginBottom: 6 }}>Offer Strength</Text>

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
              width: `${Math.min(100, Math.max(10, (offer / listing.price) * 100))}%`,
              height: "100%",
              backgroundColor: getColor(),
            }}
          />
        </View>
      </View>

      {/* Profit */}
      <Text style={{ color: "#FFD700", fontWeight: "bold", marginBottom: 6 }}>
        Expected Profit: £{expectedProfit}
      </Text>

      {/* Offer Recommendations */}
      <View style={{ marginTop: 10 }}>
        <Text style={{ color: "#ccc" }}>
          Recommended Offer: <Text style={{ color: "#FFD700" }}>£{recommendedOffer}</Text>
        </Text>

        <Text style={{ color: "#ccc", marginTop: 4 }}>
          Max Safe Offer: <Text style={{ color: "#FFD700" }}>£{maxSafeOffer}</Text>
        </Text>
      </View>

      {/* Apply Button */}
      <TouchableOpacity
        style={{
          marginTop: 18,
          backgroundColor: "#FFD700",
          paddingVertical: 10,
          borderRadius: 10,
          alignItems: "center",
          shadowColor: "#FFD700",
          shadowOpacity: 0.7,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Text style={{ fontWeight: "bold", fontSize: 16 }}>Apply Offer</Text>
      </TouchableOpacity>
    </GlowPulseCard>
  );
}
