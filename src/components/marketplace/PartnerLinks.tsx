import React from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { PARTNER_LINKS, openPartnerLink, type PartnerLinkKind } from "@/utils/partnerLinks";

/**
 * FlipPilot's own two promotions: one for car dealers, one for businesses that
 * want to advertise. Labelled as FlipPilot's own, so nobody mistakes them for a
 * listing or for someone else's ad.
 */
export default function PartnerLinks() {
  const theme = useTheme();
  const kinds: PartnerLinkKind[] = ["dealers", "advertise"];

  return (
    <View style={{ gap: 12 }}>
      {kinds.map((kind) => {
        const link = PARTNER_LINKS[kind];
        return (
          <View
            key={kind}
            style={{
              backgroundColor: theme.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.goldSoftGlow,
              padding: 14,
            }}
          >
            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 }}>
              FROM FLIPPILOT
            </Text>
            <Text style={{ color: theme.goldDeep, fontSize: 17, fontWeight: "800" }}>{link.title}</Text>
            <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{link.text}</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${link.title}. ${link.button}`}
              onPress={() => openPartnerLink(kind)}
              style={({ pressed }) => [
                {
                  alignSelf: "flex-start",
                  marginTop: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: theme.goldDeep,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: theme.goldDeep, fontWeight: "800", fontSize: 14 }}>{link.button}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
