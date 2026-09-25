import React, { useEffect, useState } from "react";
import GoldFoil from "@/components/ui/GoldFoil";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Car, Package, WarningCircle } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { formatMoney } from "@/features/vehicles/utils/vehicleStats";
import { useTheme } from "@/styles/ThemeContext";
import type { Theme } from "@/styles/theme";
import { estimateVehiclePrice } from "@/utils/vehiclePrice";

type MarketResult = {
  priceRange: { low: number; mid: number; high: number };
  competition: number;
  estimatedValue: number;
  confidence: "low" | "medium" | "high";
  notes: string[];
  similarListings: { title: string; price: number | null; image: string | null }[];
};

// Kept for the session, so reopening the screen doesn't ask eBay and the AI the same question again.
const answered = new Map<string, MarketResult>();

function labelFor(vehicle: any) {
  return vehicle.mot?.make && vehicle.mot?.model
    ? `${vehicle.mot.make} ${vehicle.mot.model}`
    : vehicle.title ?? "This vehicle";
}

/* ------------------------------------------------------------------ */
/* Small local components                                             */
/* ------------------------------------------------------------------ */

function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

// A card that holds rows and blocks; the rows inside are split by hairlines.
function Group({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      {children}
    </View>
  );
}

function TextBlock({ text, divider }: { text: string; divider?: boolean }) {
  const theme = useTheme();

  return (
    <View style={[styles.textBlock, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}>
      <Text style={[styles.textBlockText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

// Low-to-high price track with a marker where the mid price sits.
function RangeBar({ position }: { position: number | null }) {
  const theme = useTheme();

  return (
    <View style={styles.rangeWrap}>
      <View style={[styles.rangeTrack, { backgroundColor: theme.background }]} />
      {position != null ? (
        <View
          style={[
            styles.rangeMarker,
            {
              left: `${position * 100}%`,
              backgroundColor: theme.text,
              borderColor: theme.card,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function RangeCol({
  label,
  value,
  align,
}: {
  label: string;
  value: string;
  align: "flex-start" | "center" | "flex-end";
}) {
  const theme = useTheme();

  return (
    <View style={{ alignItems: align }}>
      <Text style={[styles.rangeLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.rangeValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function ListingThumb({ uri }: { uri: string | null }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={styles.listingThumb}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[styles.listingThumb, styles.listingThumbEmpty, { backgroundColor: theme.background }]}>
      <Package size={24} color={theme.muted} />
    </View>
  );
}

function ListingRow({
  item,
  divider,
}: {
  item: MarketResult["similarListings"][number];
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${item.title}, ${item.price != null ? formatMoney(item.price) : "price unknown"}`}
      style={[styles.listingRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <ListingThumb key={item.image ?? "none"} uri={item.image} />

      <View style={styles.listingText}>
        <Text style={[styles.listingTitle, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.price != null ? (
          <Text style={[styles.listingPrice, { color: theme.text }]}>{formatMoney(item.price)}</Text>
        ) : (
          <Text style={[styles.listingUnknown, { color: theme.muted }]}>Price unknown</Text>
        )}
      </View>
    </View>
  );
}

// Centred loading / error / not-found message, same pattern as the other screens.
function StateBlock({
  Icon,
  title,
  body,
  warning,
  loading,
}: {
  Icon?: PhosphorIcon;
  title: string;
  body?: string;
  warning?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.stateBox}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.gold} />
      ) : Icon ? (
        <View
          style={[styles.stateIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
        >
          <Icon size={30} color={warning ? theme.warning : theme.muted} />
        </View>
      ) : null}

      <Text
        style={[loading ? styles.stateLoading : styles.stateTitle, { color: loading ? theme.muted : theme.text }]}
        accessibilityRole={loading ? undefined : "header"}
      >
        {title}
      </Text>
      {body ? <Text style={[styles.stateBody, { color: theme.muted }]}>{body}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screens                                                            */
/* ------------------------------------------------------------------ */

export default function MarketScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { vehicles, loaded, loadError } = useVehicleHistory();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    // Saved vehicles are read from storage after launch; don't call one
    // missing before that has finished.
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {!loaded ? (
          <StateBlock loading title="Loading your saved vehicle" />
        ) : loadError ? (
          <StateBlock warning Icon={WarningCircle} title="Couldn't load your flips" body={loadError} />
        ) : (
          <StateBlock
            Icon={Car}
            title="Vehicle not found"
            body="It may have been deleted from your flips."
          />
        )}
      </View>
    );
  }

  return <MarketScanContent vehicle={vehicle} router={router} theme={theme} />;
}

function MarketScanContent({
  vehicle,
  router,
  theme,
}: {
  vehicle: ReturnType<typeof useVehicleHistory>["vehicles"][number];
  router: ReturnType<typeof useRouter>;
  theme: Theme;
}) {
  const insets = useSafeAreaInsets();

  const [market, setMarket] = useState<MarketResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const label = labelFor(vehicle);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const kept = answered.get(vehicle.id);
      if (kept) {
        setMarket(kept);
        setError(null);
        setLoading(false);
        return;
      }

      const mot = vehicle.mot;
      if (!mot?.make || !mot?.model || !mot?.year) {
        setError("This vehicle needs a make, model and year saved (from an MOT lookup) before it can be priced.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // The same real comparison as the price estimate on the vehicle's details: comparable cars listed on eBay.
      const result = await estimateVehiclePrice({
        make: mot.make,
        model: mot.model,
        year: mot.year,
        mileage: mot.mileage ?? null,
        condition: "good",
        motAdvisoryCount: mot.advisories?.length ?? 0,
        motFailureCount: mot.failures?.length ?? 0,
      });
      if (cancelled) return;

      if (!result.ok) {
        setError(result.message || "Couldn't get market data for this vehicle.");
        setLoading(false);
        return;
      }

      const found: MarketResult = {
        priceRange: { low: Math.round(result.range.min), mid: Math.round(result.estimatedValue), high: Math.round(result.range.max) },
        competition: result.comparableCount,
        estimatedValue: Math.round(result.estimatedValue),
        confidence: result.confidence,
        notes: result.notes,
        similarListings: result.comparables.slice(0, 5).map((c) => ({ title: c.title, price: c.price, image: null })),
      };
      answered.set(vehicle.id, found);
      setMarket(found);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [vehicle.id]);

    const card = { backgroundColor: theme.card, borderColor: theme.hairline };

  // Where the mid price sits between the low and the high.
  const range = market?.priceRange ?? null;
  const span = range ? range.high - range.low : 0;
  const midPosition =
    range && span > 0 ? Math.min(1, Math.max(0, (range.mid - range.low) / span)) : null;

  const showingState = loading || !!error || !market;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, showingState && styles.contentGrow]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <Text style={[styles.pageTitle, { color: theme.text }]} accessibilityRole="header">
          Market scan
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]} numberOfLines={2}>
          Comparable cars on eBay for {label}
        </Text>

        {loading ? (
          <StateBlock loading title="Checking eBay for comparable cars" />
        ) : null}

        {!loading && error ? (
          <StateBlock
            warning
            Icon={WarningCircle}
            title="Market prices unavailable"
            body={error}
          />
        ) : null}

        {!loading && market ? (
          <>
            {/* RECOMMENDED PRICE */}
            <View
              accessible
              accessibilityLabel={`Estimated value ${formatMoney(market.estimatedValue)}`}
              style={[styles.hero, card]}
            >
              <Text style={[styles.heroLabel, { color: theme.muted }]}>Estimated value</Text>
              <Text
                style={[styles.heroValue, { color: theme.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(market.estimatedValue)}
              </Text>
            </View>

            {/* PRICE RANGE */}
            <SectionTitle>Price range (asking prices)</SectionTitle>
            <Group>
              <View
                accessible
                accessibilityLabel={`Price range. Low ${formatMoney(market.priceRange.low)}, mid ${formatMoney(
                  market.priceRange.mid
                )}, high ${formatMoney(market.priceRange.high)}`}
                style={styles.rangeBlock}
              >
                <RangeBar position={midPosition} />
                <View style={styles.rangeLabels}>
                  <RangeCol label="Low" value={formatMoney(market.priceRange.low)} align="flex-start" />
                  <RangeCol label="Mid" value={formatMoney(market.priceRange.mid)} align="center" />
                  <RangeCol label="High" value={formatMoney(market.priceRange.high)} align="flex-end" />
                </View>
              </View>
            </Group>

            {/* CONFIDENCE + COMPETITION */}
            <SectionTitle>How sure we are</SectionTitle>
            <View style={styles.tilesRow}>
              <View
                accessible
                accessibilityLabel={`Confidence ${market.confidence}`}
                style={[styles.tile, card]}
              >
                <Text style={[styles.tileLabel, { color: theme.muted }]}>Confidence</Text>
                <Text style={[styles.tileValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {market.confidence.charAt(0).toUpperCase() + market.confidence.slice(1)}
                </Text>
                <Text style={[styles.tileHint, { color: theme.muted }]}>in this estimate</Text>
              </View>

              <View
                accessible
                accessibilityLabel={`Competition, ${market.competition} similar listings`}
                style={[styles.tile, card]}
              >
                <Text style={[styles.tileLabel, { color: theme.muted }]}>Competition</Text>
                <Text style={[styles.tileValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {market.competition}
                </Text>
                <Text style={[styles.tileHint, { color: theme.muted }]}>similar listings</Text>
              </View>
            </View>

            {/* AI INSIGHTS */}
            <SectionTitle>Notes</SectionTitle>
            <Group>
              {market.notes.map((tip, i) => (
                <TextBlock key={i} text={tip} divider={i > 0} />
              ))}
            </Group>

            {/* SIMILAR LISTINGS */}
            {market.similarListings.length > 0 ? (
              <>
                <SectionTitle>Comparable listings</SectionTitle>
                <Group>
                  {market.similarListings.map((item, i) => (
                    <ListingRow key={i} item={item} divider={i > 0} />
                  ))}
                </Group>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {/* ACTIONS */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.hairline,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to overview"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold, overflow: "hidden" },
            pressed && styles.pressed,
          ]}
          onPress={() => router.push(`/vehicles/overview/${vehicle.id}`)}
        >
          <GoldFoil />
          <ArrowLeft size={20} weight="bold" color={theme.black} />
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Back to overview</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  contentGrow: { flexGrow: 1 },

  /* HEADER */
  pageTitle: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 2 },

  /* LOADING, ERROR AND NOT-FOUND STATES */
  stateBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stateLoading: { fontSize: 15, lineHeight: 22, marginTop: 16, textAlign: "center" },
  stateTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  stateBody: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },

  /* RECOMMENDED PRICE */
  hero: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  heroLabel: { fontSize: 13 },
  heroValue: {
    fontSize: 40,
    fontWeight: "700",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },

  /* SECTIONS */
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 12 },
  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  textBlock: { padding: 16 },
  textBlockText: { fontSize: 15, lineHeight: 22 },

  /* PRICE RANGE */
  rangeBlock: { padding: 16 },
  rangeWrap: { height: 16, justifyContent: "center" },
  rangeTrack: { height: 6, borderRadius: 3 },
  rangeMarker: {
    position: "absolute",
    top: 0,
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    borderWidth: 3,
  },
  rangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  rangeLabel: { fontSize: 13 },
  rangeValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },

  /* MARKET CONDITIONS */
  tilesRow: { flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    minHeight: 112,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    justifyContent: "space-between",
  },
  tileLabel: { fontSize: 13 },
  tileValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  tileValue: { fontSize: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tileMax: { fontSize: 14, fontVariant: ["tabular-nums"] },
  tileHint: { fontSize: 13 },
  meterTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 4 },

  /* SIMILAR LISTINGS */
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  listingThumb: { width: 64, height: 64, borderRadius: 12 },
  listingThumbEmpty: { alignItems: "center", justifyContent: "center" },
  listingText: { flex: 1, gap: 4 },
  listingTitle: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  listingPrice: { fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] },
  listingUnknown: { fontSize: 14 },

  /* ACTIONS */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },

  pressed: { opacity: 0.7 },
});
