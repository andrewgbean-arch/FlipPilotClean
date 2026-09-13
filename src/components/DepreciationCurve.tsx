import { View, Text } from "react-native";

export default function DepreciationCurve({ listing, prediction }: any) {
  const vehicle = listing.vehicle ?? {};
  const price = listing.price ?? 0;
  const mileage = listing.mileage ?? vehicle.mileage ?? 0;

  const year = vehicle.year || 2010;
  const age = new Date().getFullYear() - year;

  // Base depreciation rate
  let baseRate = 0.12; // 12% per year typical

  // Adjust for age
  if (age < 3) baseRate = 0.18;
  else if (age < 6) baseRate = 0.14;
  else if (age < 10) baseRate = 0.10;
  else baseRate = 0.07;

  // Adjust for mileage
  if (mileage > 150000) baseRate += 0.05;
  else if (mileage > 100000) baseRate += 0.03;
  else if (mileage > 70000) baseRate += 0.02;

  // Adjust for FlipScore (good cars depreciate slower)
  if (prediction.flipScore >= 80) baseRate -= 0.03;
  else if (prediction.flipScore >= 70) baseRate -= 0.02;

  // Calculate future values
  const year1 = Math.round(price * (1 - baseRate));
  const year2 = Math.round(price * (1 - baseRate * 2));
  const year3 = Math.round(price * (1 - baseRate * 3));

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
        Depreciation Forecast
      </Text>

      <Text style={{ color: "#ccc", marginBottom: 4 }}>
        1 Year: £{year1}
      </Text>

      <Text style={{ color: "#ccc", marginBottom: 4 }}>
        2 Years: £{year2}
      </Text>

      <Text style={{ color: "#ccc", marginBottom: 4 }}>
        3 Years: £{year3}
      </Text>

      <Text style={{ color: "#ccc", marginTop: 6 }}>
        Forecast based on age, mileage, FlipScore, and market trends.
      </Text>
    </View>
  );
}
