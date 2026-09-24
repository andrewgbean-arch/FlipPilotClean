import { useEffect } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowSquareOut } from "phosphor-react-native";

import AdReportButton from "@/components/AdReportButton";
import { reportAdvertEvent, useAdverts, type ScanAdverts } from "@/lib/adverts";
import type { BusinessAdvert } from "@/lib/businessAdverts";
import { useTheme } from "@/styles/ThemeContext";

/**
 * What is shown while a scan is being looked up: the only genuinely idle moment
 * in the app, so the one place a real ad placement doesn't get in the way.
 * Built to look like the paid slot it is: a real picture, a clear "Sponsored"
 * label and a tap-through, not a small aside.
 *
 * Two layouts, chosen by the server from what has been booked:
 *  - "full": one advertiser has booked the whole screen to themselves;
 *  - "panels": two smaller advertisers share it.
 * With nothing booked it shows nothing at all. It goes the moment the result is
 * ready, and never holds anything up.
 */

// A step 1 lookup (barcode ~0.6s, photo ~2s) is often over before anyone could
// read anything — only worth showing once the wait has gone on a little.
export const AD_REVEAL_DELAY_MS = 700;

const NONE: ScanAdverts = { layout: "panels", adverts: [] };

function open(advert: BusinessAdvert) {
  reportAdvertEvent(advert.id, "click");
  if (advert.website) Linking.openURL(advert.website);
}

function AdPanel({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();
  useEffect(() => reportAdvertEvent(advert.id, "view"), [advert.id]);

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      <Pressable
        accessibilityRole={advert.website ? "button" : undefined}
        accessibilityLabel={
          advert.website ? `Sponsored: ${advert.title}. Visit website` : `Sponsored: ${advert.title}`
        }
        disabled={!advert.website}
        onPress={() => open(advert)}
        style={({ pressed }) => [styles.panelTap, pressed && styles.pressed]}
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
      <View style={styles.reportRow}>
        <AdReportButton advertId={advert.id} />
      </View>
    </View>
  );
}

/** One advertiser has the whole screen to themselves. */
function FullAd({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();
  useEffect(() => reportAdvertEvent(advert.id, "view"), [advert.id]);

  return (
    <View style={[styles.full, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      <Pressable
        accessibilityRole={advert.website ? "button" : undefined}
        accessibilityLabel={
          advert.website ? `Sponsored: ${advert.title}. Visit website` : `Sponsored: ${advert.title}`
        }
        disabled={!advert.website}
        onPress={() => open(advert)}
        style={({ pressed }) => [styles.fullTap, pressed && styles.pressed]}
      >
        <Image source={{ uri: advert.image }} style={styles.fullImage} resizeMode="cover" />

        <View style={styles.fullBody}>
          <View style={[styles.pill, { backgroundColor: theme.background }]}>
            <Text style={[styles.pillText, { color: theme.muted }]}>Sponsored</Text>
          </View>
          <Text style={[styles.fullTitle, { color: theme.text }]} numberOfLines={2}>
            {advert.title}
          </Text>
          {advert.tagline ? (
            <Text style={[styles.fullTagline, { color: theme.goldDeep }]} numberOfLines={2}>
              {advert.tagline}
            </Text>
          ) : null}
          {advert.description ? (
            <Text style={[styles.fullDescription, { color: theme.muted }]} numberOfLines={4}>
              {advert.description}
            </Text>
          ) : null}
          {advert.website ? (
            <View style={[styles.cta, { backgroundColor: theme.goldDeep }]}>
              <Text style={[styles.ctaText, { color: theme.black }]}>Visit website</Text>
              <ArrowSquareOut size={16} color={theme.black} />
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.reportRow}>
        <AdReportButton advertId={advert.id} />
      </View>
    </View>
  );
}

export default function ScanWaitingAd() {
  const { layout, adverts } = useAdverts<ScanAdverts>("scan", NONE);
  if (adverts.length === 0) return null;

  if (layout === "full") {
    return (
      <View style={styles.stack}>
        <FullAd advert={adverts[0]} />
      </View>
    );
  }

  // Rotates every ~10s (or a run of quick scans shows different pairs), and
  // the two panels are always two different sponsors, never the same twice.
  const offset = Math.floor(Date.now() / 10_000);
  const first = adverts[offset % adverts.length];
  const second = adverts.length > 1 ? adverts[(offset + 1) % adverts.length] : null;

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
  panelTap: { flex: 1 },
  panelImage: { width: "100%", flex: 1.4 },
  panelBody: { flex: 1, padding: 14, justifyContent: "center", gap: 4 },
  panelHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  full: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  fullTap: { flex: 1 },
  fullImage: { width: "100%", flex: 1.6 },
  fullBody: { flex: 1.2, padding: 18, gap: 8, justifyContent: "center" },
  fullTitle: { fontSize: 24, fontWeight: "900" },
  fullTagline: { fontSize: 15, fontWeight: "700" },
  fullDescription: { fontSize: 14, lineHeight: 20 },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 4,
  },
  ctaText: { fontSize: 15, fontWeight: "800" },
  reportRow: { paddingHorizontal: 14, paddingBottom: 8 },
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
