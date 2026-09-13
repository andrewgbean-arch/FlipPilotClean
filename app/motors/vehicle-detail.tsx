import React from "react";
import { ScrollView, Text, View, TouchableOpacity, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export default function MotorsVehicleDetail() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const vehicleId = Array.isArray(id) ? id[0] : id;

  const { vehicles } = useVehicleHistory();
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (!vehicle) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background, padding: 20 }}>
        <Text style={{ color: theme.white, fontSize: 18, fontWeight: "700" }}>Vehicle not found</Text>
        <Text style={{ color: theme.muted, marginTop: 8, textAlign: "center" }}>
          This vehicle no longer exists in your history.
        </Text>
      </View>
    );
  }

  return <MotorsVehicleDetailContent vehicle={vehicle} theme={theme} />;
}

function MotorsVehicleDetailContent({ vehicle, theme }: { vehicle: FlipRecord; theme: any }) {
  const profit = (vehicle.sellPrice ?? vehicle.valuation ?? 0) - (vehicle.buyPrice ?? 0);
  const motExpiry = vehicle.mot?.motExpiry ?? vehicle.mot?.expiryDate ?? null;
  const motDaysLeft = motExpiry
    ? Math.ceil((new Date(motExpiry).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
    >
      {/* BACK */}
      <TouchableOpacity
        onPress={() => (router.canGoBack() ? router.back() : router.push("/motors/listings"))}
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}
        hitSlop={10}
      >
        <Feather name="chevron-left" size={22} color={theme.muted} />
        <Text style={{ color: theme.muted, fontSize: 15, fontWeight: "600" }}>Back</Text>
      </TouchableOpacity>

      {/* THUMBNAIL */}
      {vehicle.images?.[0] && (
        <Image
          source={{ uri: vehicle.images[0] }}
          style={{ width: "100%", height: 200, borderRadius: theme.radius.lg, marginBottom: 16 }}
          resizeMode="cover"
        />
      )}

      {/* TITLE */}
      <Text style={{ color: theme.goldDeep, fontSize: 26, fontWeight: "800" }}>
        {vehicle.title}
      </Text>
      <Text style={{ color: theme.muted, marginTop: 4 }}>
        {vehicle.mot?.make} {vehicle.mot?.model} • {vehicle.mot?.year ?? "—"}
      </Text>

      {/* QUICK ACTIONS */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <ActionChip
          icon="image"
          label="Photos"
          theme={theme}
          onPress={() => router.push(`/motors/gallery/${vehicle.id}`)}
        />
        <ActionChip
          icon="edit-2"
          label="Edit"
          theme={theme}
          onPress={() => router.push(`/motors/edit-vehicle?id=${vehicle.id}`)}
        />
      </View>

      {/* STATS */}
      <View
        style={{
          marginTop: 20,
          backgroundColor: theme.card,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          padding: 16,
        }}
      >
        <Text style={{ color: theme.white, fontSize: 18, fontWeight: "700", marginBottom: 10 }}>
          Flip Stats
        </Text>
        <StatRow label="Buy Price" value={vehicle.buyPrice != null ? `£${vehicle.buyPrice}` : "—"} theme={theme} />
        <StatRow label="Sell Price" value={vehicle.sellPrice != null ? `£${vehicle.sellPrice}` : "—"} theme={theme} />
        <StatRow
          label="Profit"
          value={`£${profit.toFixed(2)}`}
          valueColor={profit >= 0 ? theme.success : theme.danger}
          theme={theme}
        />
        <StatRow label="FlipScore" value={`${vehicle.flipScore ?? "?"}/100`} theme={theme} />
        <StatRow label="Mileage" value={vehicle.mileage != null ? `${vehicle.mileage} mi` : "—"} theme={theme} />
      </View>

      {/* MOT */}
      <View
        style={{
          marginTop: 20,
          backgroundColor: theme.card,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          padding: 16,
        }}
      >
        <Text style={{ color: theme.white, fontSize: 18, fontWeight: "700", marginBottom: 10 }}>
          MOT
        </Text>
        {motExpiry ? (
          <StatRow
            label="Expires"
            value={`${motExpiry} (${motDaysLeft} days)`}
            valueColor={motDaysLeft != null && motDaysLeft <= 30 ? theme.danger : theme.white}
            theme={theme}
          />
        ) : (
          <Text style={{ color: theme.muted }}>No MOT data on file.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function StatRow({
  label,
  value,
  valueColor,
  theme,
}: {
  label: string;
  value: string;
  valueColor?: string;
  theme: any;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
      <Text style={{ color: theme.muted }}>{label}</Text>
      <Text style={{ color: valueColor ?? theme.white, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

function ActionChip({
  icon,
  label,
  theme,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  theme: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: theme.card,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
      }}
    >
      <Feather name={icon} size={14} color={theme.goldDeep} />
      <Text style={{ color: theme.white, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}
