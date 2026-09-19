import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  CalendarCheck,
  CalendarX,
  Car,
  Diamond,
  Fire,
  Heart,
  Lightning,
  MagnifyingGlass,
  Package,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  Stack as StackIcon,
  Tag,
  TrendUp,
  Trophy,
  WarningCircle,
  X,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import {
  compareDescending,
  formatMoney,
  projectedProfit as profitOf,
} from "@/features/vehicles/utils/vehicleStats";
import { useTheme } from "@/styles/ThemeContext";
import type { Theme } from "@/styles/theme";

function describeExpiry(days: number) {
  if (days === 0) return "expires today";
  const n = Math.abs(days);
  const unit = n === 1 ? "day" : "days";
  return days > 0 ? `expires in ${n} ${unit}` : `expired ${n} ${unit} ago`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// "+£700", "-£45.50". A figure that rounds to zero carries no sign.
const signedMoney = (n: number) => {
  const r = round2(n);
  return `${r > 0 ? "+" : ""}${formatMoney(r)}`;
};

// "+15.6%", "-3.0%".
const signedPercent = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "-" : ""}${Math.abs(r).toFixed(1)}%`;
};

// Gain is green, loss is red, break-even is plain text.
const toneColor = (theme: Theme, n: number) => {
  const r = round2(n);
  return r > 0 ? theme.success : r < 0 ? theme.danger : theme.text;
};

// The MOT is valid through the end of its expiry day, so compare calendar
// days in local time rather than the expiry's midnight against the clock.
function motSummary(v: FlipRecord) {
  const motExpiry = v.mot?.motExpiry ?? v.mot?.expiryDate ?? null;

  let expiryDays: number | null = null;
  let isExpired = false;
  let isExpiringSoon = false;

  if (motExpiry) {
    const [y, m, d] = motExpiry.slice(0, 10).split("-").map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round(
      (new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000
    );

    if (!Number.isNaN(days)) {
      expiryDays = days;
      isExpired = days < 0;
      isExpiringSoon = days >= 0 && days <= 30;
    }
  }

  const issues =
    (v.mot?.advisories?.length ?? 0) + (v.mot?.failures?.length ?? 0);
  const motHealth = Math.max(0, 100 - issues * 10);

  // No MOT data means no MOT health to report (not a perfect score).
  const hasMotData = !!motExpiry || issues > 0;

  return { motExpiry, expiryDays, isExpired, isExpiringSoon, motHealth, hasMotData };
}

/* ------------------------------------------------------------------ */
/* Small local components                                             */
/* ------------------------------------------------------------------ */

function FilterChip({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon: PhosphorIcon;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 2, bottom: 2 }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: theme.goldTint, borderColor: theme.gold }
          : { backgroundColor: theme.card, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <Icon
        size={16}
        weight={active ? "fill" : "regular"}
        color={active ? theme.gold : theme.muted}
      />
      <Text
        style={[styles.chipLabel, { color: active ? theme.gold : theme.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Small icon + text pill for one fact about a flip.
function MetaChip({
  Icon,
  label,
  color,
  iconColor,
  filled,
}: {
  Icon?: PhosphorIcon;
  label: string;
  color?: string;
  iconColor?: string;
  filled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.metaChip, { backgroundColor: theme.background }]}>
      {Icon ? (
        <Icon
          size={14}
          weight={filled ? "fill" : "regular"}
          color={iconColor ?? color ?? theme.muted}
        />
      ) : null}
      <Text style={[styles.metaChipText, { color: color ?? theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Metric({ label, value, a11y }: { label: string; value: string; a11y?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.metric} accessible accessibilityLabel={a11y ?? `${label}, ${value}`}>
      <Text style={[styles.metricLabel, { color: theme.muted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.metricValue, { color: theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function Thumb({ uri, Fallback }: { uri: string | null; Fallback: PhosphorIcon }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={styles.thumb}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: theme.background }]}>
      <Fallback size={26} color={theme.muted} />
    </View>
  );
}

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

function FlipRow({
  v,
  isBest,
  onOpen,
  onToggleFavourite,
}: {
  v: FlipRecord;
  isBest: boolean;
  onOpen: () => void;
  onToggleFavourite: () => void;
}) {
  const theme = useTheme();

  const profit = profitOf(v);
  const roi = profit != null && v.buyPrice ? profit / v.buyPrice : null;

  const profitPerDay =
    profit != null && v.timestamp
      ? profit /
        Math.max(1, (Date.now() - new Date(v.timestamp).getTime()) / 86400000)
      : null;

  const thumbnail =
    typeof v.images?.[0] === "string" && v.images[0].trim().length > 0
      ? v.images[0]
      : null;

  const { motExpiry, expiryDays, isExpired, isExpiringSoon, motHealth, hasMotData } =
    motSummary(v);

  const score = v.flipScore ?? 0;
  const scoreColor = score > 75 ? theme.success : score > 50 ? theme.warning : theme.danger;
  const motColor = isExpired ? theme.danger : isExpiringSoon ? theme.warning : undefined;
  const healthColor =
    motHealth > 80 ? theme.success : motHealth > 60 ? theme.warning : theme.danger;

  const profitColor = profit == null ? theme.muted : toneColor(theme, profit);
  const reg = v.mot?.reg ?? null;

  const hasValuation = v.valuation != null;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          profit == null
            ? `${v.title}. Open overview`
            : `${v.title}, ${profit >= 0 ? "profit" : "loss"} of ${formatMoney(
                Math.abs(round2(profit))
              )}. Open overview`
        }
        onPress={onOpen}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.top}>
          <Thumb key={thumbnail ?? "none"} uri={thumbnail} Fallback={v.mot ? Car : Package} />

          <View style={styles.main}>
            <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
              {v.title}
            </Text>

            {reg ? (
              <View style={styles.regRow}>
                <Car size={14} color={theme.muted} />
                <Text style={[styles.reg, { color: theme.muted }]} numberOfLines={1}>
                  {reg}
                </Text>
              </View>
            ) : null}

            <View style={styles.profitRow}>
              <Text
                style={[styles.profit, { color: profitColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {profit == null ? "-" : signedMoney(profit)}
              </Text>

              {roi != null ? (
                <View style={[styles.roiPill, { backgroundColor: theme.background }]}>
                  <Text style={[styles.roiText, { color: toneColor(theme, roi) }]}>
                    ROI {signedPercent(roi * 100)}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.summary, { color: theme.muted }]} numberOfLines={1}>
              Buy {formatMoney(v.buyPrice)} · Sell {formatMoney(v.sellPrice)}
            </Text>
          </View>
        </View>

        <View style={styles.chips}>
          {isBest ? (
            <MetaChip Icon={Trophy} label="Best flip" color={theme.gold} filled />
          ) : null}

          {v.flipScore != null ? (
            <MetaChip Icon={Fire} label={`Score ${score}`} iconColor={scoreColor} filled />
          ) : null}

          {motExpiry ? (
            <MetaChip
              Icon={isExpired ? CalendarX : isExpiringSoon ? WarningCircle : CalendarCheck}
              label={expiryDays != null ? `MOT ${describeExpiry(expiryDays)}` : `MOT ${motExpiry}`}
              color={motColor}
              iconColor={motColor}
            />
          ) : null}

          {hasMotData ? (
            <MetaChip
              Icon={motHealth > 60 ? ShieldCheck : ShieldWarning}
              label={`MOT health ${motHealth}`}
              iconColor={healthColor}
            />
          ) : null}

          {v.aiValuation?.confidence != null ? (
            <MetaChip Icon={Sparkle} label={`AI confidence ${v.aiValuation.confidence}%`} />
          ) : null}

          {v.sellSpeed != null ? <MetaChip Icon={Lightning} label={String(v.sellSpeed)} /> : null}
          {v.rarity != null ? <MetaChip Icon={Diamond} label={String(v.rarity)} /> : null}
          {v.ai?.condition ? <MetaChip Icon={Tag} label={v.ai.condition} /> : null}
        </View>

        <View style={[styles.strip, { borderTopColor: theme.hairline }]}>
          {hasValuation ? (
            <Metric label="Valuation" value={formatMoney(v.valuation)} />
          ) : null}
          {hasValuation ? (
            <Metric
              label="List price"
              value={formatMoney(Math.round((v.valuation as number) * 1.05))}
              a11y={`Suggested listing price, ${formatMoney(Math.round((v.valuation as number) * 1.05))}`}
            />
          ) : null}
          <Metric
            label="Profit / day"
            value={profitPerDay == null ? "-" : signedMoney(profitPerDay)}
          />
        </View>
      </Pressable>

      {/* The favourite button sits beside the summary, not inside it. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={v.favourite ? "Remove from favourites" : "Add to favourites"}
        style={({ pressed }) => [styles.heartBtn, pressed && styles.pressed]}
        onPress={onToggleFavourite}
      >
        <Heart
          size={22}
          weight={v.favourite ? "fill" : "regular"}
          color={v.favourite ? theme.gold : theme.muted}
        />
      </Pressable>
    </View>
  );
}

const Separator = () => <View style={styles.separator} />;

/* ------------------------------------------------------------------ */
/* Screen                                                             */
/* ------------------------------------------------------------------ */

export default function VehiclesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vehicles, toggleFavourite, loaded, loadError } = useVehicleHistory();

  const [search, setSearch] = useState("");
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [showHighScoreOnly, setShowHighScoreOnly] = useState(false);
  const [showUndervaluedOnly, setShowUndervaluedOnly] = useState(false);

  const filtered = useMemo(() => {
    return vehicles
      .filter((v) =>
        v.title.toLowerCase().includes(search.toLowerCase().trim())
      )
      .filter((v) => (showFavouritesOnly ? v.favourite : true))
      .filter((v) => {
        const score = v.flipScore ?? 0;
        return showHighScoreOnly ? score >= 75 : true;
      })
      .filter((v) => {
        if (!showUndervaluedOnly) return true;
        return (v.valuation ?? 0) > (v.buyPrice ?? 0);
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [
    vehicles,
    search,
    showFavouritesOnly,
    showHighScoreOnly,
    showUndervaluedOnly,
  ]);

  // Best flips are the top tenth by profit, and only ones that actually made money.
  const bestFlipIds = useMemo(
    () =>
      new Set(
        [...filtered]
          .sort((a, b) => compareDescending(profitOf(a), profitOf(b)))
          .slice(0, Math.ceil(filtered.length * 0.1))
          .filter((v) => (profitOf(v) ?? 0) > 0)
          .map((v) => v.id)
      ),
    [filtered]
  );

  const query = search.trim();
  const activeFilters = [showFavouritesOnly, showHighScoreOnly, showUndervaluedOnly].filter(
    Boolean
  ).length;
  const isFiltered = activeFilters > 0 || query.length > 0;
  const total = vehicles.length;

  // One calm message for whichever reason the list is empty.
  const renderEmpty = () => {
    if (!loaded) return <StateBlock loading title="Loading your flips" />;

    if (loadError) {
      return <StateBlock warning Icon={WarningCircle} title="Couldn't load your flips" body={loadError} />;
    }

    if (total === 0) {
      return (
        <StateBlock
          Icon={StackIcon}
          title="No flips yet"
          body="Scan an item or add a vehicle and it will show up here."
        />
      );
    }

    if (activeFilters === 0) {
      return (
        <StateBlock
          Icon={MagnifyingGlass}
          title={`No flips match "${query}"`}
          body="Check the spelling, or try a shorter search."
        />
      );
    }

    if (activeFilters === 1 && query.length === 0) {
      if (showFavouritesOnly) {
        return (
          <StateBlock
            Icon={Heart}
            title="No favourites yet"
            body="Tap the heart on a flip and it will be kept here."
          />
        );
      }
      if (showHighScoreOnly) {
        return (
          <StateBlock
            Icon={Fire}
            title="No high-scoring flips"
            body="Flips with a FlipScore of 75 or more will show up here."
          />
        );
      }
      return (
        <StateBlock
          Icon={TrendUp}
          title="Nothing undervalued"
          body="A flip counts as undervalued when its valuation is higher than what you paid."
        />
      );
    }

    return (
      <StateBlock
        Icon={MagnifyingGlass}
        title="No matching flips"
        body="Try a different search, or turn one of the filters off."
      />
    );
  };

  const header = (
    <View style={styles.header}>
      <Text style={[styles.pageTitle, { color: theme.text }]} accessibilityRole="header">
        Your Flips
      </Text>

      {loaded && total > 0 ? (
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          {isFiltered
            ? `${filtered.length} of ${total} ${total === 1 ? "flip" : "flips"}`
            : `${total} ${total === 1 ? "flip" : "flips"}`}
        </Text>
      ) : null}

      {total > 0 ? (
        <>
          {/* SEARCH */}
          <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
            <MagnifyingGlass size={20} color={theme.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by title"
              placeholderTextColor={theme.muted}
              style={[styles.searchInput, { color: theme.text }]}
              accessibilityLabel="Search flips by title"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
                onPress={() => setSearch("")}
              >
                <X size={18} color={theme.muted} />
              </Pressable>
            ) : null}
          </View>

          {/* FILTERS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            <FilterChip
              label="Favourites"
              Icon={Heart}
              active={showFavouritesOnly}
              onPress={() => setShowFavouritesOnly((p) => !p)}
            />
            <FilterChip
              label="High score 75+"
              Icon={Fire}
              active={showHighScoreOnly}
              onPress={() => setShowHighScoreOnly((p) => !p)}
            />
            <FilterChip
              label="Undervalued"
              Icon={TrendUp}
              active={showUndervaluedOnly}
              onPress={() => setShowUndervaluedOnly((p) => !p)}
            />
          </ScrollView>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <FlipRow
            v={item}
            isBest={bestFlipIds.has(item.id)}
            onOpen={() => router.push(`/vehicles/overview/${item.id}`)}
            onToggleFavourite={() => toggleFavourite(item.id)}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={renderEmpty()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  separator: { height: 12 },

  /* HEADER */
  header: { paddingBottom: 16 },
  pageTitle: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 2 },

  search: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: { flex: 1, height: 48, fontSize: 16, paddingVertical: 0 },
  clearBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  chipScroll: { marginHorizontal: -16, marginTop: 12, flexGrow: 0 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipLabel: { fontSize: 14, fontWeight: "600" },

  /* CARD */
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  main: { flex: 1, gap: 2 },
  // Leaves room for the favourite button in the card's corner.
  title: { fontSize: 16, fontWeight: "600", lineHeight: 21, paddingRight: 34 },
  regRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reg: { flexShrink: 1, fontSize: 13, fontVariant: ["tabular-nums"] },
  profitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  profit: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  roiPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roiText: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  summary: { fontSize: 13, fontVariant: ["tabular-nums"] },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  metaChipText: { flexShrink: 1, fontSize: 12, fontWeight: "600" },

  strip: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  metric: { flex: 1 },
  metricLabel: { fontSize: 12 },
  metricValue: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },

  heartBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  /* LOADING, EMPTY AND ERROR STATES */
  stateBox: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
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
  stateLoading: { fontSize: 15, marginTop: 16, textAlign: "center" },
  stateTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  stateBody: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },

  pressed: { opacity: 0.7 },
});
