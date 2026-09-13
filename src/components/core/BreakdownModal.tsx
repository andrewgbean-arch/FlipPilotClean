import { View, Text, Modal, TouchableOpacity } from "react-native";
import { Theme } from "@/styles/theme";

interface BreakdownProps {
  theme: Theme;
  breakdown: {
    profit: number;
    profitMargin: number;
    demandScore: number;
    rarity: string;
    condition: string;
    sellSpeed: string;
  };
  onClose: () => void;
}

export default function BreakdownModal({ theme, breakdown, onClose }: BreakdownProps) {
  return (
    <Modal transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: theme.card,
            padding: 20,
            borderRadius: theme.radius.lg,
            width: "90%",
          }}
        >
          <Text style={{ color: theme.white, fontSize: 22, marginBottom: 10 }}>
            Flip Breakdown
          </Text>

          <Text style={{ color: theme.white }}>
            Profit: £{breakdown.profit}
          </Text>
          <Text style={{ color: theme.white }}>
            Margin: {breakdown.profitMargin.toFixed(1)}%
          </Text>
          <Text style={{ color: theme.white }}>
            Demand Score: {breakdown.demandScore}
          </Text>
          <Text style={{ color: theme.white }}>
            Rarity: {breakdown.rarity}
          </Text>
          <Text style={{ color: theme.white }}>
            Condition: {breakdown.condition}
          </Text>
          <Text style={{ color: theme.white }}>
            Sell Speed: {breakdown.sellSpeed}
          </Text>

          <TouchableOpacity
            onPress={onClose}
            style={{
              marginTop: 20,
              backgroundColor: theme.goldDeep,
              padding: 12,
              borderRadius: theme.radius.md,
            }}
          >
            <Text style={{ color: theme.black, textAlign: "center" }}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
