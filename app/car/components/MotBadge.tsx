import React from "react";
import { View } from "react-native";
import ThemedText from "@/styles/theme/ThemedText";
import { useTheme } from "@/context/ThemeContext";
import { getMotStatus } from "../carUtils";

export default function MotBadge({ expiry }: { expiry?: string }) {
  const theme = useTheme();
  const status = getMotStatus(expiry);

  const styles = {
    valid: {
      bg: "#2ecc71",
      text: "#0A1128",
      label: "MOT Valid",
    },
    dueSoon: {
      bg: "#f1c40f",
      text: "#0A1128",
      label: "MOT Due Soon",
    },
    expired: {
      bg: "#e74c3c",
      text: "#ffffff",
      label: "MOT Expired",
    },
    unknown: {
      bg: theme.card,
      text: theme.text,
      label: "No MOT Data",
    },
  };

  const s = styles[status];

  return (
    <View
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: s.bg,
        alignSelf: "flex-start",
        marginBottom: 12,
      }}
    >
      <ThemedText style={{ color: s.text, fontWeight: "900" }}>
        {s.label}
      </ThemedText>
    </View>
  );
}
