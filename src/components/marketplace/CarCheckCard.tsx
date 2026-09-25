import React from "react";
import { StyleSheet, Text, View } from "react-native";

import MOTMileageHistory from "@/components/motors/MOTMileageHistory";

/**
 * What the government's own records say about a car, on its listing: the DVLA check (make, colour,
 * fuel, year, tax, MOT) and the MOT history (the mileage at every test, the latest result, and any
 * advisories). It comes from the server, which fetched it when the listing was made; the seller
 * never typed any of it, and the registration number itself is never shown.
 */

export type VehicleCheck = {
  verified: boolean;
  checkedAt?: string;
  make?: string | null;
  colour?: string | null;
  fuelType?: string | null;
  yearOfManufacture?: number | null;
  taxStatus?: string | null;
  motStatus?: string | null;
  motExpiryDate?: string | null;
};

export type MotHistory = {
  testCount: number;
  failedCount: number;
  readings: { date: string; miles: number; result: "PASSED" | "FAILED" }[];
  mileageDrops: boolean;
  latest: {
    date: string;
    result: "PASSED" | "FAILED";
    expiryDate: string | null;
    miles: number | null;
    advisories: string[];
    failures: string[];
  } | null;
};

const GOLD = "#FFD700";
const SILVER = "#AAB4C3";

const tidyDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const capitalise = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null);

export default function CarCheckCard({ vehicleCheck, motHistory }: { vehicleCheck?: VehicleCheck | null; motHistory?: MotHistory | null }) {
  if (!vehicleCheck?.verified && !motHistory) return null;

  const rows: [string, string | null][] = vehicleCheck
    ? [
        ["Make", capitalise(vehicleCheck.make)],
        ["Colour", capitalise(vehicleCheck.colour)],
        ["Fuel", capitalise(vehicleCheck.fuelType)],
        ["Year", vehicleCheck.yearOfManufacture ? String(vehicleCheck.yearOfManufacture) : null],
        ["Tax", vehicleCheck.taxStatus ?? null],
        [
          "MOT",
          vehicleCheck.motStatus
            ? `${vehicleCheck.motStatus}${vehicleCheck.motExpiryDate ? ` until ${tidyDate(vehicleCheck.motExpiryDate)}` : ""}`
            : null,
        ],
      ]
    : [];

  const latest = motHistory?.latest;

  return (
    <View>
      {vehicleCheck?.verified ? (
        <View style={styles.card} accessibilityLabel="Checked with the DVLA">
          <Text style={styles.title}>✓ Checked with the DVLA</Text>
          <Text style={styles.note}>These details come from the DVLA's records, not from the seller.</Text>
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <View key={label} style={styles.row}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.value}>{value}</Text>
              </View>
            ))}
        </View>
      ) : null}

      {motHistory && motHistory.readings.length > 0 ? (
        <>
          <MOTMileageHistory history={motHistory.readings.map((r) => ({ date: tidyDate(r.date) ?? r.date, mileage: r.miles }))} />
          {motHistory.mileageDrops ? (
            <Text style={styles.warning} accessibilityRole="alert">
              The mileage recorded at MOT went down between two tests. It's worth asking the seller about it.
            </Text>
          ) : null}
        </>
      ) : null}

      {motHistory && latest ? (
        <View style={styles.card}>
          <Text style={styles.title}>MOT record</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Last test</Text>
            <Text style={styles.value}>
              {latest.result === "PASSED" ? "Passed" : "Failed"} on {tidyDate(latest.date)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tests on record</Text>
            <Text style={styles.value}>
              {motHistory.testCount}
              {motHistory.failedCount ? ` (${motHistory.failedCount} failed)` : ""}
            </Text>
          </View>
          {latest.failures.length > 0 ? (
            <View style={styles.list}>
              <Text style={styles.listTitle}>Failure reasons</Text>
              {latest.failures.map((t, i) => (
                <Text key={i} style={styles.item}>
                  • {t}
                </Text>
              ))}
            </View>
          ) : null}
          {latest.advisories.length > 0 ? (
            <View style={styles.list}>
              <Text style={styles.listTitle}>Advisories at the last test</Text>
              {latest.advisories.map((t, i) => (
                <Text key={i} style={styles.item}>
                  • {t}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: GOLD,
    marginTop: 20,
  },
  title: { color: GOLD, fontSize: 16, fontWeight: "700", marginBottom: 4 },
  note: { color: SILVER, fontSize: 12, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 3 },
  label: { color: SILVER, fontSize: 13 },
  value: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  list: { marginTop: 8 },
  listTitle: { color: GOLD, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  item: { color: SILVER, fontSize: 13, marginTop: 2 },
  warning: { color: "#FFB020", fontSize: 13, marginTop: 8, lineHeight: 18 },
});
