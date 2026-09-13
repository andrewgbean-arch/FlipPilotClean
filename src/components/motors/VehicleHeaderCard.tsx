import { View, Text } from "react-native";

export default function VehicleHeaderCard({
  year,
  make,
  model,
  reg,
  theme,
}: {
  year: string | number;
  make: string;
  model: string;
  reg: string;
  theme: any;
}) {
  return (
    <View
      style={{
        marginBottom: 20,
        paddingBottom: 8,
        borderBottomWidth: 2,
        borderColor: theme.goldDeep,
      }}
    >
      <Text
        style={{
          fontSize: 30,
          fontWeight: "900",
          color: theme.accent,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 10,
          marginBottom: 4,
        }}
      >
        {year} {make} {model}
      </Text>

      <Text
        style={{
          fontSize: 18,
          fontWeight: "600",
          color: theme.text,
          letterSpacing: 0.5,
        }}
      >
        {reg}
      </Text>
    </View>
  );
}
