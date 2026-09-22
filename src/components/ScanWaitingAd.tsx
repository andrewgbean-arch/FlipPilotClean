import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowSquareOut } from "phosphor-react-native";

import { businessAdverts, type BusinessAdvert } from "@/lib/businessAdverts";
import { useTheme } from "@/styles/ThemeContext";

/**
 * Two full-size sponsored panels shown while a scan is being looked up — the
 * only genuinely idle moment in the app, so it's the one place a real ad
 * placement doesn't get in the way of anything else. This is meant to be a
 * paid slot, so it's built to look like one: a real image, a clear
 * "Sponsored" label and a tap-through, not a small aside.
 *
 * IMPORTANT: `businessAdverts` (src/lib/businessAdverts.ts) is still the same
 * placeholder demo data used on the Boot Fairs page (invented businesses,
 * made-up ratings, stock photos) — showing it here as well does not make it
 * any more real. Swap that file for genuine paying sponsors, or wire this up
 * to a real ad source, before anyone sees it. Until then this is a mock-up
 * of the idea, not a live ad slot.
 */

// A step 1 lookup (barcode ~0.6s, photo ~2s) is often over before anyone could
// read anything — only worth showing once the wait has gone on a little.
export const AD_REVEAL_DELAY_MS = 700;

function AdPanel({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();

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
        styles.panel,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <Image source={{ uri: advert.image }} style={styles.panelImage} resizeMode="cover" />

      <View style={styles.panelBody}>
        <View style={styles.panelHeaderRow}>
          <View style={[styles.pill, { backgroundColor: theme.background }]}>
            <Text style={[styles.pillText, { color: theme.muted }]}>Sponsored</Text>
          </View>
          {advert.website ? <ArrowSquareOut size={16} color={theme.muted} /> : null}
        </View>
        <Text style={[styles.panelTitle, { color: theme.text }]} numberOfLines={1}>
          {advert.title}
        </Text>
        <Text style={[styles.panelTagline, { color: theme.muted }]} numberOfLines={2}>
          {advert.tagline ?? advert.description}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ScanWaitingAd() {
  // Rotates every ~10s (or a run of quick scans shows different pairs), and
  // the two panels are always two different sponsors, never the same twice.
  const offset = Math.floor(Date.now() / 10_000);
  const first = businessAdverts[offset % businessAdverts.length];
  const second =
    businessAdverts.length > 1 ? businessAdverts[(offset + 1) % businessAdverts.length] : null;
  if (!first) return null;

  return (
    <View style={styles.stack}>
      <AdPanel advert={first} />
      {second ? <AdPanel advert={second} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1, width: "100%", paddingHorizontal: 16, gap: 12 },
  panel: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  panelImage: { width: "100%", flex: 1.4 },
  panelBody: { flex: 1, padding: 14, justifyContent: "center", gap: 4 },
  panelHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  panelTitle: { fontSize: 17, fontWeight: "800" },
  panelTagline: { fontSize: 13 },
  pressed: { opacity: 0.85 },
});
