import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View, Text } from "react-native";

import { useTheme } from "@/styles/useTheme";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

import LiveValuationPanel from "@/features/vehicles/components/LiveValuationPanel";
import VehicleHeaderCard from "@/components/motors/VehicleHeaderCard";
import VehicleSummaryCard from "@/components/motors/VehicleSummaryCard";
import VehicleActionsRow from "@/components/motors/VehicleActionsRow";

export default function VehicleOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { vehicles, refreshMot } = useVehicleHistory();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text style={{ fontSize: 18, color: theme.text }}>
          Vehicle data not found.
        </Text>
      </View>
    );
  }

  // Scanned or hand-added items have no MOT data; their details screen handles that.
  if (!vehicle.mot) {
    return <Redirect href={`/vehicles/details/${vehicle.id}`} />;
  }

  const mot = vehicle.mot;

  // ⭐ Latest mileage
  const latestMileage =
    mot.mileageHistory?.[mot.mileageHistory.length - 1]?.mileage ??
    mot.mileage ??
    null;

  // ⭐ MOT expiry
  const motExpiry = mot.motExpiry ?? mot.expiryDate ?? null;

  let expiryDays: number | null = null;
  let isExpired = false;
  let isExpiringSoon = false;

  if (motExpiry) {
    // The MOT is valid through the end of its expiry day, so compare calendar
    // days in local time rather than the expiry's midnight against the clock.
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

  // ⭐ MOT health score
  const issues =
    (mot.advisories?.length ?? 0) + (mot.failures?.length ?? 0);

  const motHealth = Math.max(0, 100 - issues * 10);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* PAGE TITLE */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: theme.accent,
          marginBottom: 10,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        🚗 Vehicle Overview
      </Text>

      {/* ⭐ VEHICLE HEADER */}
      <VehicleHeaderCard
        year={mot.year ?? ""}
        make={mot.make ?? ""}
        model={mot.model ?? ""}
        reg={mot.reg ?? ""}
        theme={theme}
      />

      {/* ⭐ VEHICLE SUMMARY */}
      <VehicleSummaryCard
        year={mot.year ?? ""}
        make={mot.make ?? ""}
        model={mot.model ?? ""}
        reg={mot.reg ?? ""}
        mileage={latestMileage}
        motExpiry={motExpiry}
        motHealth={motHealth}
        expiryDays={expiryDays}
        isExpired={isExpired}
        isExpiringSoon={isExpiringSoon}
        theme={theme}
      />

      {/* ⭐ LIVE VALUATION */}
      <LiveValuationPanel flip={vehicle} theme={theme} />

      {/* ⭐ INTELLIGENCE PANEL */}
      <Text style={{ color: theme.text, marginBottom: 20 }}>
        Flip intelligence data unavailable.
      </Text>

      {/* ⭐ ACTIONS */}
      <VehicleActionsRow
        theme={theme}
        primaryLabel="🔄 Refresh MOT"
        secondaryLabel="📜 View MOT Timeline"
        onPrimary={() => refreshMot(vehicle.id)}
        onSecondary={() => router.push(`/mot/${vehicle.id}`)}
      />
    </ScrollView>
  );
}
