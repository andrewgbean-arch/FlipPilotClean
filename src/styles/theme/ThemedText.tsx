import React from "react";
import { Text, TextProps, StyleProp, TextStyle } from "react-native";
import { useTheme } from "@/styles/useTheme";

interface ThemedTextProps extends TextProps {
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export default function ThemedText({ children, style, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      {...rest}
      style={[{ color: theme.text }, style]}
    >
      {children}
    </Text>
  );
}

