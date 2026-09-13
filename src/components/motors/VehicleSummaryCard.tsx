import { View, Text } from "react-native";

export default function VehicleSummaryCard({
  year,
  make,
  model,
  reg,
  mileage,
  motExpiry,
  motHealth,
  expiryDays,
  isExpired,
  isExpiringSoon,
  theme,
}: {
  year: string | number;
  make: string;
  model: string;
  reg: string;
  mileage?: number | string | null;
  motExpiry?: string | null;
  motHealth?: number | null;
  expiryDays?: number | null;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  theme: any;
}) {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: theme.goldDeep,
        backgroundColor: theme.card,
        marginBottom: 20,
      }}
    >
      {/* VEHICLE TITLE */}
      <Text
        style={{
          fontSize: 24,
          fontWeight: "800",
          color: theme.accent,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
          marginBottom: 4,
        }}
      >
        {year} {make} {model}
      </Text>

      {/* REG */}
      <Text
        style={{
          fontSize: 16,
          color: theme.text,
          marginBottom: 12,
        }}
      >
        {reg}
      </Text>

      {/* DETAILS */}
      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.text }}>
          📍 Mileage:{" "}
          <Text style={{ color: theme.accent }}>
            {mileage ?? "Unknown"}
          </Text>
        </Text>

        {/* MOT EXPIRY STATUS */}
        <Text style={{ color: theme.text }}>
          ⏳ MOT Expiry:{" "}
          <Text
            style={{
              color: isExpired
                ? "#FF4D4D"
                : isExpiringSoon
                ? "#FFD966"
                : theme.accent,
              fontWeight: "700",
            }}
          >
            {motExpiry ?? "Unknown"}
          </Text>
        </Text>

        {/* EXPIRY WARNING */}
        {isExpired && (
          <Text style={{ color: "#FF4D4D", fontWeight: "700" }}>
            ❌ MOT expired
          </Text>
        )}

        {isExpiringSoon && (
          <Text style={{ color: "#FFD966", fontWeight: "700" }}>
            ⚠ MOT expires in {expiryDays} days
          </Text>
        )}

        {/* MOT HEALTH */}
        <Text style={{ color: theme.text }}>
          ❤️ MOT Health:{" "}
          <Text style={{ color: theme.accent }}>
            {motHealth ?? "N/A"}/100
          </Text>
        </Text>
      </View>
    </View>
  );
}
