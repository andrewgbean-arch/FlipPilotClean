import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle, ClockCounterClockwise, Info, Trash, Warning, WarningCircle, XCircle } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/styles/ThemeContext";
import {
  daysUntilDate,
  formatDate,
  motExpiryPhrase,
} from "@/features/vehicles/utils/motDates";
import { formatMiles } from "@/features/vehicles/utils/vehicleStats";
import { parseMotTests, type MotTestEntry } from "@/features/vehicles/utils/motTests";

export default function MotTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { vehicles, deleteVehicle, loaded, loadError } = useVehicleHistory();

  const vehicle = vehicles.find((v) => v.id === id);

  // A lookup saves the car to your vehicles, so it can be removed from here too.
  const confirmDelete = () => {
    if (!vehicle) return;
    Alert.alert(
      "Delete this vehicle?",
      `${vehicle.title}${vehicle.mot?.reg ? ` (${vehicle.mot.reg})` : ""} will be removed from your list. This can't be undone.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteVehicle(vehicle.id);
            router.replace("/vehicles/list");
          },
        },
      ]
    );
  };

  if (!vehicle || !vehicle.mot) {
    // Saved vehicles are read from storage after launch; do not call one
    // missing before that has finished.
    if (!loaded) {
      return (
        <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.muted} />
          <Text style={[styles.stateBody, { color: theme.muted }]}>Loading the MOT history</Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <View
          style={[styles.stateIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
        >
          {loadError ? (
            <Warning size={30} color={theme.warning} />
          ) : (
            <ClockCounterClockwise size={30} color={theme.muted} />
          )}
        </View>
        <Text style={[styles.stateTitle, { color: theme.text }]} accessibilityRole="header">
          {loadError ? "Couldn't load your vehicles" : "MOT data not found"}
        </Text>
        <Text style={[styles.stateBody, { color: theme.muted }]}>
          {loadError ?? "There is no MOT record saved for this vehicle."}
        </Text>
      </View>
    );
  }

  const mot = vehicle.mot;

  // Use mileageHistory from FlipRecord.mot (an entry needs a date to sit on the timeline)
  // Vehicles saved earlier may hold the mileage as text ("45210"); it has to be a number to be shown.
  const history = (mot.mileageHistory ?? [])
    .map((entry: any) => {
      const n = typeof entry?.mileage === "string" ? Number(entry.mileage.replace(/,/g, "")) : entry?.mileage;
      return { ...entry, mileage: Number.isFinite(n) ? n : null };
    })
    .filter((entry: any) => typeof entry?.date === "string" && /^\d{4}/.test(entry.date));

  // Group tests by year
  const grouped = history.reduce((acc: any, entry: any) => {
    const year = entry.date.slice(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push(entry);
    return acc;
  }, {});

  // Expiry from mot.motExpiry or mot.expiryDate (a blank string counts as none)
  const expiry = mot.motExpiry?.trim() || mot.expiryDate?.trim() || null;

  const expiryDays = daysUntilDate(expiry);

  // What the record says, in words. It used to be turned into a made-up "health" score (100 minus 10 per
  // issue) labelled Strong/Risky, which said "Strong" for a car whose MOT had expired.
  const advisoryCount = mot.advisories?.length ?? 0;
  const failureCount = mot.failures?.length ?? 0;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const issuesText =
    advisoryCount + failureCount === 0
      ? "None recorded"
      : [failureCount > 0 ? plural(failureCount, "failure") : null, advisoryCount > 0 ? plural(advisoryCount, "advisory").replace("advisorys", "advisories") : null]
          .filter(Boolean)
          .join(", ");
  const issuesColor = failureCount > 0 ? theme.danger : advisoryCount > 0 ? theme.warning : theme.success;

  // Red once expired, amber when it runs out within 30 days, green otherwise.
  const expiryColor =
    expiryDays === null
      ? theme.muted
      : expiryDays < 0
      ? theme.danger
      : expiryDays <= 30
      ? theme.warning
      : theme.success;

  const currentMileage = vehicle.mileage ?? mot.mileage ?? null;

  // Advisories and failures held on the record (the health figure above is
  // worked out from how many there are).
  // Every test the DVSA holds, newest first (vehicles saved before this was kept have none, and fall back to the
  // latest test's notes below).
  const tests = parseMotTests(mot.tests);

  const failureNotes = (mot.failures ?? []).filter(
    (note): note is string => typeof note === "string" && note.trim() !== ""
  );
  const advisoryNotes = (mot.advisories ?? []).filter(
    (note): note is string => typeof note === "string" && note.trim() !== ""
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* SUMMARY */}
      <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        <View style={styles.summaryHead}>
          {/* Use mot.make/model/year if present, else fall back to title */}
          <Text
            style={[styles.vehicleTitle, { color: theme.text }]}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {mot.make && mot.model && mot.year
              ? `${mot.make} ${mot.model} ${mot.year}`
              : vehicle.title}
          </Text>

          {mot.reg ? (
            <View
              accessible
              accessibilityLabel={`Registration ${mot.reg}`}
              style={[styles.plate, { backgroundColor: theme.background, borderColor: theme.hairline }]}
            >
              <Text style={[styles.plateText, { color: theme.text }]}>{mot.reg}</Text>
            </View>
          ) : null}
        </View>

        {/* EXPIRY + COUNTDOWN */}
        <View
          accessible
          accessibilityLabel={
            expiry
              ? `MOT expiry ${formatDate(expiry)}${
                  expiryDays !== null ? `. MOT ${motExpiryPhrase(expiryDays)}` : ""
                }`
              : "MOT expiry date not on file"
          }
          style={[styles.expiryBlock, { borderTopColor: theme.hairline }]}
        >
          <Text style={[styles.smallLabel, { color: theme.muted }]}>MOT expiry</Text>
          {expiry ? (
            <Text style={[styles.expiryFigure, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatDate(expiry)}
            </Text>
          ) : (
            <Text style={[styles.expiryMissing, { color: theme.muted }]}>Not on file</Text>
          )}
          {expiryDays !== null && (
            <Text style={[styles.expiryPhrase, { color: expiryColor }]}>
              MOT {motExpiryPhrase(expiryDays)}
            </Text>
          )}
        </View>

        {/* TEST RECORD + MILEAGE */}
        {history.length > 0 && (
          <DataRow label="Test record" value={issuesText} valueColor={issuesColor} divider />
        )}
        {typeof currentMileage === "number" && Number.isFinite(currentMileage) ? (
          <DataRow label="Mileage" value={formatMiles(currentMileage)} divider />
        ) : null}
      </View>

      {/* EVERY MOT TEST: result, miles and what the tester wrote */}
      {tests.length > 0 ? (
        <>
          <SectionTitle>MOT tests</SectionTitle>
          {tests.map((test, i) => (
            <TestCard key={`${test.date}-${i}`} test={test} />
          ))}
        </>
      ) : null}

      {/* FAILURES (latest test only: the fallback when no full history was kept) */}
      {tests.length === 0 && failureNotes.length > 0 ? (
        <>
          <SectionTitle>Failures</SectionTitle>
          <NoteList notes={failureNotes} Icon={XCircle} color={theme.danger} />
        </>
      ) : null}

      {/* ADVISORIES (latest test only: the fallback when no full history was kept) */}
      {tests.length === 0 && advisoryNotes.length > 0 ? (
        <>
          <SectionTitle>Advisories</SectionTitle>
          <NoteList notes={advisoryNotes} Icon={WarningCircle} color={theme.warning} />
        </>
      ) : null}

      {/* HISTORY */}
      <SectionTitle>Mileage history</SectionTitle>

      {/* NO HISTORY */}
      {history.length === 0 && (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: theme.card, borderColor: theme.hairline },
          ]}
        >
          <ClockCounterClockwise size={20} color={theme.muted} />
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            No MOT mileage history available.
          </Text>
        </View>
      )}

      {/* TIMELINE */}
      {Object.keys(grouped)
        .sort((a, b) => Number(b) - Number(a))
        .map((year, yearIndex) => {
          const yearEntries = grouped[year];
          const mileages: number[] = yearEntries
            .map((e: any) => e.mileage)
            .filter((m: any) => typeof m === "number" && Number.isFinite(m) && m > 0);
          const maxMileage = mileages.length > 0 ? Math.max(...mileages) : 0;

          return (
            <View key={year}>
              {/* YEAR HEADER */}
              <Text
                style={[styles.yearTitle, yearIndex === 0 && styles.yearTitleFirst, { color: theme.text }]}
                accessibilityRole="header"
              >
                {year}
              </Text>

              {yearEntries.map((entry: any, index: number) => {
                const hasMileage =
                  typeof entry.mileage === "number" && Number.isFinite(entry.mileage);
                const mileageRatio =
                  hasMileage && entry.mileage > 0 && maxMileage > 0
                    ? Math.min(entry.mileage / maxMileage, 1)
                    : 0;

                const isFirst = index === 0;
                const isLast = index === yearEntries.length - 1;

                return (
                  <View
                    key={index}
                    accessible
                    accessibilityLabel={
                      hasMileage
                        ? `${formatDate(entry.date)}, ${entry.mileage.toLocaleString()} miles`
                        : formatDate(entry.date)
                    }
                    style={[styles.timelineRow, !isLast && styles.timelineRowGap]}
                  >
                    {/* RAIL: a line through the tests of the year, with a dot on each */}
                    <View style={styles.rail}>
                      {!(isFirst && isLast) ? (
                        <View
                          style={[
                            styles.railLine,
                            { backgroundColor: theme.hairline },
                            isFirst
                              ? { top: DOT_CENTRE, bottom: 0 }
                              : isLast
                              ? { top: 0, height: DOT_CENTRE }
                              : { top: 0, bottom: 0 },
                          ]}
                        />
                      ) : null}
                      <View style={[styles.railDot, { backgroundColor: theme.muted }]} />
                    </View>

                    <View
                      style={[
                        styles.entryCard,
                        { backgroundColor: theme.card, borderColor: theme.hairline },
                      ]}
                    >
                      <View style={styles.entryHead}>
                        <Text style={[styles.entryDate, { color: theme.text }]}>
                          {formatDate(entry.date)}
                        </Text>

                        {hasMileage && (
                          <Text style={[styles.entryMiles, { color: theme.muted }]}>
                            {entry.mileage.toLocaleString()} miles
                          </Text>
                        )}
                      </View>

                      {/* MILEAGE MINI GRAPH */}
                      {hasMileage && (
                        <View style={[styles.track, { backgroundColor: theme.background }]}>
                          <View
                            style={[
                              styles.fill,
                              { width: `${mileageRatio * 100}%`, backgroundColor: theme.muted },
                            ]}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

      {/* DELETE */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete this vehicle"
        onPress={confirmDelete}
        style={({ pressed }) => [
          styles.deleteButton,
          { borderColor: theme.danger },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Trash size={20} color={theme.danger} />
        <Text style={[styles.deleteLabel, { color: theme.danger }]}>Delete this vehicle</Text>
      </Pressable>
    </ScrollView>
  );
}

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
  strong,
  divider,
}: {
  label: string;
  value: string;
  valueColor?: string;
  strong?: boolean;
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
      <Text
        style={[
          styles.dataValue,
          strong && styles.dataValueStrong,
          { color: valueColor ?? theme.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// One line per advisory or failure, each with a coloured icon.
function NoteList({
  notes,
  Icon,
  color,
}: {
  notes: string[];
  Icon: PhosphorIcon;
  color: string;
}) {
  const theme = useTheme();

  return (
    <Group>
      {notes.map((note, i) => (
        <View
          key={i}
          accessible
          accessibilityLabel={note}
          style={[styles.noteRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
        >
          <Icon size={20} color={color} />
          <Text style={[styles.noteText, { color: theme.text }]}>{note}</Text>
        </View>
      ))}
    </Group>
  );
}

// One MOT test: the date, PASS or FAIL, the miles, then the tester's notes.
function TestCard({ test }: { test: MotTestEntry }) {
  const theme = useTheme();
  const passed = test.result === "PASSED";
  const resultColor = passed ? theme.success : theme.danger;
  const clean = test.failures.length + test.advisories.length + test.minor.length === 0;
  const summary = [
    test.failures.length > 0 ? `${test.failures.length} failure${test.failures.length === 1 ? "" : "s"}` : null,
    test.advisories.length > 0 ? `${test.advisories.length} advisor${test.advisories.length === 1 ? "y" : "ies"}` : null,
    test.minor.length > 0 ? `${test.minor.length} minor` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View
      accessible
      accessibilityLabel={`${formatDate(test.date)}, ${passed ? "passed" : "failed"}${
        test.miles != null ? `, ${test.miles.toLocaleString()} miles` : ""
      }. ${summary || "No notes"}`}
      style={[styles.testCard, { backgroundColor: theme.card, borderColor: theme.hairline }]}
    >
      <View style={styles.testHead}>
        <View style={{ flexShrink: 1 }}>
          <Text style={[styles.testDate, { color: theme.text }]}>{formatDate(test.date)}</Text>
          <Text style={[styles.testMeta, { color: theme.muted }]}>
            {test.miles != null ? formatMiles(test.miles) : "No mileage recorded"}
          </Text>
        </View>
        <View style={[styles.testChip, { borderColor: resultColor }]}>
          <Text style={[styles.testChipText, { color: resultColor }]}>{passed ? "PASS" : "FAIL"}</Text>
        </View>
      </View>

      {clean ? (
        <View style={[styles.noteRow, { borderTopWidth: 1, borderTopColor: theme.hairline }]}>
          <CheckCircle size={20} color={theme.success} />
          <Text style={[styles.noteText, { color: theme.muted }]}>No advisories or failures recorded</Text>
        </View>
      ) : (
        <>
          {test.failures.map((n, i) => (
            <View key={`f${i}`} style={[styles.noteRow, { borderTopWidth: 1, borderTopColor: theme.hairline }]}>
              <XCircle size={20} color={theme.danger} />
              <Text style={[styles.noteText, { color: theme.text }]}>{n}</Text>
            </View>
          ))}
          {test.advisories.map((n, i) => (
            <View key={`a${i}`} style={[styles.noteRow, { borderTopWidth: 1, borderTopColor: theme.hairline }]}>
              <WarningCircle size={20} color={theme.warning} />
              <Text style={[styles.noteText, { color: theme.text }]}>{n}</Text>
            </View>
          ))}
          {test.minor.map((n, i) => (
            <View key={`m${i}`} style={[styles.noteRow, { borderTopWidth: 1, borderTopColor: theme.hairline }]}>
              <Info size={20} color={theme.muted} />
              <Text style={[styles.noteText, { color: theme.text }]}>{n}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// Vertical position of a timeline dot's centre, so the rail can start and stop there.
const DOT_SIZE = 10;
const DOT_TOP = 19;
const DOT_CENTRE = DOT_TOP + DOT_SIZE / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },

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
  stateTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  stateBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },

  /* SUMMARY */
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  summaryHead: {
    padding: 16,
    gap: 10,
    alignItems: "flex-start",
  },
  vehicleTitle: {
    alignSelf: "stretch",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },
  plate: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  plateText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  expiryBlock: {
    borderTopWidth: 1,
    padding: 16,
  },
  smallLabel: { fontSize: 13 },
  expiryFigure: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 38,
    fontVariant: ["tabular-nums"],
  },
  expiryMissing: { fontSize: 20, fontWeight: "600", lineHeight: 28 },
  expiryPhrase: { fontSize: 15, fontWeight: "600", marginTop: 4 },

  /* SECTIONS */
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 28, marginBottom: 10 },
  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  dataRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  dataLabel: { fontSize: 15, flexShrink: 0, marginRight: 12 },
  deleteButton: {
    marginTop: 28,
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  deleteLabel: { fontSize: 16, fontWeight: "700" },
  testCard: { borderWidth: 1, borderRadius: 14, marginBottom: 12, overflow: "hidden" },
  testHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, gap: 12 },
  testDate: { fontSize: 17, fontWeight: "700" },
  testMeta: { fontSize: 14, marginTop: 2 },
  testChip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  testChipText: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  dataValue: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  dataValueStrong: { fontSize: 18, fontWeight: "700" },

  noteRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  noteText: { flex: 1, fontSize: 15, lineHeight: 21 },

  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },

  /* TIMELINE */
  yearTitle: { fontSize: 16, fontWeight: "700", marginTop: 20, marginBottom: 10 },
  yearTitleFirst: { marginTop: 0 },
  timelineRow: { flexDirection: "row", alignItems: "stretch" },
  timelineRowGap: { paddingBottom: 10 },
  rail: { width: 24, alignSelf: "stretch", alignItems: "center" },
  railLine: { position: "absolute", left: 11, width: 2 },
  railDot: {
    position: "absolute",
    top: DOT_TOP,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  entryCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  entryHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  entryDate: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  entryMiles: { fontSize: 14, fontVariant: ["tabular-nums"] },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 10 },
  fill: { height: "100%", borderRadius: 3 },
});
