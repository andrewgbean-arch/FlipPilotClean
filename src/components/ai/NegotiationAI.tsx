import { View, Text } from "react-native";

export default function NegotiationAI({ listing, prediction }: any) {
  const { price, seller, createdAt } = listing;

  let strategy = "";
  let offerStart = Math.round(price * 0.88); // default 12% below asking
  let offerMax = Math.round(price * 0.95);   // default 5% below asking

  // Listing age influence
  const daysListed =
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);

  if (daysListed > 30) {
    strategy += "This listing has been up for a while. Seller is likely flexible. ";
    offerStart = Math.round(price * 0.82);
    offerMax = Math.round(price * 0.92);
  } else if (daysListed > 14) {
    strategy += "Seller may be open to negotiation. ";
    offerStart = Math.round(price * 0.85);
    offerMax = Math.round(price * 0.94);
  }

  // Seller behaviour
  if (seller?.rating < 4.2) {
    strategy += "Seller rating is low — use this to push harder. ";
    offerStart -= 200;
  }

  if (seller?.totalSales < 3) {
    strategy += "Seller is inexperienced — easier to negotiate. ";
    offerStart -= 150;
  }

  // Price competitiveness
  if (prediction.profitEstimate > price) {
    strategy += "Price is already competitive — negotiate gently. ";
    offerStart = Math.round(price * 0.92);
    offerMax = Math.round(price * 0.97);
  }

  // Market heat
  const model = listing.vehicle?.model?.toLowerCase() || "";
  const hotModels = ["fiesta", "corsa", "golf", "a3", "focus", "yaris"];
  if (hotModels.some((m) => model.includes(m))) {
    strategy += "High demand model — seller may not budge much. ";
    offerStart = Math.round(price * 0.94);
    offerMax = Math.round(price * 0.98);
  }

  // Mileage risk
  if (listing.mileage > 120000) {
    strategy += "High mileage — strong leverage for negotiation. ";
    offerStart -= 300;
  }

  // Car history risk
  if (listing.motFails >= 2) {
    strategy += "History concerns — push for a lower price. ";
    offerStart -= 250;
  }

  // Cap values
  offerStart = Math.max(500, offerStart);
  offerMax = Math.max(500, offerMax);

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
        Negotiation AI Strategy
      </Text>

      <Text style={{ color: "#ccc", marginBottom: 6 }}>
        {strategy || "Balanced negotiation recommended."}
      </Text>

      <Text style={{ color: "#4CAF50", fontWeight: "bold", marginBottom: 4 }}>
        Suggested Starting Offer: £{offerStart}
      </Text>

      <Text style={{ color: "#FFD700", fontWeight: "bold", marginBottom: 4 }}>
        Maximum Recommended Offer: £{offerMax}
      </Text>

      <Text style={{ color: "#ccc", marginTop: 6 }}>
        Strategy based on seller behaviour, listing age, market demand, and risk factors.
      </Text>
    </View>
  );
}
