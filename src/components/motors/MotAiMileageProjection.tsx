import { View, Text } from "react-native";

type Props = {
  currentMileage: number;
  theme: any;
};

export default function MotAiMileageProjection({ currentMileage, theme }: Props) {
  const projected = currentMileage + 8000; // average UK yearly mileage

  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: 14,
        marginBottom: 20,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: theme.accent,
          marginBottom: 6,
        }}
      >
        🚗 Mileage Projection
      </Text>

      <Text style={{ color: theme.text, fontSize: 18 }}>
        Expected mileage at next MOT:
      </Text>

      <Text
        style={{
          color: theme.accent,
          fontSize: 32,
          fontWeight: "800",
          marginTop: 6,
        }}
      >
        {projected.toLocaleString()} miles
      </Text>
    </View>
  );
}
