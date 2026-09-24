import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowSquareOut } from "phosphor-react-native";

import AdReportButton from "@/components/AdReportButton";
import { HousePanel } from "@/components/HousePromo";
import SaveSponsorButton from "@/components/SaveSponsorButton";
import { lastShownAt, markShown, useRotated } from "@/lib/adRotation";
import { reportAdvertEvent, useAdverts, type ScanAdverts } from "@/lib/adverts";
import type { BusinessAdvert } from "@/lib/businessAdverts";
import { HOUSE_ADVERTS, fillWithHouse } from "@/lib/houseAdverts";
import { useTheme } from "@/styles/ThemeContext";

/**
 * What is shown while a scan is being looked up: the only genuinely idle moment
 * in the app, so the one place a real ad placement doesn't get in the way.
 * Built to look like the paid slot it is: a real picture, a clear "Sponsored"
 * label and a way through to the advertiser, not a small aside.
 *
 * Two layouts:
 *  - a full page: one advertiser has the whole screen for their turn. A few
 *    advertisers near the phone share the full page and take turns, the one
 *    this phone saw longest ago first;
 *  - panels: two smaller advertisers share the screen, a fresh pair each scan.
 * The same full page is never shown twice within FULL_PAGE_REST_MS: scanning
 * again straight away brings the next advertiser's, or the panels. With nothing
 * booked it shows nothing at all. It goes the moment the result is ready, and
 * never holds anything up.
 *
 * Only the Visit button opens the advertiser's website. Touching the advert
 * anywhere else does nothing, so a stray tap during a scan can't throw someone
 * out of the app before their result arrives.
 */

// A step 1 lookup (barcode ~0.6s, photo ~2s) is often over before anyone could
// read anything — only worth showing once the wait has gone on a little.
export const AD_REVEAL_DELAY_MS = 700;

const NONE: ScanAdverts = { layout: "panels", adverts: [] };
const NO_ADVERTS: BusinessAdvert[] = [];

/** A full page just shown on this phone is rested for this long, so scans never repeat it. */
export const FULL_PAGE_REST_MS = 10 * 60_000;

function open(advert: BusinessAdvert) {
  reportAdvertEvent(advert.id, "click");
  if (advert.website) Linking.openURL(advert.website).catch(() => {});
}

