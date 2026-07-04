import type { ReactNode } from "react";
import { View, StyleSheet } from "react-native";

import ThemedText from "./ThemedText";
import ThemedView from "./ThemedView";

import { layout } from "../styles/layout";
const { spacing: Spacing, radius: Radius } = layout;

// ⭐ New text variants (replaces type="small")
const textVariants = {
  small: { fontSize: 13, opacity: 0.75 },
};

type HintRowProps = {
  title?: string;
  hint?: ReactNode;
};

export function HintRow({
  title = "Try editing",
  hint = "app/index.tsx",
}: HintRowProps) {
  return (
    <View style={styles.stepRow}>
      <ThemedText style={textVariants.small}>{title}</ThemedText>

      <ThemedView style={styles.codeSnippet}>
        <ThemedText style={textVariants.small}>{hint}</ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  codeSnippet: {
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
