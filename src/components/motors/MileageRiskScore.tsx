import { View, Text } from "react-native";

export default function MileageRiskScore({ listing }: any) {
  const mileage = listing.mileage || 0;

  let risk = 50;

  // Mileage tiers
  if (mileage > 180000) risk += 30;
  else if (mileage > 150000) risk += 25;
  else if (mileage > 120000) risk += 20;
  else if (mileage > 100000) risk += 15;
  else if (mileage > 80000) risk += 10;
  else if (mileage > 60000) risk += 5;
  else risk -= 10;

  // Age + mileage synergy
  const year = listing.vehicle?.year || 2010;
  const age = new Date().getFullYear() - year;

  if (age > 12 && mileage > 120000) risk += 10;
  if (age > 15 && mileage > 150000) risk += 15;

  // Service history mitigation
  if (listing.serviceHistory === "full") risk -= 15;
  else if (listing.serviceHistory === "partial") risk -= 5;

  // Cap risk
  risk = Math.min(100, Math.max(0, risk));

  const getColor = () => {
    if (risk <= 40) return "#4CAF50"; // low risk
    if (risk <= 70) return "#FFD700"; // medium risk
    return "#FF5252"; // high risk
  };

  const getLabel = () => {
    if (risk <= 40) return "Low Mileage Risk";
    if (risk <= 70) return "Medium Mileage Risk";
    return "High Mileage Risk";
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
        Mileage Risk Score
      </Text>

      <Text style={{ color: getColor(), fontSize: 18, fontWeight: "bold" }}>
        {getLabel()} ({risk}/100)
      </Text>

      <Text style={{ color: "#ccc", marginTop: 6 }}>
        This score reflects mileage, age, and service history.
      </Text>
    </View>
  );
}
