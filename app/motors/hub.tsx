import React from "react";
import GoldFoil from "@/components/ui/GoldFoil";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Car,
  CaretRight,
  ChartLineUp,
  CheckCircle,
  CurrencyGbp,
  List,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Star,
  Storefront,
  Tag,
  TrendUp,
  Trophy,
  Warning,
  WarningCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import {
  motAttentionList,
  motExpiryPhrase,
} from "@/features/vehicles/utils/motDates";
import {
  barPercent,
  formatMoney,
  formatScore,
  monthlyProfit,
  realisedProfit,
  summariseVehicles,
} from "@/features/vehicles/utils/vehicleStats";

type AppTheme = ReturnType<typeof useTheme>;

// Profit and loss always carry a sign: "+£300" / "-£45", or "-" when unknown.
function signedMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}

function profitColor(theme: AppTheme, value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return theme.muted;
  return value > 0 ? theme.success : value < 0 ? theme.danger : theme.text;
}

export default function MotorsHub() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { vehicles: records, loaded, loadError } = useVehicleHistory();

  // Scans share the store with vehicles but are not vehicles, so only records
  // with MOT data are counted or listed here.
  const { vehicles, total: totalFlips, totalProfit, avgScore, ranked } =
    summariseVehicles(records);

  const recentVehicles = [...vehicles]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 3);

  const bestFlip: FlipRecord | null = ranked[0]?.vehicle ?? null;

  const motAttention = motAttentionList(vehicles);

  const highScore = vehicles
    .filter((v: FlipRecord) => (v.flipScore ?? 0) >= 75)
    .slice(0, 3);

  const undervalued = vehicles
    .filter((v: FlipRecord) => {
      const valuation = v.valuation ?? 0;
      const buy = v.buyPrice ?? 0;
      return valuation - buy >= 1000;
    })
    .slice(0, 3);

  const topPerformers = ranked.slice(0, 3);
  const monthly = monthlyProfit(vehicles);
  const maxMonthly = Math.max(...monthly.map((entry) => entry.profit), 1);

  const openVehicle = (id: string) => router.push(`/vehicles/overview/${id}`);

  // Saved vehicles are read from storage after launch; do not call the list
  // empty before that has finished.
  if (!loaded) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.muted} />
        <Text style={[styles.stateBody, { color: theme.muted }]}>Loading your vehicles</Text>
      </View>
    );
  }

  const hasVehicles = vehicles.length > 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Profit, flip scores and MOT dates across your vehicles.
      </Text>

      {/* STATS */}
      {hasVehicles ? (
        <View style={styles.statsRow}>
          <StatTile Icon={Car} label="Vehicles" value={String(totalFlips)} />
          <StatTile
            Icon={CurrencyGbp}
            label="Profit"
            value={signedMoney(totalProfit)}
            color={profitColor(theme, totalProfit)}
          />
          <StatTile
            Icon={Star}
            label="Avg score"
            value={formatScore(avgScore)}
          />
        </View>
      ) : null}

      {/* PRIMARY ACTIONS */}
      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New flip"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold, overflow: "hidden" },
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/vehicles/new")}
        >
          <GoldFoil />
          <Plus size={20} color={theme.black} weight="bold" />
          <Text style={[styles.primaryLabel, { color: theme.black }]}>New flip</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="MOT lookup"
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: theme.hairline, backgroundColor: theme.card },
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/vehicles/mot-lookup")}
        >
          <MagnifyingGlass size={20} color={theme.text} />
          <Text style={[styles.secondaryLabel, { color: theme.text }]}>MOT lookup</Text>
        </Pressable>
      </View>

      {!hasVehicles ? (
        <View style={styles.emptyBox}>
          <View
            style={[styles.emptyIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
          >
            {loadError ? (
              <Warning size={30} color={theme.warning} />
            ) : (
              <Car size={30} color={theme.muted} />
            )}
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {loadError ? "Couldn't load your vehicles" : "No vehicles yet"}
          </Text>
          <Text style={[styles.emptyBody, { color: theme.muted }]}>
            {loadError ?? "Add your first vehicle to track its MOT, profit and flip score."}
          </Text>
        </View>
      ) : (
        <>
          {/* SPOTLIGHT */}
          <SectionTitle>Spotlight</SectionTitle>
          {bestFlip ? (
            <Group>
              <Row
                Icon={Trophy}
                iconColor={theme.gold}
                title={bestFlip.title}
                subtitle="Your top performer"
              />
            </Group>
          ) : (
            <EmptyCard
              text="No completed flips yet. Add a buy and sell price to a vehicle to see it here."
            />
          )}

          {/* TOP PERFORMERS */}
          <SectionTitle>Top performers</SectionTitle>
          {topPerformers.length === 0 ? (
            <EmptyCard text="No completed flips yet." />
          ) : (
            <Group>
              {topPerformers.map(({ vehicle: v, profit }, i) => (
                <Row
                  key={v.id}
                  Icon={Trophy}
                  title={v.title}
                  label={`${v.title}. Profit ${signedMoney(profit)}`}
                  trailing={<ProfitFigure value={profit} />}
                  onPress={() => openVehicle(v.id)}
                  divider={i > 0}
                />
              ))}
            </Group>
          )}

          {/* MONTHLY PROFIT */}
          <SectionTitle>Monthly profit</SectionTitle>
          {monthly.length === 0 ? (
            <EmptyCard Icon={ChartLineUp} text="No sales recorded yet." />
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
              {monthly.map(({ key, label, profit }, i) => (
                <View
                  key={key}
                  accessible
                  accessibilityLabel={`${label}: ${signedMoney(profit)}`}
                  style={i > 0 && styles.monthGap}
                >
                  <View style={styles.monthHeader}>
                    <Text style={[styles.monthLabel, { color: theme.muted }]}>{label}</Text>
                    <Text
                      style={[
                        styles.monthValue,
                        { color: profit >= 0 ? theme.success : theme.danger },
                      ]}
                    >
                      {signedMoney(profit)}
                    </Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: theme.background }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${barPercent(profit, maxMonthly)}%`,
                          backgroundColor: profit >= 0 ? theme.success : theme.danger,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* RECENT VEHICLES */}
          <SectionTitle>Recent vehicles</SectionTitle>
          <VehicleList
            items={recentVehicles}
            Icon={Car}
            emptyText="No vehicles yet."
            onOpen={openVehicle}
          />

          {/* MOT ATTENTION (expired or due within 30 days, most urgent first) */}
          <SectionTitle
            meta={
              motAttention.length > 0
                ? `${motAttention.length} ${motAttention.length === 1 ? "vehicle" : "vehicles"}`
                : undefined
            }
          >
            MOT attention
          </SectionTitle>
          {motAttention.length === 0 ? (
            <EmptyCard Icon={CheckCircle} iconColor={theme.success} text="No MOT issues." />
          ) : (
            <Group>
              {motAttention.map(({ vehicle: v, days }, i) => {
                const color = days < 0 ? theme.danger : theme.warning;
                return (
                  <Row
                    key={v.id}
                    Icon={WarningCircle}
                    iconColor={color}
                    title={v.title}
                    subtitle={`MOT ${motExpiryPhrase(days)}`}
                    subtitleColor={color}
                    onPress={() => openVehicle(v.id)}
                    divider={i > 0}
                  />
                );
              })}
            </Group>
          )}

          {/* HIGH SCORE */}
          <SectionTitle>High score vehicles</SectionTitle>
          <VehicleList
            items={highScore}
            Icon={Star}
            emptyText="No vehicles scoring 75 or more yet."
            onOpen={openVehicle}
          />

          {/* UNDERVALUED */}
          <SectionTitle>Undervalued vehicles</SectionTitle>
          <VehicleList
            items={undervalued}
            Icon={TrendUp}
            emptyText="No vehicles valued £1,000 or more above their buy price."
            onOpen={openVehicle}
          />
        </>
      )}

      {/* MORE */}
      <SectionTitle>More</SectionTitle>
      <Group>
        <Row Icon={List} title="Vehicle list" onPress={() => router.push("/vehicles/list")} />
        <Row
          Icon={PencilSimple}
          title="Edit flip"
          onPress={() => router.push("/vehicles/edit-lookup")}
          divider
        />
        <Row
          Icon={Storefront}
          title="Marketplace"
          onPress={() => router.push("/marketplace")}
          divider
        />
        <Row
          Icon={Tag}
          title="Create listing"
          // Straight into the form with Motors chosen, rather than a screen
          // whose only job is one more button.
          onPress={() => router.push("/marketplace/create/new?category=motors")}
          divider
        />
      </Group>
    </ScrollView>
  );
}

/* SMALL LOCAL COMPONENTS */

function StatTile({
  Icon,
  label,
  value,
  color,
}: {
  Icon: PhosphorIcon;
  label: string;
  value: string;
  color?: string;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.statTile, { backgroundColor: theme.card, borderColor: theme.hairline }]}
    >
      <Icon size={18} color={theme.muted} />
      <Text
        style={[styles.statValue, { color: color ?? theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function SectionTitle({ children, meta }: { children: string; meta?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
        {children}
      </Text>
      {meta ? <Text style={[styles.sectionMeta, { color: theme.muted }]}>{meta}</Text> : null}
    </View>
  );
}

// A card that holds rows; the rows inside are split by hairlines.
function Group({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      {children}
    </View>
  );
}

// A calm one-line message for a section with nothing in it yet.
function EmptyCard({
  text,
  Icon,
  iconColor,
}: {
  text: string;
  Icon?: PhosphorIcon;
  iconColor?: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.emptyCard,
        Icon ? styles.emptyRow : null,
        { backgroundColor: theme.card, borderColor: theme.hairline },
      ]}
    >
      {Icon ? <Icon size={20} color={iconColor ?? theme.muted} /> : null}
      <Text style={[styles.emptyText, { color: theme.muted }]}>{text}</Text>
    </View>
  );
}

// An icon, a title, an optional second line and a chevron. With no onPress it
// is a plain (non-tappable) row.
function Row({
  Icon,
  iconColor,
  title,
  subtitle,
  subtitleColor,
  label,
  trailing,
  onPress,
  divider,
}: {
  Icon?: PhosphorIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  subtitleColor?: string;
  label?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  divider?: boolean;
}) {
  const theme = useTheme();

  const dividerStyle = divider
    ? { borderTopWidth: 1, borderTopColor: theme.hairline }
    : null;

  const body = (
    <>
      {Icon ? <Icon size={22} color={iconColor ?? theme.muted} /> : null}

      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.rowSubtitle, { color: subtitleColor ?? theme.muted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}
      {onPress ? <CaretRight size={16} color={theme.muted} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        style={[styles.row, dividerStyle]}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? (subtitle ? `${title}. ${subtitle}` : title)}
      onPress={onPress}
      style={({ pressed }) => [styles.row, dividerStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

// Profit on the right of a row, with its sign and colour.
function ProfitFigure({ value }: { value: number | null }) {
  const theme = useTheme();

  return (
    <View style={styles.figure}>
      <Text style={[styles.figureValue, { color: profitColor(theme, value) }]}>
        {signedMoney(value)}
      </Text>
      <Text style={[styles.figureLabel, { color: theme.muted }]}>Profit</Text>
    </View>
  );
}

// Up to three vehicles, each with its flip score and profit.
function VehicleList({
  items,
  Icon,
  emptyText,
  onOpen,
}: {
  items: FlipRecord[];
  Icon: PhosphorIcon;
  emptyText: string;
  onOpen: (id: string) => void;
}) {
  if (items.length === 0) return <EmptyCard text={emptyText} />;

  return (
    <Group>
      {items.map((v: FlipRecord, i) => {
        const profit = realisedProfit(v);
        return (
          <Row
            key={v.id}
            Icon={Icon}
            title={v.title}
            subtitle={`Score ${formatScore(v.flipScore)}`}
            label={`${v.title}. Score ${formatScore(v.flipScore)}. Profit ${signedMoney(profit)}`}
            trailing={<ProfitFigure value={profit} />}
            onPress={() => onOpen(v.id)}
            divider={i > 0}
          />
        );
      })}
    </Group>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
  },

  subtitle: { fontSize: 14 },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statLabel: { fontSize: 12 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryLabel: { fontSize: 16, fontWeight: "600" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 28,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", flexShrink: 1 },
  sectionMeta: { fontSize: 13 },

  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 13, marginTop: 2 },

  figure: { alignItems: "flex-end", flexShrink: 0 },
  figureValue: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  figureLabel: { fontSize: 12, marginTop: 1 },

  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },

  monthGap: { marginTop: 14 },
  monthHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  monthLabel: { fontSize: 13 },
  monthValue: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 6 },
  fill: { height: "100%", borderRadius: 4 },

  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 8,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },

  pressed: { opacity: 0.7 },
});
