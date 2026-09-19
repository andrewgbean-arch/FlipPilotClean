import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useDealerNotifications } from "@/features/vehicles/context/DealerNotificationsContext";
import {
  formatDate,
  motDaysLeft,
  motExpiryOf,
} from "@/features/vehicles/utils/motDates";
import { isVehicleRecord } from "@/features/vehicles/utils/vehicleStats";

export default function MotAlertsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { vehicles } = useVehicleHistory();

  const { addNotification, notifications } = useDealerNotifications();

  // Scans share the store with vehicles but have no MOT to check.
  return (
    <MotAlertsContent
      vehicles={vehicles.filter(isVehicleRecord)}
      router={router}
      theme={theme}
      addNotification={addNotification}
      notifications={notifications}
    />
  );
}

function MotAlertsContent({
  vehicles,
  router,
  theme,
  addNotification,
  notifications,
}: {
  vehicles: ReturnType<typeof useVehicleHistory>["vehicles"];
  router: ReturnType<typeof useRouter>;
  theme: any;
  addNotification: ReturnType<typeof useDealerNotifications>["addNotification"];
  notifications: ReturnType<typeof useDealerNotifications>["notifications"];
}) {
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
     ⭐ Trigger notifications once when screen loads
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 16 }}
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ color: theme.goldDeep, marginBottom: 10 }}>
          ← Back
        </Text>
      </TouchableOpacity>

      <Text
        style={{
          fontSize: 32,
          fontWeight: "800",
          color: theme.goldDeep,
          marginBottom: 20,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        MOT Alerts
      </Text>

      {/* Expired MOT */}
      <SectionHeader
        title={`Expired MOT (${expired.length})`}
        color="#FF4444"
        theme={theme}
      />
      {expired.length === 0 ? (
        <EmptyRow text="No vehicles with expired MOT." theme={theme} />
      ) : (
        expired.map((v) => (
          <MotRow
            key={v.id}
            vehicle={v}
            theme={theme}
            badge="EXPIRED"
            badgeColor="#FF4444"
          />
        ))
      )}

      {/* Expiring within 30 days */}
      <SectionHeader
        title={`Expiring within 30 days (${soon.length})`}
        color="#FFAA33"
        theme={theme}
      />
      {soon.length === 0 ? (
        <EmptyRow text="No vehicles with MOT expiring within 30 days." theme={theme} />
      ) : (
        soon.map((v) => (
          <MotRow
            key={v.id}
            vehicle={v}
            theme={theme}
            badge="SOON"
            badgeColor="#FFAA33"
          />
        ))
      )}

      {/* Expiring within 30–60 days */}
      <SectionHeader
        title={`Expiring in 30–60 days (${later.length})`}
        color="#FFDD55"
        theme={theme}
      />
      {later.length === 0 ? (
        <EmptyRow text="No vehicles with MOT expiring in 30–60 days." theme={theme} />
      ) : (
        later.map((v) => (
          <MotRow
            key={v.id}
            vehicle={v}
            theme={theme}
            badge="LATER"
            badgeColor="#FFDD55"
          />
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function SectionHeader({
  title,
  color,
  theme,
}: {
  title: string;
  color: string;
  theme: any;
}) {
  return (
    <View style={{ marginTop: 20, marginBottom: 8 }}>
      <Text
        style={{
          color,
          fontSize: 18,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function EmptyRow({
  text,
  theme,
}: {
  text: string;
  theme: any;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 12,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: theme.muted }}>{text}</Text>
    </View>
  );
}

function MotRow({
  vehicle,
  theme,
  badge,
  badgeColor,
}: {
  vehicle: any;
  theme: any;
  badge: string;
  badgeColor: string;
}) {
  const expiry = formatDate(motExpiryOf(vehicle));

  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 12,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        marginBottom: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.white, fontWeight: "700" }}>
          {vehicle.title}
        </Text>
        <Text style={{ color: theme.muted, marginTop: 4 }}>
          MOT Expiry: {expiry}
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: badgeColor,
        }}
      >
        <Text
          style={{
            color: "#000",
            fontWeight: "700",
            fontSize: 12,
          }}
        >
          {badge}
        </Text>
      </View>
    </View>
  );
}
