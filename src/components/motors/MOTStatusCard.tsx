import { View, Text } from "react-native";

export default function MOTStatusCard({
  status,
  expiryDate,
  theme,
}: {
  status: string | null;
  expiryDate: string | null;
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
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: theme.accent,
          marginBottom: 6,
        }}
      >
        🚗 Current MOT Status
      </Text>

      <Text style={{ fontSize: 16, color: theme.text }}>
        Status: {status ?? "Unknown"}
      </Text>

      {expiryDate && (
        <Text style={{ fontSize: 16, color: theme.text }}>
          Expiry: {expiryDate}
        </Text>
      )}
    </View>
  );
}
