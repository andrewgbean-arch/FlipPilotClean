import { View, Text } from "react-native";

export default function SellerBadges({ seller }: any) {
  if (!seller) return null;

  const badges: string[] = [];

  // Verified badge
  if (seller.verified) badges.push("✔ Verified");

  // Rating badge
  if (seller.rating >= 4.8) badges.push("⭐ Top Rated");
  else if (seller.rating >= 4.5) badges.push("⭐ High Rated");

  // Sales badge
  if (seller.totalSales >= 20) badges.push("🏆 Platinum Seller");
  else if (seller.totalSales >= 10) badges.push("🥇 Gold Seller");
  else if (seller.totalSales >= 5) badges.push("🥈 Silver Seller");
  else if (seller.totalSales >= 1) badges.push("🥉 Bronze Seller");

  // Response speed badge
  if (seller.responseTime?.includes("hour")) badges.push("⚡ Fast Responder");

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 8,
      }}
    >
      {badges.map((badge, i) => (
        <View
          key={i}
          style={{
            backgroundColor: "#FFD700",
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 6,
            marginRight: 6,
            marginBottom: 6,
          }}
        >
          <Text style={{ fontWeight: "bold" }}>{badge}</Text>
        </View>
      ))}
    </View>
  );
}
