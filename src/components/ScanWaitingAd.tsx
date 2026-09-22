import { Linking, Pressable, StyleSheet, Text, View, Image } from "react-native";
import { ArrowSquareOut } from "phosphor-react-native";

import { businessAdverts } from "@/lib/businessAdverts";
import { useTheme } from "@/styles/ThemeContext";

/**
 * A small sponsored card shown while a scan is being looked up — the only truly
 * idle moment in the app, so it's the one place an advert doesn't get in the way
 * of anything else.
 *
 * IMPORTANT: `businessAdverts` (src/lib/businessAdverts.ts) is still the same
 * placeholder demo data used on the Boot Fairs page (invented businesses, made-up
 * ratings, stock photos) — showing it here as well does not make it any more real.
 * Swap that file for genuine sponsors, or wire this up to a real ad source, before
 * anyone sees it. Until then this is a mock-up of the idea, not a live ad slot.
 */

// A step 1 lookup (barcode ~0.6s, photo ~2s) is often over before anyone could
// read anything — only worth showing once the wait has gone on a little.
export const AD_REVEAL_DELAY_MS = 700;

export default function ScanWaitingAd() {
  const theme = useTheme();
  // Rotates every ~10s so a long wait (or a run of quick scans) doesn't show the
  // exact same advert every time.
  const advert = businessAdverts[Math.floor(Date.now() / 10_000) % businessAdverts.length];
  if (!advert) return null;

  return (
    <Pressable
      accessibilityRole={advert.website ? "button" : undefined}
      accessibilityLabel={
        advert.website ? `Sponsored: ${advert.title}. Visit website` : `Sponsored: ${advert.title}`
      }
      disabled={!advert.website}
      onPress={() => {
        if (advert.website) Linking.openURL(advert.website);
      }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      {advert.image ? (
        <Image source={{ uri: advert.image }} style={styles.image} resizeMode="cover" />
      ) : null}

      <View style={styles.body}>
        <View style={[styles.pill, { backgroundColor: theme.background }]}>
          <Text style={[styles.pillText, { color: theme.muted }]}>Sponsored</Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {advert.title}
        </Text>
        {advert.tagline ? (
          <Text style={[styles.tagline, { color: theme.muted }]} numberOfLines={1}>
            {advert.tagline}
          </Text>
        ) : null}
      </View>

      {advert.website ? <ArrowSquareOut size={16} color={theme.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    width: 280,
    maxWidth: "88%",
    marginTop: 28,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  image: { width: 44, height: 44, borderRadius: 10 },
  body: { flex: 1, gap: 2 },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 2,
  },
  pillText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  title: { fontSize: 14, fontWeight: "700" },
  tagline: { fontSize: 12 },
  pressed: { opacity: 0.75 },
});
