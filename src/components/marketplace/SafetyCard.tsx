import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/styles/ThemeContext";

/**
 * The plain safety advice, folded away until someone wants it. Open by default
 * where it matters most (a seller about to publish), tucked away where it would
 * otherwise nag on every screen.
 */
export default function SafetyCard({
  title,
  tips,
  startOpen = false,
}: {
  title: string;
  tips: string[];
  startOpen?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(startOpen);

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.hairline,
        padding: 14,
        marginVertical: 14,
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <Feather name="shield" size={18} color={theme.goldDeep} />
        <Text style={{ color: theme.goldDeep, fontWeight: "800", fontSize: 15, flex: 1 }}>
          {title}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.muted}
        />
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 12, gap: 8 }}>
          {tips.map((tip) => (
            <View key={tip} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={{ color: theme.goldDeep }}>•</Text>
              <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20, flex: 1 }}>
                {tip}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
