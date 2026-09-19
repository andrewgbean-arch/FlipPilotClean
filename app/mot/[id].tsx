import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/styles/ThemeContext";
import { estimateCarValue } from "@/car/valuation";
import {
  daysUntilDate,
  formatDate,
  motExpiryPhrase,
} from "@/features/vehicles/utils/motDates";

export default function MotTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { vehicles } = useVehicleHistory();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle || !vehicle.mot) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: theme.white }}>MOT data not found</Text>
      </View>
    );
  }

  const mot = vehicle.mot;

  // ⭐ Use mileageHistory from FlipRecord.mot (an entry needs a date to sit on the timeline)
  const history = (mot.mileageHistory ?? []).filter(
    (entry: any) => typeof entry?.date === "string" && /^\d{4}/.test(entry.date)
  );

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

  // Pass probability – we don’t have PASS/FAIL per entry, so base on failures length
  const passProbability =
    mot.failures && mot.failures.length > 0
      ? 60
      : mot.advisories && mot.advisories.length > 0
      ? 80
      : 95;

  // MOT health score – simple heuristic from advisories/failures
  const totalIssues =
    (mot.advisories?.length ?? 0) + (mot.failures?.length ?? 0);

  const healthScore =
    history.length === 0
      ? null
      : Math.max(0, 100 - totalIssues * 10);

  const healthLabel =
    healthScore === null
      ? "Unknown"
      : healthScore > 80
      ? "Strong"
      : healthScore > 60
      ? "Moderate"
      : "Risky";

  // ⭐ Quick valuation — only when we have enough real data to be meaningful
  const conditionMap: Record<string, "excellent" | "good" | "average" | "poor"> = {
    excellent: "excellent",
    good: "good",
    fair: "average",
    poor: "poor",
  };
  const rawCondition = vehicle.ai?.condition?.toLowerCase();
  const valuation =
    mot.make && mot.model && mot.year
      ? estimateCarValue({
          make: mot.make,
          model: mot.model,
          year: Number(mot.year),
          mileage: vehicle.mileage ?? mot.mileage ?? 0,
          condition: conditionMap[rawCondition ?? ""] ?? "good",
        })
      : null;
  const showValuation =
    valuation !== null &&
    Number.isFinite(valuation.estimatedPrice) &&
    valuation.estimatedPrice > 0;

  const healthColor =
    healthScore === null
      ? theme.muted
      : healthScore > 80
      ? "#7CFC00"
      : healthScore > 60
      ? "#FFA500"
      : "#FF4444";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      {/* HERO HEADER */}
      <View
        style={{
          marginBottom: 24,
          padding: 18,
          borderRadius: theme.radius.lg, // xl doesn’t exist on your theme
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
      >
        <Text
          style={{
            fontSize: 26,
            fontWeight: "900",
            color: theme.accent,
            marginBottom: 6,
            textShadowColor: theme.goldSoftGlow,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 10,
          }}
        >
          📜 MOT Timeline
        </Text>

        {/* Use mot.make/model/year if present, else fall back to title */}
        <Text
          style={{
            color: theme.white,
            fontSize: 18,
            fontWeight: "700",
            marginBottom: 4,
          }}
        >
          {mot.make && mot.model && mot.year
            ? `${mot.make} ${mot.model} ${mot.year}`
            : vehicle.title}
        </Text>

        {mot.reg && (
          <Text
            style={{
              color: theme.muted,
              fontSize: 16,
              marginBottom: 10,
            }}
          >
            Reg: {mot.reg}
          </Text>
        )}

        {/* MOT STATUS + HEALTH */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {expiry && (
            <Text
              style={{
                backgroundColor: theme.goldDeep,
                color: theme.black,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: theme.radius.lg,
                fontWeight: "700",
              }}
            >
              Expires: {formatDate(expiry)}
            </Text>
          )}

          {healthScore !== null && (
            <View
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: healthColor,
              }}
            >
              <Text
                style={{
                  color: healthColor,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                MOT Health: {healthLabel} ({healthScore})
              </Text>
            </View>
          )}
        </View>

        {/* EXPIRY + PASS PROBABILITY */}
        <View
          style={{
            marginTop: 12,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          {expiryDays !== null && (
            <Text
              style={{
                color:
                  expiryDays < 30
                    ? "#FF4444"
                    : expiryDays < 90
                    ? "#FFA500"
                    : "#7CFC00",
                fontWeight: "700",
              }}
            >
              MOT {motExpiryPhrase(expiryDays)}
            </Text>
          )}

          {passProbability !== null && (
            <Text
              style={{
                color: theme.accent,
                fontWeight: "700",
              }}
            >
              Pass Chance: {passProbability}%
            </Text>
          )}
        </View>
      </View>

      {/* QUICK VALUATION */}
      {valuation && showValuation && (
        <View
          style={{
            marginBottom: 24,
            padding: 18,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
          }}
        >
          <Text style={{ color: theme.accent, fontSize: 18, fontWeight: "800", marginBottom: 10 }}>
            💰 Quick Valuation
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: theme.muted }}>Estimated Value</Text>
            <Text style={{ color: theme.white, fontWeight: "800" }}>
              £{valuation.estimatedPrice.toLocaleString()}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: theme.muted }}>Private Sale</Text>
            <Text style={{ color: theme.white }}>£{valuation.privateSalePrice.toLocaleString()}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: theme.muted }}>Trade-In</Text>
            <Text style={{ color: theme.white }}>£{valuation.tradeInPrice.toLocaleString()}</Text>
          </View>
          <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>
            Confidence: {valuation.confidence}% · based on age, mileage and condition
          </Text>
        </View>
      )}

      {/* NO HISTORY */}
      {history.length === 0 && (
        <Text style={{ color: theme.muted }}>No MOT mileage history available.</Text>
      )}

      {/* TIMELINE */}
      {Object.keys(grouped)
        .sort((a, b) => Number(b) - Number(a))
        .map((year) => {
          const yearEntries = grouped[year];
          const mileages: number[] = yearEntries
            .map((e: any) => e.mileage)
            .filter((m: any) => typeof m === "number" && Number.isFinite(m) && m > 0);
          const maxMileage = mileages.length > 0 ? Math.max(...mileages) : 0;

          return (
            <View key={year} style={{ marginBottom: 30 }}>
              {/* YEAR HEADER */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 24,
                    borderRadius: 999,
                    backgroundColor: theme.goldSoftGlow,
                    marginRight: 10,
                  }}
                />
                <Text
                  style={{
                    color: theme.accent,
                    fontSize: 22,
                    fontWeight: "800",
                  }}
                >
                  {year}
                </Text>
              </View>

              {yearEntries.map((entry: any, index: number) => {
                const hasMileage =
                  typeof entry.mileage === "number" && Number.isFinite(entry.mileage);
                const mileageRatio =
                  hasMileage && entry.mileage > 0 && maxMileage > 0
                    ? Math.min(entry.mileage / maxMileage, 1)
                    : 0;

                return (
                  <View
                    key={index}
                    style={{
                      marginBottom: 18,
                      padding: 16,
                      backgroundColor: theme.card,
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: theme.goldSoftGlow,
                    }}
                  >
                    {/* CONNECTOR DOT */}
                    <View
                      style={{
                        position: "absolute",
                        left: -10,
                        top: 18,
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: theme.goldSoftGlow,
                      }}
                    />

                    {/* DATE */}
                    <Text
                      style={{
                        color: theme.white,
                        fontSize: 17,
                        fontWeight: "700",
                        marginBottom: 6,
                      }}
                    >
                      {formatDate(entry.date)}
                    </Text>

                    {/* MILEAGE MINI GRAPH */}
                    {hasMileage && (
                      <View style={{ marginBottom: 8 }}>
                        <View
                          style={{
                            height: 8,
                            backgroundColor: theme.goldSoftGlow,
                            width: `${mileageRatio * 100}%`,
                            borderRadius: 6,
                            marginBottom: 4,
                          }}
                        />
                        <Text style={{ color: theme.white, fontSize: 14 }}>
                          {entry.mileage.toLocaleString()} miles
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

      {/* BACK BUTTON */}
      <View style={{ marginTop: 10 }}>
        <Text
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace(`/vehicles/overview/${vehicle.id}`)
          }
          style={{
            backgroundColor: theme.goldDeep,
            color: theme.black,
            padding: 14,
            textAlign: "center",
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
            fontSize: 18,
            fontWeight: "700",
          }}
        >
          ← Back
        </Text>
      </View>
    </ScrollView>
  );
}
