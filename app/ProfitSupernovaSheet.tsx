import React from "react";
import { Animated, Platform, StyleSheet } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import ThemedView from "@/styles/theme/ThemedView";
import ThemedText from "@/styles/theme/ThemedText";
import { FlipRecord } from "@/models/FlipRecord";

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
    <ThemedView style={styles.sheetOverlay}>
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
        <ThemedView style={styles.sheetHandle} />

        <ThemedText style={styles.sheetTitle}>Profit Supernova</ThemedText>
        <ThemedText style={styles.sheetSubtitle}>
          Your strongest flips and averages
        </ThemedText>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.label}>Best Flip Profit</ThemedText>
          <ThemedText style={styles.value}>
            £{bestFlip ? bestFlip.pricing?.predictedProfit ?? 0 : 0}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.label}>Average Profit</ThemedText>
          <ThemedText style={styles.value}>£{avgProfit.toFixed(2)}</ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.label}>Average ROI</ThemedText>
          <ThemedText style={styles.value}>{avgROI.toFixed(1)}%</ThemedText>
        </ThemedView>

        <ThemedView style={styles.sheetButtonsRow}>
          <ThemedView
            style={[
              styles.closeButton,
              {
                borderColor: theme.goldDeep,
                borderWidth: 3,
              },
            ]}
          >
            <ThemedText style={styles.closeButtonText} onPress={closeSheet}>
              Close
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </Animated.View>
    </ThemedView>
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
    color: "white",
  },

  sheetSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
    color: "#AFC6FF",
  },

  section: {
    marginTop: 14,
  },

  label: {
    fontSize: 14,
    opacity: 0.7,
    color: "white",
  },

  value: {
    fontSize: 20,
    fontWeight: "900",
    color: "white",
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
    color: "white",
    textAlign: "center",
  },
});

export default ProfitSupernovaSheet;
