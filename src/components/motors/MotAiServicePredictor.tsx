import { View, Text } from "react-native";

type Props = {
  currentMileage: number;
  theme: any;
};

export default function MotAiServicePredictor({ currentMileage, theme }: Props) {
  const nextService = currentMileage + 10000; // UK average interval

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
        🛠️ Service Interval Predictor
      </Text>

      <Text style={{ color: theme.text, fontSize: 18 }}>
        Next recommended service at:
      </Text>

      <Text
        style={{
          color: theme.accent,
          fontSize: 32,
          fontWeight: "800",
          marginTop: 6,
        }}
      >
        {nextService.toLocaleString()} miles
      </Text>
    </View>
  );
}
