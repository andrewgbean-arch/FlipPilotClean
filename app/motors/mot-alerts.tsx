import React, { useEffect } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  CalendarBlank,
  Car,
  CheckCircle,
  Clock,
  Warning,
  WarningCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useDealerNotifications } from "@/features/vehicles/context/DealerNotificationsContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import {
  formatDate,
  motDaysLeft,
  motExpiryOf,
} from "@/features/vehicles/utils/motDates";
import { isVehicleRecord } from "@/features/vehicles/utils/vehicleStats";

type AppTheme = ReturnType<typeof useTheme>;

export default function MotAlertsScreen() {
  const theme = useTheme();

  const { vehicles, loaded, loadError } = useVehicleHistory();

  const { addNotification, notifications } = useDealerNotifications();

  // Scans share the store with vehicles but have no MOT to check.
  return (
    <MotAlertsContent
      vehicles={vehicles.filter(isVehicleRecord)}
      theme={theme}
      addNotification={addNotification}
      notifications={notifications}
      loaded={loaded}
      loadError={loadError}
    />
  );
}

function MotAlertsContent({
  vehicles,
  theme,
  addNotification,
  notifications,
  loaded,
  loadError,
}: {
  vehicles: ReturnType<typeof useVehicleHistory>["vehicles"];
  theme: AppTheme;
  addNotification: ReturnType<typeof useDealerNotifications>["addNotification"];
  notifications: ReturnType<typeof useDealerNotifications>["notifications"];
  loaded: boolean;
  loadError: string | null;
}) {
  const insets = useSafeAreaInsets();

  // A MOT is valid through the whole of its expiry day, so today is not expired.
  const expired = vehicles.filter((v) => {
    const days = motDaysLeft(v);
    return days !== null && days < 0;
  });

  const soon = vehicles.filter((v) => {
    const days = motDaysLeft(v);
    return days !== null && days >= 0 && days <= 30;
  });

  const later = vehicles.filter((v) => {
    const days = motDaysLeft(v);
    return days !== null && days > 30 && days <= 60;
  });

  /* ---------------------------------------------
     Trigger notifications once when screen loads
     (skipping any already raised, so reopening this screen does not repeat them)
  --------------------------------------------- */
  useEffect(() => {
    const raised = new Set(notifications.map((n) => `${n.title}|${n.message}`));

    const notify = (title: string, list: typeof vehicles, verb: string) => {
      list.forEach((v) => {
        const message = `${v.title} MOT ${verb} ${formatDate(motExpiryOf(v))}`;
        if (raised.has(`${title}|${message}`)) return;
        addNotification({ type: "MOT", title, message });
      });
    };

    notify("MOT expired", expired, "expired on");
    notify("MOT expiring soon", soon, "expires on");
    notify("MOT expiring in 30–60 days", later, "expires on");
  }, []);

  const nothingToShow = expired.length === 0 && soon.length === 0 && later.length === 0;

  // Nothing to list: say why, calmly, instead of three empty boxes.
  if (nothingToShow) {
    const noVehicles = vehicles.length === 0;

    // Saved vehicles are read from storage after launch; do not call the list
    // clear before that has finished.
    if (!loaded) {
      return (
        <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.muted} />
          <Text style={[styles.stateBody, { color: theme.muted }]}>Checking your MOT dates</Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <View
          style={[styles.emptyIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
        >
          {loadError && noVehicles ? (
            <Warning size={30} color={theme.warning} />
          ) : noVehicles ? (
            <Car size={30} color={theme.muted} />
          ) : (
            <CheckCircle size={30} color={theme.success} />
          )}
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]} accessibilityRole="header">
          {loadError && noVehicles
            ? "Couldn't load your vehicles"
            : noVehicles
            ? "No vehicles to check"
            : "No MOT alerts"}
        </Text>
        <Text style={[styles.stateBody, { color: theme.muted }]}>
          {loadError && noVehicles
            ? loadError
            : noVehicles
            ? "Add a vehicle and its MOT dates will be checked here."
            : "None of your vehicles has an MOT that has expired or runs out within 60 days."}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Vehicles with an MOT that has expired or runs out within 60 days.
      </Text>

      {/* Expired MOT */}
      <SectionTitle title="Expired" count={expired.length} theme={theme} />
      {expired.length === 0 ? (
        <EmptyCard
          text="No vehicles with expired MOT."
          Icon={CheckCircle}
          iconColor={theme.success}
          theme={theme}
        />
      ) : (
        <Group theme={theme}>
          {expired.map((v, i) => (
            <MotRow
              key={v.id}
              vehicle={v}
              theme={theme}
              badge="Expired"
              color={theme.danger}
              Icon={WarningCircle}
              divider={i > 0}
            />
          ))}
        </Group>
      )}

      {/* Expiring within 30 days */}
      <SectionTitle title="Expiring within 30 days" count={soon.length} theme={theme} />
      {soon.length === 0 ? (
        <EmptyCard
          text="No vehicles with MOT expiring within 30 days."
          Icon={CheckCircle}
          iconColor={theme.success}
          theme={theme}
        />
      ) : (
        <Group theme={theme}>
          {soon.map((v, i) => (
            <MotRow
              key={v.id}
              vehicle={v}
              theme={theme}
              badge="Due soon"
              color={theme.warning}
              Icon={Clock}
              divider={i > 0}
            />
          ))}
        </Group>
      )}

      {/* Expiring within 30–60 days */}
      <SectionTitle title="Expiring in 30–60 days" count={later.length} theme={theme} />
      {later.length === 0 ? (
        <EmptyCard text="No vehicles with MOT expiring in 30–60 days." theme={theme} />
      ) : (
        <Group theme={theme}>
          {later.map((v, i) => (
            <MotRow
              key={v.id}
              vehicle={v}
              theme={theme}
              badge="Later"
              color={theme.muted}
              Icon={CalendarBlank}
              divider={i > 0}
            />
          ))}
        </Group>
      )}
    </ScrollView>
  );
}

/* SMALL LOCAL COMPONENTS */

function SectionTitle({
  title,
  count,
  theme,
}: {
  title: string;
  count: number;
  theme: AppTheme;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      {count > 0 ? (
        <Text style={[styles.sectionMeta, { color: theme.muted }]}>
          {count} {count === 1 ? "vehicle" : "vehicles"}
        </Text>
      ) : null}
    </View>
  );
}

// A card that holds rows; the rows inside are split by hairlines.
function Group({ children, theme }: { children: React.ReactNode; theme: AppTheme }) {
  return (
    <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      {children}
    </View>
  );
}

function EmptyCard({
  text,
  Icon,
  iconColor,
  theme,
}: {
  text: string;
  Icon?: PhosphorIcon;
  iconColor?: string;
  theme: AppTheme;
}) {
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

function MotRow({
  vehicle,
  theme,
  badge,
  color,
  Icon,
  divider,
}: {
  vehicle: FlipRecord;
  theme: AppTheme;
  badge: string;
  color: string;
  Icon: PhosphorIcon;
  divider?: boolean;
}) {
  const expiry = formatDate(motExpiryOf(vehicle));

  return (
    <View
      accessible
      accessibilityLabel={`${vehicle.title}. MOT expiry ${expiry}. ${badge}`}
      style={[
        styles.row,
        divider && { borderTopWidth: 1, borderTopColor: theme.hairline },
      ]}
    >
      <Icon size={22} color={color} />

      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={2}>
          {vehicle.title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: theme.muted }]} numberOfLines={1}>
          MOT expiry: {expiry}
        </Text>
      </View>

      <View style={[styles.chip, { backgroundColor: color + "24" }]}>
        <Text style={[styles.chipText, { color }]}>{badge}</Text>
      </View>
    </View>
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
  stateBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },

  subtitle: { fontSize: 14 },

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
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 13, marginTop: 2 },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  chipText: { fontSize: 12, fontWeight: "700" },

  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
});
