import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import GoldFoil from "@/components/ui/GoldFoil";
import {
  ArrowsClockwise,
  Car,
  CheckCircle,
  ClockCounterClockwise,
  Info,
  WarningCircle,
  XCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import {
  formatDate,
  motDaysLeft,
  motExpiryOf,
  motExpiryPhrase,
} from "@/features/vehicles/utils/motDates";
import {
  formatMiles,
  formatMoney,
  realisedProfit,
} from "@/features/vehicles/utils/vehicleStats";
import { useTheme } from "@/styles/ThemeContext";
import type { Theme } from "@/styles/theme";

/* HELPERS */

// "+£1,200", "-£45.50", "£0" for nothing, "-" when there is no value.
const formatSigned = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "-";
  const rounded = Math.round(n * 100) / 100;
  if (rounded === 0) return formatMoney(0);
  return `${rounded > 0 ? "+" : "-"}${formatMoney(Math.abs(rounded))}`;
};

// The same bands as the scan result and flip screens.
const bandColour = (theme: Theme, percent: number) =>
  percent >= 70 ? theme.success : percent >= 40 ? theme.warning : theme.danger;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

// Mileage that goes down between tests costs points; fewer than two tests is
// not enough to judge.
const mileageConsistency = (history: { mileage: number }[]) => {
  let score = 80;
  for (let i = 1; i < history.length; i++) {
    if (history[i].mileage < history[i - 1].mileage) score -= 15;
  }
  return Math.max(0, Math.min(100, score));
};

// A year after the expiry date, as "18 Sep 2027". Null when the expiry is unknown.
const nextMotLabel = (daysLeft: number | null) => {
  if (daysLeft == null) return null;
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysLeft + 365);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return formatDate(iso);
};

/* SMALL LOCAL COMPONENTS */
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

function DataRow({
  label,
  value,
  valueColor,
  divider,
}: {
  label: string;
  value: string;
  valueColor?: string;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.dataRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <Text style={[styles.dataLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: valueColor ?? theme.text }]}>{value}</Text>
    </View>
  );
}

