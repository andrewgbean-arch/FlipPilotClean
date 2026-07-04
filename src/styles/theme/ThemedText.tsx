import { Text, TextProps } from "react-native";
import React from "react";
import { useTheme } from "../../context/ThemeContext";

interface ThemedTextProps extends TextProps {
  variant?: "default" | "muted" | "accent" | "danger" | "success";
}

export function ThemedText({
  variant = "default",
  style,
  ...props
}: ThemedTextProps) {
  const theme = useTheme();

  const color =
    variant === "muted"
      ? theme.muted
      : variant === "accent"
      ? theme.accent
      : variant === "danger"
      ? theme.danger
      : variant === "success"
      ? theme.success
      : theme.text;

  return <Text {...props} style={[{ color }, style]} />;
}

export default ThemedText;