function VisitButton({ advert, label = "Visit" }: { advert: BusinessAdvert; label?: string }) {
  const theme = useTheme();
  if (!advert.website) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sponsored: ${advert.title}. Visit website`}
      hitSlop={8}
      onPress={() => open(advert)}
      style={({ pressed }) => [styles.cta, { backgroundColor: theme.goldDeep }, pressed && styles.pressed]}
    >
      <Text style={[styles.ctaText, { color: theme.black }]}>{label}</Text>
      <ArrowSquareOut size={14} color={theme.black} />
    </Pressable>
  );
}

function AdPanel({ advert }: { advert: BusinessAdvert }) {
  return advert.house ? <HousePanel advert={advert} /> : <PaidPanel advert={advert} />;
}

function PaidPanel({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();
  useEffect(() => {
    markShown(advert.id);
    reportAdvertEvent(advert.id, "view");
  }, [advert.id]);

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      <Image source={{ uri: advert.image }} style={styles.panelImage} resizeMode="cover" />

      <View style={styles.panelBody}>
        <View style={styles.panelHeaderRow}>
          <View style={[styles.pill, { backgroundColor: theme.background }]}>
            <Text style={[styles.pillText, { color: theme.muted }]}>Sponsored</Text>
          </View>
          <View style={styles.buttons}>
            <SaveSponsorButton advert={advert} />
            <VisitButton advert={advert} />
          </View>
        </View>
        <Text style={[styles.panelTitle, { color: theme.text }]} numberOfLines={1}>
          {advert.title}
        </Text>
        <Text style={[styles.panelTagline, { color: theme.muted }]} numberOfLines={2}>
          {advert.tagline ?? advert.description}
        </Text>
      </View>
      <View style={styles.reportRow}>
        <AdReportButton advertId={advert.id} />
      </View>
    </View>
  );
}

/** Up to three pictures to swipe through, with dots showing where you are. `fill` makes it cover the whole card. */
function Gallery({ pictures, fill }: { pictures: string[]; fill?: boolean }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const frame = fill ? styles.fillAll : styles.fullImage;

  if (pictures.length <= 1) {
    return <Image source={{ uri: pictures[0] }} style={frame} resizeMode="cover" />;
  }

  return (
    <View style={frame} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {pictures.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width, height: "100%" }} resizeMode="cover" />
          ))}
        </ScrollView>
      ) : null}
      <View style={[styles.dots, fill && styles.dotsHigh]} pointerEvents="none">
        {pictures.map((uri, i) => (
          <View
            key={uri}
            style={[styles.dot, { backgroundColor: i === page ? theme.goldDeep : theme.white, opacity: i === page ? 1 : 0.6 }]}
          />
        ))}
      </View>
    </View>
  );
}

/** One advertiser's turn on the full page: their own design if they made one, else our template. */
function FullAd({ advert }: { advert: BusinessAdvert }) {
  return advert.artwork ? <DesignedAd advert={advert} /> : <TemplateAd advert={advert} />;
}

/**
 * The advertiser's own portrait design, edge to edge. Any extra photos are more
 * pages to swipe to. Our buttons sit on a dark strip along the bottom, so a design
 * should keep its own writing out of roughly the bottom fifth.
 */
function DesignedAd({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();
  useEffect(() => {
    markShown(advert.id);
    reportAdvertEvent(advert.id, "view");
  }, [advert.id]);
  const pictures = [advert.artwork!, ...(advert.images ?? []).filter((p) => p !== advert.artwork)];

  return (
    <View style={[styles.full, { backgroundColor: theme.black, borderColor: theme.hairline }]}>
      <Gallery pictures={pictures} fill />
      <View style={styles.designPill} pointerEvents="none">
        <Text style={styles.designPillText}>SPONSORED</Text>
      </View>
      <View style={styles.designBar}>
        {advert.tagline ? (
          <Text style={styles.designTagline} numberOfLines={2}>
            <Text style={styles.designTitle}>{advert.title}</Text>
            {"  "}
            {advert.tagline}
          </Text>
        ) : (
          <Text style={styles.designTitle} numberOfLines={1}>
            {advert.title}
          </Text>
        )}
        <View style={styles.fullActions}>
          <View style={styles.buttons}>
            <SaveSponsorButton advert={advert} />
            <VisitButton advert={advert} label="Visit website" />
          </View>
          <AdReportButton advertId={advert.id} onPhoto />
        </View>
      </View>
    </View>
  );
}

/** One advertiser has the whole screen to themselves, laid out by us from their picture and words. */
function TemplateAd({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();
  useEffect(() => {
    markShown(advert.id);
    reportAdvertEvent(advert.id, "view");
  }, [advert.id]);
  const pictures = advert.images && advert.images.length > 0 ? advert.images : [advert.image];

  return (
    <View style={[styles.full, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      <Gallery pictures={pictures} />

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
        <View style={styles.fullActions}>
          <View style={styles.buttons}>
            <SaveSponsorButton advert={advert} />
            <VisitButton advert={advert} label="Visit website" />
          </View>
          <AdReportButton advertId={advert.id} />
        </View>
      </View>
    </View>
  );
}

export default function ScanWaitingAd() {
  const data = useAdverts<ScanAdverts>("scan", NONE);
  const fulls = useMemo(() => (data.layout === "full" ? data.adverts : NO_ADVERTS), [data]);
  const shared = useMemo(() => (data.layout === "full" ? data.panels ?? NO_ADVERTS : data.adverts), [data]);
  const fullOrder = useRotated(fulls);
  const paidPanels = useRotated(shared);
  const houseOrder = useRotated(HOUSE_ADVERTS);

  // Chosen once for this scan, so the screen never swaps adverts halfway through a wait
  // (showing a full page marks it as just shown, which would otherwise rest it at once).
  const choice = useRef<{ fullId: string | null; panelIds: string[] | null } | null>(null);

  // Nothing has come back from the server yet, or what was read hasn't been sorted yet.
  if (data === NONE) return null;
  if ((fulls.length > 0 && fullOrder.length === 0) || (shared.length > 0 && paidPanels.length === 0) || houseOrder.length === 0) return null;

  if (!choice.current) {
    const next = fullOrder[0];
    const resting = next ? Date.now() - lastShownAt(next.id) < FULL_PAGE_REST_MS : false;
    choice.current = { fullId: next && !resting ? next.id : null, panelIds: null };
  }

  const full = choice.current.fullId ? fullOrder.find((a) => a.id === choice.current!.fullId) : undefined;
  if (full) {
    return (
      <View style={styles.stack}>
        <FullAd advert={full} />
      </View>
    );
  }

  // The two this phone saw longest ago, so every scan brings a fresh pair until
  // everyone booked has had a turn. The two panels are always different sponsors.
  // Any place nobody has bought is filled with FlipPilot's own promos, after the paying advertisers.
  // The pair is fixed the first time it is worked out. Otherwise a late refresh of the adverts
  // (or these two being marked as just shown) would re-sort them and swap the pair mid-wait.
  if (!choice.current.panelIds) {
    choice.current.panelIds = fillWithHouse(paidPanels, houseOrder, 2).map((a) => a.id);
  }
  const pool = [...paidPanels, ...houseOrder];
  const [first, second] = choice.current.panelIds
    .map((id) => pool.find((a) => a.id === id))
    .filter((a): a is BusinessAdvert => Boolean(a));
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
  full: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  fullImage: { width: "100%", flex: 1.6 },
  fillAll: { width: "100%", flex: 1 },
  dotsHigh: { bottom: 96 },
  designPill: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  designPillText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  designBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.74)",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  designTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  designTagline: { color: "#fff", fontSize: 13 },
  fullBody: { flex: 1.2, padding: 18, gap: 8, justifyContent: "center" },
  fullTitle: { fontSize: 24, fontWeight: "900" },
  fullTagline: { fontSize: 15, fontWeight: "700" },
  fullDescription: { fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: "row", alignItems: "center", gap: 8 },
  fullActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: { fontSize: 14, fontWeight: "800" },
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
