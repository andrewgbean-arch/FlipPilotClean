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
  ChartBar,
  Car,
  MagnifyingGlass,
  Package,
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

type SortMode = "recent" | "valuation" | "profit" | "roi" | "score";

const SORTS: { mode: SortMode; label: string }[] = [
  { mode: "recent", label: "Recent" },
  { mode: "valuation", label: "Valuation" },
  { mode: "profit", label: "Profit" },
  { mode: "roi", label: "ROI" },
  { mode: "score", label: "FlipScore" },
];

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

export default function AnalyticsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { vehicles, loaded, loadError } = useVehicleHistory();

  return (
    <AnalyticsScreenContent
      vehicles={vehicles}
      router={router}
      theme={theme}
      loaded={loaded}
      loadError={loadError}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Small local components                                             */
/* ------------------------------------------------------------------ */

function Chip({
  label,
  Icon,
  active,
  onPress,
}: {
  label: string;
  Icon?: PhosphorIcon;
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
      {Icon ? (
        <Icon
          size={16}
          weight={active ? "fill" : "regular"}
          color={active ? theme.gold : theme.muted}
        />
      ) : null}
      <Text
        style={[styles.chipLabel, { color: active ? theme.gold : theme.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Metric({
  label,
  value,
  color,
  a11y,
}: {
  label: string;
  value: string;
  color?: string;
  a11y?: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.metric} accessible accessibilityLabel={a11y ?? `${label}, ${value}`}>
      <Text style={[styles.metricLabel, { color: theme.muted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.metricValue, { color: color ?? theme.text }]}
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
      <Fallback size={22} color={theme.muted} />
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

function AnalyticsRow({
  v,
  isBest,
  onOpen,
}: {
  v: FlipRecord;
  isBest: boolean;
  onOpen: () => void;
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

  const suggested =
    v.valuation != null ? formatMoney(Math.round(v.valuation * 1.05)) : null;

  const extras: string[] = [];
  if (v.aiValuation?.confidence != null) {
    extras.push(`AI confidence ${v.aiValuation.confidence}%`);
  }
  if (suggested) extras.push(`Suggested listing ${suggested}`);

  return (
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
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.top}>
        <Thumb key={thumbnail ?? "none"} uri={thumbnail} Fallback={v.mot ? Car : Package} />

        <View style={styles.main}>
          <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
            {v.title}
          </Text>

          {isBest ? (
            <View style={[styles.bestChip, { backgroundColor: theme.background }]}>
              <Trophy size={14} weight="fill" color={theme.gold} />
              <Text style={[styles.bestText, { color: theme.gold }]}>Best flip</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.strip, { borderTopColor: theme.hairline }]}>
        <Metric
          label="Profit"
          value={profit == null ? "-" : signedMoney(profit)}
          color={profit == null ? undefined : toneColor(theme, profit)}
        />
        <Metric
          label="ROI"
          value={roi != null ? signedPercent(roi * 100) : "-"}
          color={roi != null ? toneColor(theme, roi) : undefined}
        />
        <Metric
          label="Per day"
          value={profitPerDay == null ? "-" : signedMoney(profitPerDay)}
          a11y={
            profitPerDay == null ? undefined : `Profit per day, ${signedMoney(profitPerDay)}`
          }
        />
        <Metric label="Valuation" value={formatMoney(v.valuation)} />
      </View>

      {extras.length > 0 ? (
        <Text style={[styles.extras, { color: theme.muted }]}>{extras.join(" · ")}</Text>
      ) : null}
    </Pressable>
  );
}

const Separator = () => <View style={styles.separator} />;

/* ------------------------------------------------------------------ */
/* Screen                                                             */
/* ------------------------------------------------------------------ */

function AnalyticsScreenContent({
  vehicles,
  router,
  theme,
  loaded,
  loadError,
}: {
  vehicles: ReturnType<typeof useVehicleHistory>["vehicles"];
  router: ReturnType<typeof useRouter>;
  theme: Theme;
  loaded: boolean;
  loadError: string | null;
}) {
  const insets = useSafeAreaInsets();

  // Original screen logic
  const [search, setSearch] = useState("");
  const [showUndervaluedOnly, setShowUndervaluedOnly] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const filtered = useMemo(() => {
    let list = vehicles
      .filter((v) =>
        v.title.toLowerCase().includes(search.toLowerCase().trim())
      )
      .filter((v) => {
        if (!showUndervaluedOnly) return true;
        return (v.valuation ?? 0) > (v.buyPrice ?? 0);
      });

    list = [...list].sort((a, b) => {
      const profitA = profitOf(a);
      const profitB = profitOf(b);

      const roiA = profitA != null && a.buyPrice ? profitA / a.buyPrice : null;
      const roiB = profitB != null && b.buyPrice ? profitB / b.buyPrice : null;

      switch (sortMode) {
        case "valuation":
          return (b.valuation ?? 0) - (a.valuation ?? 0);
        case "profit":
          return compareDescending(profitA, profitB);
        case "roi":
          return compareDescending(roiA, roiB);
        case "score":
          return (b.flipScore ?? 0) - (a.flipScore ?? 0);
        default:
          return b.timestamp.localeCompare(a.timestamp);
      }
    });

    return list;
  }, [vehicles, search, showUndervaluedOnly, sortMode]);

  // Best flips are the top tenth by profit, and only ones that actually made money.
  const bestFlipIds = useMemo(() => {
    return new Set(
      [...filtered]
        .sort((a, b) => compareDescending(profitOf(a), profitOf(b)))
        .slice(0, Math.ceil(filtered.length * 0.1))
        .filter((v) => (profitOf(v) ?? 0) > 0)
        .map((v) => v.id)
    );
  }, [filtered]);

  // Headline figures for whatever is currently shown.
  const summary = useMemo(() => {
    const count = filtered.length;
    let total = 0;
    let known = 0;
    const rois: number[] = [];
    for (const v of filtered) {
      const profit = profitOf(v);
      if (profit == null) continue;
      total += profit;
      known += 1;
      if (v.buyPrice) rois.push(profit / v.buyPrice);
    }
    const avgRoi =
      rois.length > 0 ? (rois.reduce((sum, r) => sum + r, 0) / rois.length) * 100 : null;

    return { count, total, avgRoi, avgProfit: known > 0 ? total / known : 0 };
  }, [filtered]);

  const query = search.trim();
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
          Icon={ChartBar}
          title="Nothing to analyse yet"
          body="Save a flip and its numbers will show up here."
        />
      );
    }

    if (!showUndervaluedOnly) {
      return (
        <StateBlock
          Icon={MagnifyingGlass}
          title={`No flips match "${query}"`}
          body="Check the spelling, or try a shorter search."
        />
      );
    }

    if (query.length === 0) {
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
        body="Try a different search, or turn the filter off."
      />
    );
  };

  const header = (
    <View style={styles.header}>
      <Text style={[styles.pageTitle, { color: theme.text }]} accessibilityRole="header">
        Analytics
      </Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Compare how your flips are performing
      </Text>

      {loaded && summary.count > 0 ? (
        <View style={[styles.hero, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <Text style={[styles.heroLabel, { color: theme.muted }]}>Total profit</Text>
          <Text
            style={[styles.heroValue, { color: toneColor(theme, summary.total) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={`Total ${summary.total < 0 ? "loss" : "profit"} of ${formatMoney(
              Math.abs(round2(summary.total))
            )}`}
          >
            {signedMoney(summary.total)}
          </Text>

          <View style={[styles.heroStats, { borderTopColor: theme.hairline }]}>
            <Metric label="Flips" value={String(summary.count)} />
            <Metric
              label="Avg ROI"
              value={summary.avgRoi != null ? signedPercent(summary.avgRoi) : "-"}
              color={summary.avgRoi != null ? toneColor(theme, summary.avgRoi) : undefined}
            />
            <Metric
              label="Avg profit"
              value={signedMoney(summary.avgProfit)}
              color={toneColor(theme, summary.avgProfit)}
            />
          </View>
        </View>
      ) : null}

      {total > 0 ? (
        <>
          {/* SEARCH */}
          <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
            <MagnifyingGlass size={20} color={theme.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search flips"
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

          {/* FILTER */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label="Undervalued"
              Icon={TrendUp}
              active={showUndervaluedOnly}
              onPress={() => setShowUndervaluedOnly((p) => !p)}
            />
          </ScrollView>

          {/* SORT */}
          <Text style={[styles.sortLabel, { color: theme.muted }]}>Sort by</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.sortScroll}
            contentContainerStyle={styles.chipRow}
          >
            {SORTS.map(({ mode, label }) => (
              <Chip
                key={mode}
                label={label}
                active={sortMode === mode}
                onPress={() => setSortMode(mode)}
              />
            ))}
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
          <AnalyticsRow
            v={item}
            isBest={bestFlipIds.has(item.id)}
            onOpen={() => router.push(`/vehicles/overview/${item.id}`)}
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

  /* SUMMARY */
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
  heroStats: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },

  /* SEARCH, FILTER, SORT */
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
  sortScroll: { marginHorizontal: -16, marginTop: 8, flexGrow: 0 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  sortLabel: { fontSize: 13, fontWeight: "600", marginTop: 16 },
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
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  main: { flex: 1, gap: 6 },
  title: { fontSize: 16, fontWeight: "600", lineHeight: 21 },
  bestChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  bestText: { fontSize: 12, fontWeight: "600" },

  strip: {
    flexDirection: "row",
    gap: 8,
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
  extras: { fontSize: 13, marginTop: 12 },

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
