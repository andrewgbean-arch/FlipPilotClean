import React, { useEffect, useState } from "react";
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
import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";

type MarketResult = {
  priceRange: { low: number; mid: number; high: number };
  demandScore: number;
  competition: number;
  recommendedPrice: number;
  insights: string[];
  similarListings: { title: string; price: number | null; image: string | null }[];
};

function labelFor(vehicle: any) {
  return vehicle.mot?.make && vehicle.mot?.model
    ? `${vehicle.mot.make} ${vehicle.mot.model}`
    : vehicle.title ?? "This vehicle";
}

function mapItem(item: any, fallbackTitle: string) {
  const price =
    typeof item?.extracted_price === "number"
      ? item.extracted_price
      : item?.price
      ? parseFloat(String(item.price).replace(/[^0-9.]/g, ""))
      : null;

  return {
    title: item?.title ?? fallbackTitle,
    price: Number.isFinite(price) ? price : null,
    image: item?.thumbnail ?? null,
  };
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
      setLoading(true);
      setError(null);

      try {
        // The free-scan cap needs to know which phone is asking.
        const deviceId = await getDeviceId();
        const res = await fetch(
          `${BASE_URL}/search?q=${encodeURIComponent(label)}&deviceId=${encodeURIComponent(deviceId)}`
        );
        const data = await res.json();

        if (cancelled) return;

        if (data.error) {
          setError(
            typeof data.error === "string"
              ? data.error
              : "Couldn't get market data for this vehicle."
          );
          return;
        }

        const m = data.market ?? {};
        const base = m.average ?? vehicle.valuation ?? m.smartPrice ?? 0;

        const items = [...(data.ebayItems ?? []), ...(data.googleItems ?? [])].slice(0, 2);

        // With no price to work from, every figure below would read as a real £0.
        if (!(base > 0)) {
          setError("No market prices found for this vehicle yet.");
          return;
        }

        setMarket({
          priceRange: {
            low: Math.round(m.lowest ?? m.googlePriceMin ?? base * 0.85),
            mid: Math.round(base),
            high: Math.round(m.highest ?? m.googlePriceMax ?? base * 1.15),
          },
          demandScore: Math.round(m.demandScore ?? 0),
          competition: m.soldCount ?? items.length,
          recommendedPrice: Math.round(data.pricing?.recommendedSellPrice ?? base),
          insights: [
            data.insights,
            `Based on ${m.soldCount ?? 0} real sold/listed matches found just now.`,
            `Demand score: ${Math.round(m.demandScore ?? 0)}/100.`,
          ].filter(Boolean),
          similarListings: items.map((item) => mapItem(item, label)),
        });
      } catch (err) {
        if (!cancelled) setError("Couldn't reach the market lookup service.");
      } finally {
        if (!cancelled) setLoading(false);
      }
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

  // The same bands as the scan result screen.
  const demand = market ? Math.min(100, Math.max(0, market.demandScore)) : 0;
  const demandColor =
    demand >= 70 ? theme.success : demand >= 40 ? theme.warning : theme.danger;

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
          Live prices for {label}
        </Text>

        {loading ? (
          <StateBlock loading title="Checking eBay and Google for real prices" />
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
              accessibilityLabel={`Recommended listing price ${formatMoney(market.recommendedPrice)}`}
              style={[styles.hero, card]}
            >
              <Text style={[styles.heroLabel, { color: theme.muted }]}>Recommended listing price</Text>
              <Text
                style={[styles.heroValue, { color: theme.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(market.recommendedPrice)}
              </Text>
            </View>

            {/* PRICE RANGE */}
            <SectionTitle>Price range</SectionTitle>
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

            {/* DEMAND + COMPETITION */}
            <SectionTitle>Market conditions</SectionTitle>
            <View style={styles.tilesRow}>
              <View
                accessible
                accessibilityLabel={`Demand score ${market.demandScore} out of 100`}
                style={[styles.tile, card]}
              >
                <Text style={[styles.tileLabel, { color: theme.muted }]}>Demand score</Text>
                <View style={styles.tileValueRow}>
                  <Text style={[styles.tileValue, { color: theme.text }]}>{market.demandScore}</Text>
                  <Text style={[styles.tileMax, { color: theme.muted }]}>/ 100</Text>
                </View>
                <View style={[styles.meterTrack, { backgroundColor: theme.background }]}>
                  <View
                    style={[
                      styles.meterFill,
                      { width: `${demand}%`, backgroundColor: demandColor },
                    ]}
                  />
                </View>
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
            <SectionTitle>AI insights</SectionTitle>
            <Group>
              {market.insights.map((tip, i) => (
                <TextBlock key={i} text={tip} divider={i > 0} />
              ))}
            </Group>

            {/* SIMILAR LISTINGS */}
            {market.similarListings.length > 0 ? (
              <>
                <SectionTitle>Similar listings</SectionTitle>
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
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={() => router.push(`/vehicles/overview/${vehicle.id}`)}
        >
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
