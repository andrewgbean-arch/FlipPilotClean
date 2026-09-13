import { View, Text } from "react-native";
import AnimatedPressable from "../ui/AnimatedPressable";

export default function VehicleActionsRow({
  theme,
  onPrimary,
  onSecondary,
  primaryLabel,
  secondaryLabel,
}: {
  theme: any;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryLabel: string;
  secondaryLabel: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        marginTop: 20,
      }}
    >
      <AnimatedPressable
        onPress={onPrimary}
        style={{
          flex: 1,
          padding: 12,
          borderRadius: 12,
          backgroundColor: theme.accent,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.black, fontWeight: "700" }}>
          {primaryLabel}
        </Text>
      </AnimatedPressable>

      <AnimatedPressable
        onPress={onSecondary}
        style={{
          flex: 1,
          padding: 12,
          borderRadius: 12,
          backgroundColor: theme.card,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.text, fontWeight: "700" }}>
          {secondaryLabel}
        </Text>
      </AnimatedPressable>
    </View>
  );
}
