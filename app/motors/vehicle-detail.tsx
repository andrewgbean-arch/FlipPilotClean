import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Car, Images, PencilSimple, Warning } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import {
  formatDate,
  motDaysLeft,
  motExpiryOf,
  motExpiryPhrase,
} from "@/features/vehicles/utils/motDates";
import {
  formatMiles,
  formatMoney,
  formatScore,
  realisedProfit,
} from "@/features/vehicles/utils/vehicleStats";

type AppTheme = ReturnType<typeof useTheme>;

// Profit and loss always carry a sign: "+£300" / "-£45", or "-" when unknown.
function signedMoney(value: number | null): string {
  if (value === null) return "-";
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}

export default function MotorsVehicleDetail() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const vehicleId = Array.isArray(id) ? id[0] : id;

  const { vehicles, loaded, loadError } = useVehicleHistory();
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (!vehicle) {
    // Saved vehicles are read from storage after launch; do not call one
    // missing before that has finished.
    if (!loaded) {
      return (
        <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.muted} />
          <Text style={[styles.stateBody, { color: theme.muted }]}>Loading your vehicle</Text>
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
            <Car size={30} color={theme.muted} />
          )}
        </View>
        <Text style={[styles.stateTitle, { color: theme.text }]} accessibilityRole="header">
          {loadError ? "Couldn't load your vehicles" : "Vehicle not found"}
        </Text>
        <Text style={[styles.stateBody, { color: theme.muted }]}>
          {loadError ?? "This vehicle no longer exists in your history."}
        </Text>
      </View>
    );
  }

  return <MotorsVehicleDetailContent vehicle={vehicle} theme={theme} />;
}

function MotorsVehicleDetailContent({
  vehicle,
  theme,
}: {
  vehicle: FlipRecord;
  theme: AppTheme;
}) {
  const insets = useSafeAreaInsets();

  const profit = realisedProfit(vehicle);
  const motExpiry = motExpiryOf(vehicle);
  const daysLeft = motDaysLeft(vehicle);
  const makeModel = [vehicle.mot?.make, vehicle.mot?.model].filter(Boolean).join(" ");
  const subtitle = [makeModel, vehicle.mot?.year].filter(Boolean).join(" · ");
  const expiryPhrase = motExpiryPhrase(daysLeft);

  const profitColor =
    profit === null ? theme.muted : profit >= 0 ? theme.success : theme.danger;

  // Red once expired, amber when it runs out within 30 days.
  const statusColor =
    daysLeft === null
      ? theme.text
      : daysLeft < 0
      ? theme.danger
      : daysLeft <= 30
      ? theme.warning
      : theme.text;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* THUMBNAIL */}
      {vehicle.images?.[0] && (
        <Image
          source={{ uri: vehicle.images[0] }}
          accessibilityLabel={`Photo of ${vehicle.title}`}
          style={[styles.thumbnail, { backgroundColor: theme.card }]}
          resizeMode="cover"
        />
      )}

      {/* TITLE */}
      <Text
        style={[styles.title, vehicle.images?.[0] ? styles.titleAfterPhoto : null, { color: theme.text }]}
        numberOfLines={3}
        accessibilityRole="header"
      >
        {vehicle.title}
      </Text>
      {subtitle !== "" && (
        <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
      )}

      {/* QUICK ACTIONS */}
      <View style={styles.actionsRow}>
        <ActionButton
          Icon={Images}
          label="Photos"
          onPress={() => router.push(`/motors/gallery/${vehicle.id}`)}
        />
        <ActionButton
          Icon={PencilSimple}
          label="Edit"
          onPress={() => router.push(`/motors/edit-vehicle?id=${vehicle.id}`)}
        />
      </View>

      {/* STATS */}
      <SectionTitle>Flip stats</SectionTitle>
      <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        <View
          accessible
          accessibilityLabel={`Profit ${signedMoney(profit)}`}
          style={styles.profitBlock}
        >
          <Text style={[styles.smallLabel, { color: theme.muted }]}>Profit</Text>
          <Text
            style={[styles.profitFigure, { color: profitColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {signedMoney(profit)}
          </Text>
        </View>

        <DataRow label="Buy price" value={formatMoney(vehicle.buyPrice)} divider />
        <DataRow label="Sell price" value={formatMoney(vehicle.sellPrice)} divider />
        <DataRow label="Flip score" value={formatScore(vehicle.flipScore)} divider />
        <DataRow
          label="Mileage"
          value={formatMiles(vehicle.mileage ?? vehicle.mot?.mileage)}
          divider
        />
      </View>

      {/* MOT */}
      <SectionTitle>MOT</SectionTitle>
      <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        {motExpiry ? (
          <>
            <DataRow label="Expiry" value={formatDate(motExpiry)} />
            {daysLeft !== null && (
              <DataRow
                label="Status"
                value={expiryPhrase.charAt(0).toUpperCase() + expiryPhrase.slice(1)}
                valueColor={statusColor}
                divider
              />
            )}
          </>
        ) : (
          <View style={styles.textBlock}>
            <Text style={[styles.textBlockText, { color: theme.muted }]}>No MOT data on file.</Text>
          </View>
        )}
      </View>
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

function ActionButton({
  Icon,
  label,
  onPress,
}: {
  Icon: PhosphorIcon;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        { borderColor: theme.hairline, backgroundColor: theme.card },
        pressed && styles.pressed,
      ]}
    >
      <Icon size={20} color={theme.text} />
      <Text style={[styles.secondaryLabel, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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

  thumbnail: {
    width: "100%",
    height: 200,
    borderRadius: 16,
  },
  title: { fontSize: 28, fontWeight: "700" },
  titleAfterPhoto: { marginTop: 16 },
  subtitle: { fontSize: 14, marginTop: 2 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryLabel: { fontSize: 16, fontWeight: "600", flexShrink: 1 },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 28, marginBottom: 10 },

  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  profitBlock: { padding: 16 },
  smallLabel: { fontSize: 13 },
  profitFigure: {
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 42,
    fontVariant: ["tabular-nums"],
  },
  dataRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  dataLabel: { fontSize: 15 },
  dataValue: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  textBlock: { padding: 16 },
  textBlockText: { fontSize: 16, lineHeight: 23 },

  pressed: { opacity: 0.75 },
});
