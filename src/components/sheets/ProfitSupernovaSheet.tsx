import React from "react";
import { Animated, StyleSheet, Pressable, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/useTheme";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

interface ProfitSupernovaSheetProps {
  translateY: Animated.AnimatedInterpolation<string | number>;
  closeSheet: () => void;
  bestFlip: FlipRecord | null;
  avgProfit: number;
  avgROI: number;
}

// Profit and loss both carry an explicit sign.
const signedMoney = (value: number) =>
  `${value >= 0 ? "+" : "-"}£${Math.abs(value).toFixed(2)}`;
const signedPercent = (value: number) =>
  `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}%`;

const ProfitSupernovaSheet: React.FC<ProfitSupernovaSheetProps> = ({
  translateY,
  closeSheet,
  bestFlip,
  avgProfit,
  avgROI,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const bestProfit = Number(bestFlip?.pricing?.predictedProfit ?? 0) || 0;

  const tone = (value: number) => (value >= 0 ? theme.success : theme.danger);

  return (
    <View style={styles.sheetOverlay}>
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
          Profit Supernova
        </Text>

        {/* Subtitle */}
        <Text style={[styles.sheetSubtitle, { color: theme.muted }]}>
          Your strongest flips and averages
        </Text>

        {/* Best Flip */}
        <View
          style={[
            styles.hero,
            { backgroundColor: theme.background, borderColor: theme.hairline },
          ]}
        >
          <Text style={[styles.label, { color: theme.muted }]}>Best flip profit</Text>
          <Text
            style={[styles.heroValue, { color: tone(bestProfit) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {signedMoney(bestProfit)}
          </Text>
        </View>

        <View style={styles.tiles}>
          {/* Average Profit */}
          <View
            style={[
              styles.tile,
              { backgroundColor: theme.background, borderColor: theme.hairline },
            ]}
          >
            <Text style={[styles.label, { color: theme.muted }]}>Average profit</Text>
            <Text
              style={[styles.tileValue, { color: tone(avgProfit) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {signedMoney(avgProfit)}
            </Text>
          </View>

          {/* Average ROI */}
          <View
            style={[
              styles.tile,
              { backgroundColor: theme.background, borderColor: theme.hairline },
            ]}
          >
            <Text style={[styles.label, { color: theme.muted }]}>Average ROI</Text>
            <Text
              style={[styles.tileValue, { color: tone(avgROI) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {signedPercent(avgROI)}
            </Text>
          </View>
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

  hero: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },

  heroValue: {
    fontSize: 32,
    fontWeight: "700",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },

  tiles: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },

  tile: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
  },

  tileValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
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

export default ProfitSupernovaSheet;
