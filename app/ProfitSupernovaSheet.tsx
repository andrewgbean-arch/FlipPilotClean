import React from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
} from "react-native";

import { useTheme } from "@/styles/useTheme";
import { FlipRecord } from "../src/features/vehicles/models/FlipRecord";

interface ProfitSupernovaSheetProps {
  translateY: Animated.AnimatedInterpolation<string | number>;
  closeSheet: () => void;
  bestFlip: FlipRecord | null;
  avgProfit: number;
  avgROI: number;
}

const ProfitSupernovaSheet: React.FC<ProfitSupernovaSheetProps> = ({
  translateY,
  closeSheet,
  bestFlip,
  avgProfit,
  avgROI,
}) => {
  const theme = useTheme();

  return (
    <View style={styles.sheetOverlay}>
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: theme.card,
            borderColor: theme.goldDeep,
            borderWidth: 3,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.sheetHandle} />

        {/* Title */}
        <Text style={[styles.sheetTitle, { color: theme.text }]}>
          Profit Supernova
        </Text>

        {/* Subtitle */}
        <Text style={[styles.sheetSubtitle, { color: theme.muted }]}>
          Your strongest flips and averages
        </Text>

        {/* Best Flip */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>
            Best Flip Profit
          </Text>
          <Text style={[styles.value, { color: theme.text }]}>
            £{bestFlip ? bestFlip.pricing?.predictedProfit ?? 0 : 0}
          </Text>
        </View>

        {/* Average Profit */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>
            Average Profit
          </Text>
          <Text style={[styles.value, { color: theme.text }]}>
            £{avgProfit.toFixed(2)}
          </Text>
        </View>

        {/* Average ROI */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Average ROI</Text>
          <Text style={[styles.value, { color: theme.text }]}>
            {avgROI.toFixed(1)}%
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.sheetButtonsRow}>
          <View
            style={[
              styles.closeButton,
              {
                borderColor: theme.goldDeep,
                borderWidth: 3,
              },
            ]}
          >
            <TouchableOpacity onPress={closeSheet}>
              <Text style={[styles.closeButtonText, { color: theme.text }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheetOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },

  sheetContainer: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 110 : 100,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },

  sheetHandle: {
    width: 60,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignSelf: "center",
    marginBottom: 10,
  },

  sheetTitle: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  sheetSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },

  section: {
    marginTop: 14,
  },

  label: {
    fontSize: 14,
    opacity: 0.7,
  },

  value: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },

  sheetButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 22,
  },

  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: "#333",
  },

  closeButtonText: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
});

export default ProfitSupernovaSheet;
