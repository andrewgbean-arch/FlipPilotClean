import React, { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Car, Megaphone } from "phosphor-react-native";

import { markShown } from "@/lib/adRotation";
import type { BusinessAdvert } from "@/lib/businessAdverts";
import { useTheme } from "@/styles/ThemeContext";
import { openPartnerLink } from "@/utils/partnerLinks";

/**
 * FlipPilot's own promos (Dealer OS, and "Advertise here"), drawn in the app so
 * they need no picture from anywhere. Two sizes: a compact card for the
 * marketplace feed and a panel for the scan wait.
 *
 * As with paid adverts, only the button opens anything.
 */

const LABEL: Record<"dealers" | "advertise", string> = {
  dealers: "Find out more",
  advertise: "Advertise here",
};

/** The picture side: our logo for Dealer OS, a "your ad here" frame for the invitation. */
function Art({ kind, big }: { kind: "dealers" | "advertise"; big?: boolean }) {
  const theme = useTheme();
  if (kind === "dealers") {
    return (
      <View style={[styles.art, big && styles.artBig, { backgroundColor: theme.black }]}>
        <Image source={require("@/assets/images/logopulse.png")} style={styles.logo} resizeMode="contain" />
        <View style={styles.artBadge}>
          <Car size={big ? 20 : 16} weight="fill" color={theme.goldDeep} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.art, big && styles.artBig, { backgroundColor: theme.black }]}>
      <View style={[styles.dashed, { borderColor: theme.goldDeep }]}>
        <Megaphone size={big ? 44 : 30} weight="fill" color={theme.goldDeep} />
        <Text style={[styles.dashedText, { color: theme.goldDeep }]}>YOUR AD{"\n"}HERE</Text>
      </View>
    </View>
  );
}

function Pill() {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.goldDeep }]}>
      <Text style={[styles.pillText, { color: theme.black }]}>FLIPPILOT</Text>
    </View>
  );
}

function Button({ kind }: { kind: "dealers" | "advertise" }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kind === "dealers" ? "Find out more about FlipPilot Dealer OS" : "Advertise your business here"}
      hitSlop={8}
      onPress={() => openPartnerLink(kind)}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.goldDeep }, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, { color: theme.black }]}>{LABEL[kind]}</Text>
    </Pressable>
  );
}

/** A compact card for the marketplace feed, the same size as a listing. */
export const HouseFeedCard = React.memo(function HouseFeedCard({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();
  const kind = advert.house!;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.goldDeep }]}>
      <Art kind={kind} />
      <View style={styles.body}>
        <View>
          <Pill />
          <Text style={[styles.title, { color: theme.goldDeep }]} numberOfLines={2}>
            {advert.title}
          </Text>
          <Text style={[styles.tagline, { color: theme.muted }]} numberOfLines={2}>
            {advert.tagline}
          </Text>
        </View>
        <View style={styles.actions}>
          <Button kind={kind} />
        </View>
      </View>
    </View>
  );
});

/** A panel for the scan wait, sharing the screen with another advert. */
export function HousePanel({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();
  const kind = advert.house!;
  useEffect(() => markShown(advert.id), [advert.id]);

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      <Art kind={kind} big />
      <View style={styles.panelBody}>
        <Pill />
        <Text style={[styles.panelTitle, { color: theme.text }]} numberOfLines={1}>
          {advert.title}
        </Text>
        <Text style={[styles.panelTagline, { color: theme.muted }]} numberOfLines={2}>
          {advert.description ?? advert.tagline}
        </Text>
        <View style={styles.actions}>
          <Button kind={kind} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  body: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, justifyContent: "space-between" },
  art: { width: 104, alignSelf: "stretch", minHeight: 112, alignItems: "center", justifyContent: "center" },
  artBig: { width: "100%", flex: 1.3 },
  logo: { width: "90%", height: "90%" },
  artBadge: { position: "absolute", right: 6, bottom: 6 },
  dashed: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 12,
    width: "82%",
    height: "78%",
  },
  dashedText: { fontSize: 11, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  pill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 4 },
  pillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  title: { fontSize: 16, fontWeight: "700" },
  tagline: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  buttonText: { fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.85 },
  panel: { flex: 1, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  panelBody: { flex: 1, padding: 14, justifyContent: "center", gap: 4 },
  panelTitle: { fontSize: 17, fontWeight: "800" },
  panelTagline: { fontSize: 13 },
});
