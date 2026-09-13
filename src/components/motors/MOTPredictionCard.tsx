import { View, Text } from "react-native";

export default function MOTPredictionCard({
  prediction,
  theme,
}: {
  prediction: string;
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
        🤖 Next MOT Prediction
      </Text>

      <Text style={{ fontSize: 16, color: theme.text }}>
        Expected MOT: {prediction}
      </Text>
    </View>
  );
}
