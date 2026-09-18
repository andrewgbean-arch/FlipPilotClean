import React from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Pressable,
  View,
  Text,
} from "react-native";

import { useTheme } from "@/styles/useTheme";

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

  if (!isOpen) return null;

  return (
    <View style={styles.sheetOverlay}>
      {/* Tap outside to close */}
      <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />

      {/* Sheet */}
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
          FlipPilot AI
        </Text>

        {/* Subtitle */}
        <Text style={[styles.sheetSubtitle, { color: theme.muted }]}>
          Ideas based on your stats
        </Text>

        {/* AI Hints */}
        <Text style={[styles.aiHintText, { color: theme.text }]}>
          • Try focusing on items with similar profit to your best flip.{"\n"}
          • Use boot fairs to find more high-ROI items.{"\n"}
          • Track what categories give you the strongest returns.
        </Text>

        {/* Buttons Row */}
        <View style={styles.sheetButtonsRow}>
          <View
            style={[
              styles.cancelButton,
              {
                borderColor: theme.goldDeep,
                borderWidth: 3,
              },
            ]}
          >
            <Pressable onPress={closeSheet}>
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                Cancel
              </Text>
            </Pressable>
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
    paddingBottom: Platform.OS === "ios" ? 60 : 50,
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
  },

  sheetSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },

  aiHintText: {
    marginTop: 14,
    fontSize: 14,
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
    textAlign: "center",
  },
});

export default FlipPilotAssistantSheet;
