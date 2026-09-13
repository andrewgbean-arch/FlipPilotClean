import { View, ViewProps } from "react-native";
import React from "react";
import { useTheme } from "../ThemeContext";

interface ThemedViewProps extends ViewProps {
  variant?: "card" | "background" | "accent" | "muted";
}

export default function ThemedView({
  variant = "background",
  style,
  ...props
}: ThemedViewProps) {
  const theme = useTheme();

  const backgroundColor =
    variant === "card"
      ? theme.card
      : variant === "accent"
      ? theme.accent
      : variant === "muted"
      ? theme.muted
      : theme.background;

  return <View style={[{ backgroundColor }, style]} {...props} />;
}

