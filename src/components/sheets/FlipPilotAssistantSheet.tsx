import React from "react";
import { Animated, StyleSheet, Pressable, View, Text } from "react-native";
import { ChartLineUp, Tent, Trophy } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/useTheme";

interface FlipPilotAssistantSheetProps {
  translateY: Animated.AnimatedInterpolation<string | number>;
  closeSheet: () => void;
  isOpen: boolean;
}

const TIPS: { key: string; Icon: PhosphorIcon; text: string }[] = [
  {
    key: "best",
    Icon: Trophy,
    text: "Try focusing on items with similar profit to your best flip.",
  },
  {
    key: "bootfairs",
    Icon: Tent,
    text: "Use boot fairs to find more high-ROI items.",
  },
  {
    key: "categories",
    Icon: ChartLineUp,
    text: "Track what categories give you the strongest returns.",
  },
];

const FlipPilotAssistantSheet: React.FC<FlipPilotAssistantSheetProps> = ({
  translateY,
  closeSheet,
  isOpen,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!isOpen) return null;

  return (
    <View style={styles.sheetOverlay}>
      {/* Tap outside to close */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={closeSheet}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: theme.card,
            borderColor: theme.hairline,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Handle */}
        <View style={[styles.sheetHandle, { backgroundColor: theme.muted }]} />

        {/* Title */}
        <Text style={[styles.sheetTitle, { color: theme.text }]} accessibilityRole="header">
          FlipPilot AI
        </Text>

        {/* Subtitle */}
        <Text style={[styles.sheetSubtitle, { color: theme.muted }]}>
          Ideas based on your stats
        </Text>

        {/* AI Hints */}
        <View
          style={[
            styles.tips,
            { backgroundColor: theme.background, borderColor: theme.hairline },
          ]}
        >
          {TIPS.map(({ key, Icon, text }, index) => (
            <View
              key={key}
              style={[
                styles.tipRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: theme.hairline },
              ]}
            >
              <Icon size={20} color={theme.muted} style={styles.tipIcon} />
              <Text style={[styles.tipText, { color: theme.text }]}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: theme.background, borderColor: theme.hairline },
            pressed && styles.pressed,
          ]}
          onPress={closeSheet}
        >
          <Text style={[styles.closeButtonText, { color: theme.text }]}>Close</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheetOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },

  sheetContainer: {
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
  },

  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
    marginBottom: 14,
  },

  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
  },

  sheetSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
  },

  tips: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },

  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },

  tipIcon: {
    marginTop: 1,
  },

  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },

  closeButton: {
    minHeight: 52,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.75,
  },
});

export default FlipPilotAssistantSheet;
