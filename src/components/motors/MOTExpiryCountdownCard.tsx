import { View, Text } from "react-native";

export default function MOTExpiryCountdownCard({
  daysLeft,
  theme,
}: {
  daysLeft: number | null;
  theme: any;
}) {
  if (daysLeft === null) return null;

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
          color: theme.goldDeep,
          marginBottom: 6,
        }}
      >
        ⏳ MOT Expiry Countdown
      </Text>

      <Text
        style={{
          fontSize: 24,
          fontWeight: "700",
          color: theme.accent,
        }}
      >
        {daysLeft} days left
      </Text>
    </View>
  );
}
