import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import { useRouter } from "expo-router";
import { useDealerNotifications } from "@/features/vehicles/context/DealerNotificationsContext";

export default function DealerNotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { notifications, markRead, clearAll } = useDealerNotifications();

  const unreadCount = notifications.filter((n) => !n.read).length;

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
          marginBottom: 8,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        Notifications
      </Text>

      <Text style={{ color: theme.muted, marginBottom: 16 }}>
        {unreadCount} unread · {notifications.length} total
      </Text>

      {notifications.length > 0 && (
        <TouchableOpacity
          style={{
            backgroundColor: theme.card,
            padding: 10,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
            marginBottom: 16,
          }}
          onPress={clearAll}
        >
          <Text style={{ color: theme.white, textAlign: "center" }}>
            Clear all notifications
          </Text>
        </TouchableOpacity>
      )}

      {notifications.length === 0 ? (
        <View
          style={{
            backgroundColor: theme.card,
            padding: 14,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
          }}
        >
          <Text style={{ color: theme.muted }}>No notifications yet.</Text>
        </View>
      ) : (
        notifications.map((n) => (
          <View
            key={n.id}
            style={{
              backgroundColor: n.read ? theme.card : theme.black,
              padding: 14,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: n.read ? theme.goldSoftGlow : theme.goldDeep,
              marginBottom: 10,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.white, fontWeight: "700" }}>{n.title}</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>
                {new Date(n.createdAt).toLocaleString()}
              </Text>
            </View>
            <Text style={{ color: theme.muted, marginTop: 4 }}>{n.message}</Text>

            {!n.read && (
              <TouchableOpacity
                style={{
                  marginTop: 8,
                  alignSelf: "flex-start",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: theme.goldDeep,
                }}
                onPress={() => markRead(n.id)}
              >
                <Text style={{ color: theme.black, fontWeight: "700", fontSize: 12 }}>
                  Mark as read
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