// A label with a value on the right and a filled bar underneath.
function MeterBlock({
  label,
  value,
  percent,
  note,
  divider,
}: {
  label: string;
  value: string;
  percent: number;
  note?: string;
  divider?: boolean;
}) {
  const theme = useTheme();
  const safe = Math.max(0, Math.min(100, percent));

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${note ? `. ${note}` : ""}`}
      style={[styles.meterBlock, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <View style={styles.meterHeader}>
        <Text style={[styles.dataLabel, { color: theme.muted }]}>{label}</Text>
        <Text style={[styles.meterValue, { color: theme.text }]}>{value}</Text>
      </View>
      <View style={[styles.meterTrack, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.meterFill,
            { width: `${safe}%`, backgroundColor: bandColour(theme, safe) },
          ]}
        />
      </View>
      {note ? <Text style={[styles.meterNote, { color: theme.muted }]}>{note}</Text> : null}
    </View>
  );
}

// One advisory or failure: an icon and the text the tester wrote.
function IssueRow({
  Icon,
  color,
  text,
  divider,
}: {
  Icon: PhosphorIcon;
  color: string;
  text: string;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.issueRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}>
      <Icon size={20} color={color} />
      <Text style={[styles.issueText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

// Loading, missing and load-error screens: an icon in a circle and a calm line.
function StateView({
  loading,
  Icon,
  iconColor,
  title,
  body,
}: {
  loading?: boolean;
  Icon?: PhosphorIcon;
  iconColor?: string;
  title?: string;
  body: string;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.muted} />
      ) : Icon ? (
        <View style={[styles.stateIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <Icon size={30} color={iconColor ?? theme.muted} />
        </View>
      ) : null}
      {title ? (
        <Text style={[styles.stateTitle, { color: theme.text }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Text style={[styles.stateBody, { color: theme.muted }]}>{body}</Text>
    </View>
  );
}

export default function VehicleOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { vehicles, refreshMot, loaded, loadError } = useVehicleHistory();

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // A refresh can outlive the screen; don't set state once it has gone.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    // Saved vehicles are read from storage after launch; don't call one
    // missing before that has finished.
    if (!loaded) {
      return <StateView loading body="Loading your vehicle" />;
    }

    return (
      <StateView
        Icon={loadError ? WarningCircle : Car}
        iconColor={loadError ? theme.warning : theme.muted}
        title={loadError ? "Couldn't load your vehicles" : "Vehicle not found"}
        body={loadError ?? "It may have been deleted from your list."}
      />
    );
  }

  // Scanned or hand-added items have no MOT data; their details screen handles that.
  if (!vehicle.mot) {
    return <Redirect href={`/vehicles/details/${vehicle.id}`} />;
  }

  const mot = vehicle.mot;

  /* VEHICLE */
  const title =
    [mot.year, mot.make, mot.model]
      .filter((part) => part != null && String(part).trim() !== "")
      .join(" ") || vehicle.title;
  const reg = mot.reg?.trim() ? mot.reg.trim() : null;
  const photo = vehicle.images?.[0] ?? null;

  // Latest mileage
  const latestMileage =
    mot.mileageHistory?.[mot.mileageHistory.length - 1]?.mileage ?? mot.mileage ?? null;

  /* MOT EXPIRY: valid, due within 30 days, or expired */
  const motExpiry = motExpiryOf(vehicle);
  const expiryDays = motDaysLeft(vehicle);
  const isExpired = expiryDays != null && expiryDays < 0;
  const isExpiringSoon = expiryDays != null && expiryDays >= 0 && expiryDays <= 30;

  const motTone =
    expiryDays == null
      ? theme.muted
      : isExpired
      ? theme.danger
      : isExpiringSoon
      ? theme.warning
      : theme.success;
  const MotIcon: PhosphorIcon =
    expiryDays == null ? Info : isExpired ? XCircle : isExpiringSoon ? WarningCircle : CheckCircle;
  const motHeadline = capitalise(motExpiryPhrase(expiryDays));

  /* RECORDED MOT ISSUES: what the record says, not a score (a score said "100" for an expired MOT) */
  const advisories = mot.advisories ?? [];
  const failures = mot.failures ?? [];
  const issues = advisories.length + failures.length;
  const issuesText =
    issues === 0
      ? "None recorded"
      : [
          failures.length > 0 ? plural(failures.length, "failure", "failures") : null,
          advisories.length > 0 ? plural(advisories.length, "advisory", "advisories") : null,
        ]
          .filter(Boolean)
          .join(", ");
  const issuesColor = failures.length > 0 ? theme.danger : advisories.length > 0 ? theme.warning : theme.success;

  /* PROFIT: only once both prices are known */
  const profit = realisedProfit(vehicle);
  const buyPrice = vehicle.buyPrice ?? null;
  const sellPrice = vehicle.sellPrice ?? null;
  const profitColor = profit == null ? theme.muted : profit >= 0 ? theme.success : theme.danger;
  const profitLabel =
    profit == null
      ? "Profit not available"
      : `${profit >= 0 ? "Profit" : "Loss"} of ${formatMoney(Math.abs(profit))}`;
  const roi = profit != null && buyPrice != null && buyPrice > 0 ? (profit / buyPrice) * 100 : null;
  const roiText = roi == null ? "-" : `${roi > 0 ? "+" : ""}${roi.toFixed(1)}%`;
  const roiColor = roi == null ? theme.muted : roi < 0 ? theme.danger : theme.text;

  /* DEAL QUALITY */
  const flipScore =
    typeof vehicle.flipScore === "number" && Number.isFinite(vehicle.flipScore)
      ? Math.max(0, Math.min(100, vehicle.flipScore))
      : null;
  const confidence = vehicle.aiPriceConfidence ?? null;

  /* MOT HISTORY */
  const history = mot.mileageHistory ?? [];
  const historyNewestFirst = [...history].reverse();
  const nextMot = nextMotLabel(expiryDays);
  const consistency = history.length >= 2 ? mileageConsistency(history) : null;
  const hasHistoryRows = history.length > 0 || nextMot != null;

  // Refreshing looks up the registration again; a failed lookup is shown under
  // the button that started it.
  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const result = await refreshMot(vehicle.id);
      if (!mounted.current) return;
      if (!result.success) {
        setRefreshError(
          typeof result.error === "string"
            ? result.error
            : "Couldn't refresh the MOT data. Try again."
        );
      }
    } catch {
      if (mounted.current) setRefreshError("Couldn't refresh the MOT data. Try again.");
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  };

  /* ============================
     RENDER
  ============================ */
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <View style={styles.heroRow}>
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={styles.heroThumb}
                resizeMode="cover"
                accessibilityLabel="Vehicle photo"
              />
            ) : (
              <View
                accessibilityLabel="No photo saved"
                style={[styles.heroThumb, styles.heroPlaceholder, { backgroundColor: theme.background }]}
              >
                <Car size={32} color={theme.muted} />
              </View>
            )}

            <View style={styles.heroText}>
              <Text style={[styles.heroTitle, { color: theme.text }]} accessibilityRole="header">
                {title}
              </Text>
              {reg ? (
                <View
                  accessible
                  accessibilityLabel={`Registration ${reg}`}
                  style={[styles.regPill, { backgroundColor: theme.background, borderColor: theme.hairline }]}
                >
                  <Text style={[styles.regText, { color: theme.text }]}>{reg}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* MOT STATUS */}
        <SectionTitle>MOT</SectionTitle>
        <Group>
          <View
            accessible
            accessibilityLabel={`MOT ${motExpiryPhrase(expiryDays)}`}
            style={styles.statusHeader}
          >
            <View style={[styles.statusIcon, { backgroundColor: theme.background }]}>
              <MotIcon size={26} color={motTone} weight="fill" />
            </View>
            <View style={styles.statusText}>
              <Text style={[styles.smallLabel, { color: theme.muted }]}>Current MOT</Text>
              <Text style={[styles.statusHeadline, { color: motTone }]}>{motHeadline}</Text>
            </View>
          </View>

          <DataRow label="Expiry date" value={motExpiry ? formatDate(motExpiry) : "-"} divider />
          <DataRow label="MOT status" value={mot.motStatus ?? "Unknown"} divider />
          <DataRow label="Tax status" value={mot.taxStatus ?? "Unknown"} divider />
          <DataRow label="Mileage" value={formatMiles(latestMileage)} divider />
          <DataRow label="Recorded issues" value={issuesText} valueColor={issuesColor} divider />
        </Group>

        {/* PROFIT SUMMARY */}
        <SectionTitle>Profit</SectionTitle>
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <View style={styles.summaryTop}>
            <View accessible accessibilityLabel={profitLabel} style={styles.summaryMain}>
              <Text style={[styles.smallLabel, { color: theme.muted }]}>Profit</Text>
              <Text
                style={[styles.profitFigure, { color: profitColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatSigned(profit)}
              </Text>
            </View>

            <View
              accessible
              accessibilityLabel={
                roi != null
                  ? `Return on investment ${roi.toFixed(1)} percent`
                  : "Return on investment not available"
              }
              style={styles.summaryRoi}
            >
              <Text style={[styles.smallLabel, { color: theme.muted }]}>ROI</Text>
              <Text style={[styles.roiFigure, { color: roiColor }]}>{roiText}</Text>
            </View>
          </View>

          <DataRow label="Buy" value={formatMoney(buyPrice)} divider />
          <DataRow label="Sell" value={formatMoney(sellPrice)} divider />
        </View>
        {profit == null ? (
          <Text style={[styles.note, { color: theme.muted }]}>
            Add a buy and a sell price to see this vehicle's profit.
          </Text>
        ) : null}

        {/* DEAL QUALITY */}
        {flipScore != null || confidence != null ? (
          <>
            <SectionTitle>Deal quality</SectionTitle>
            <Group>
              {flipScore != null ? (
                <MeterBlock label="Flip score" value={`${Math.round(flipScore)}/100`} percent={flipScore} />
              ) : null}
              {confidence != null ? (
                <MeterBlock
                  label="Confidence"
                  value={`${confidence}/100`}
                  percent={confidence}
                  note="Higher confidence means stronger deal stability and lower risk."
                  divider={flipScore != null}
                />
              ) : null}
            </Group>
          </>
        ) : null}

        {/* MOT HISTORY */}
        <SectionTitle>MOT history</SectionTitle>
        <Group>
          {consistency != null ? (
            <MeterBlock
              label="Mileage consistency"
              value={`${consistency}/100`}
              percent={consistency}
              note="Based on mileage across MOT tests."
            />
          ) : null}
          {nextMot ? (
            <DataRow label="Next MOT expected" value={nextMot} divider={consistency != null} />
          ) : null}
          {historyNewestFirst.map((entry, i) => (
            <DataRow
              key={`${entry.date}-${i}`}
              label={formatDate(entry.date)}
              value={formatMiles(entry.mileage)}
              divider={i > 0 || consistency != null || nextMot != null}
            />
          ))}
          {!hasHistoryRows ? (
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              No MOT test history has been saved for this vehicle yet.
            </Text>
          ) : null}
        </Group>

        {/* FAILURES */}
        {failures.length > 0 ? (
          <>
            <SectionTitle>Failures</SectionTitle>
            <Group>
              {failures.map((text, i) => (
                <IssueRow key={`f-${i}`} Icon={XCircle} color={theme.danger} text={text} divider={i > 0} />
              ))}
            </Group>
          </>
        ) : null}

        {/* ADVISORIES */}
        {advisories.length > 0 ? (
          <>
            <SectionTitle>Advisories</SectionTitle>
            <Group>
              {advisories.map((text, i) => (
                <IssueRow
                  key={`a-${i}`}
                  Icon={WarningCircle}
                  color={theme.warning}
                  text={text}
                  divider={i > 0}
                />
              ))}
            </Group>
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
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        {refreshError ? (
          <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <WarningCircle size={18} color={theme.danger} />
            <Text style={[styles.errorText, { color: theme.danger }]}>{refreshError}</Text>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View MOT timeline"
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.hairline, backgroundColor: theme.card },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push(`/mot/${vehicle.id}`)}
          >
            <ClockCounterClockwise size={18} color={theme.text} />
            <Text style={[styles.secondaryLabel, { color: theme.text }]} numberOfLines={1}>
              MOT timeline
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh MOT data"
            accessibilityState={{ disabled: refreshing, busy: refreshing }}
            disabled={refreshing}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.gold, overflow: "hidden" },
              pressed && styles.pressed,
            ]}
            onPress={onRefresh}
          >
            <GoldFoil />
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.black} />
            ) : (
              <ArrowsClockwise size={18} color={theme.black} weight="bold" />
            )}
            <Text style={[styles.primaryLabel, { color: theme.black }]} numberOfLines={1}>
              {refreshing ? "Refreshing" : "Refresh MOT"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  /* LOADING / NOT FOUND */
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
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
  stateTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },

  /* HERO */
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroThumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
  },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    flex: 1,
    gap: 8,
    alignItems: "flex-start",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },
  regPill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  regText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  /* SECTIONS */
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 12,
  },
  group: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  smallLabel: {
    fontSize: 13,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    padding: 16,
  },

  /* ROWS */
  dataRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  dataLabel: {
    fontSize: 15,
  },
  dataValue: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  issueRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  issueText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },

  /* METERS */
  meterBlock: {
    padding: 16,
  },
  meterHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
  },
  meterValue: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  meterTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 10,
  },
  meterFill: {
    height: "100%",
    borderRadius: 4,
  },
  meterNote: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },

  /* MOT STATUS */
  statusHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    flex: 1,
  },
  statusHeadline: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
    marginTop: 2,
  },

  /* PROFIT SUMMARY */
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    padding: 16,
  },
  summaryMain: {
    flex: 1,
  },
  summaryRoi: {
    alignItems: "flex-end",
  },
  profitFigure: {
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 42,
    fontVariant: ["tabular-nums"],
  },
  roiFigure: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
  },

  /* ACTIONS */
  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  primaryButton: {
    flex: 1.2,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },

  pressed: {
    opacity: 0.75,
  },
});
