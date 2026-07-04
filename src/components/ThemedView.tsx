import { useTheme } from "../context/ThemeContext";
import { Platform, StyleSheet, Text, type TextProps } from "react-native";

export type ThemedTextProps = TextProps & {
  type?:
    | "default"
    | "title"
    | "small"
    | "smallBold"
    | "subtitle"
    | "link"
    | "linkPrimary"
    | "code";
  themeColor?:
    | "text"
    | "background"
    | "backgroundElement"
    | "backgroundSelected"
    | "textSecondary";
};

export function ThemedText({
  style,
  type = "default",
  themeColor = "text",
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  // Map old themeColor → new theme keys
  const colorMap: Record<string, string> = {
    text: theme.text,
    background: theme.card,
    backgroundElement: theme.card,
    backgroundSelected: theme.accent,
    textSecondary: theme.muted,
  };

  const resolvedColor = colorMap[themeColor] ?? theme.text;

  return (
    <Text
      style={[
        { color: resolvedColor },
        type === "default" && styles.default,
        type === "title" && styles.title,
        type === "small" && styles.small,
        type === "smallBold" && styles.smallBold,
        type === "subtitle" && styles.subtitle,
        type === "link" && styles.link,
        type === "linkPrimary" && styles.linkPrimary,
        type === "code" && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  title: {
    fontSize: 48,
    fontWeight: "600",
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: "600",
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: "#3c87f7",
  },
  code: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontWeight: Platform.select({ android: "700" }) ?? "500",
    fontSize: 12,
  },
});

// ⭐ REQUIRED — fixes your SponsoredCard import
export default ThemedText;
