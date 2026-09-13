import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View, Text } from "react-native";

import { useTheme } from "@/styles/useTheme";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

import LiveValuationPanel from "@/features/vehicles/components/LiveValuationPanel";
import VehicleHeaderCard from "@/components/motors/VehicleHeaderCard";
import VehicleSummaryCard from "@/components/motors/VehicleSummaryCard";
import VehicleActionsRow from "@/components/motors/VehicleActionsRow";

import FinanceSuiteSummaryCard from "@/components/dealer/FinanceSuiteSummaryCard";
import AffordabilitySummaryCard from "@/components/dealer/AffordabilitySummaryCard";


export default function VehicleOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { vehicles, refreshMot } = useVehicleHistory();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle || !vehicle.mot) {
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

  const mot = vehicle.mot;

  // ⭐ Latest mileage
  const latestMileage =
    mot.mileageHistory?.[mot.mileageHistory.length - 1]?.mileage ?? null;

  // ⭐ MOT expiry
  const motExpiry = mot.motExpiry ?? mot.expiryDate ?? null;

  let expiryDays: number | null = null;
  let isExpired = false;
  let isExpiringSoon = false;

  if (motExpiry) {
    const expiryDate = new Date(motExpiry);
    const now = new Date();

    expiryDays = Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000);

    isExpired = expiryDate < now;
    isExpiringSoon = !isExpired && expiryDays <= 30;
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

      {/* ⭐ FINANCE SUITE SUMMARY */}
      <FinanceSuiteSummaryCard vehicle={vehicle} buyer={{}} />
      <AffordabilitySummaryCard vehicle={vehicle} buyer={{}} theme={theme} />


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
