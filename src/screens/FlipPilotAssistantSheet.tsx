import React from "react";
import { Animated, Platform, StyleSheet, Pressable } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import ThemedView from "@/styles/theme/ThemedView";
import ThemedText from "@/styles/theme/ThemedText";

interface FlipPilotAssistantSheetProps {
  translateY: Animated.AnimatedInterpolation<string | number>;
  closeSheet: () => void;
  isOpen: boolean;
}

const FlipPilotAssistantSheet: React.FC<FlipPilotAssistantSheetProps> = ({
  translateY,
  closeSheet,
  isOpen,
}) => {
  const theme = useTheme();

  if (!isOpen) return null; // ⭐ FIX: overlay unmounts completely

  return (
    <ThemedView style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />

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

        <ThemedText style={styles.sheetTitle}>FlipPilot AI</ThemedText>
        <ThemedText style={styles.sheetSubtitle}>
          Ideas based on your stats
        </ThemedText>

        <ThemedText style={styles.aiHintText}>
          • Try focusing on items with similar profit to your best flip.{"\n"}
          • Use boot fairs to find more high-ROI items.{"\n"}
          • Track what categories give you the strongest returns.
        </ThemedText>

        <ThemedView style={styles.sheetButtonsRow}>
          <ThemedView
            style={[
              styles.cancelButton,
              {
                borderColor: theme.goldDeep,
                borderWidth: 3,
              },
            ]}
          >
            <ThemedText style={styles.cancelButtonText} onPress={closeSheet}>
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
    paddingBottom: Platform.OS === "ios" ? 60 : 50, // ⭐ FIX: reduced
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
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    color: "white",
  },

  sheetSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
    color: "#AFC6FF",
  },

  aiHintText: {
    marginTop: 14,
    fontSize: 14,
    color: "white",
    lineHeight: 20,
  },

  sheetButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 18,
  },

  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: "#333",
  },

  cancelButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "white",
    textAlign: "center",
  },
});

export default FlipPilotAssistantSheet;
