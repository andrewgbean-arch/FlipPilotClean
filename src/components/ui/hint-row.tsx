import type { ReactNode } from "react";
import { View, StyleSheet, Text } from "react-native";

import { layout } from "../../styles/layout";
const { spacing: Spacing, radius: Radius } = layout;

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
      <Text style={textVariants.small}>{title}</Text>

      <View style={styles.codeSnippet}>
        <Text style={textVariants.small}>{hint}</Text>
      </View>
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
