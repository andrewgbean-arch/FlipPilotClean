import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BellSimple, Check } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";
import { useDealerNotifications } from "@/features/vehicles/context/DealerNotificationsContext";

export default function DealerNotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { notifications, markRead, clearAll } = useDealerNotifications();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        notifications.length === 0 && styles.contentEmpty,
        { paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {notifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <View
            style={[styles.emptyIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
          >
            <BellSimple size={30} color={theme.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]} accessibilityRole="header">
            No notifications yet
          </Text>
          <Text style={[styles.emptyBody, { color: theme.muted }]}>
            Alerts about MOT dates, sales and flip scores will appear here.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <Text style={[styles.summary, { color: theme.muted }]}>
              {unreadCount} unread · {notifications.length} total
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all notifications"
              hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
              style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              onPress={clearAll}
            >
              <Text style={[styles.clearLabel, { color: theme.danger }]}>Clear all</Text>
            </Pressable>
          </View>

          <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
            {notifications.map((n, i) => (
              <View
                key={n.id}
                style={[
                  styles.row,
                  i > 0 && { borderTopWidth: 1, borderTopColor: theme.hairline },
                ]}
              >
                {/* Unread marker; read rows keep the space so the text lines up. */}
                <View style={styles.dotCol}>
                  <View
                    style={[styles.dot, { backgroundColor: n.read ? "transparent" : theme.gold }]}
                  />
                </View>

                <View style={styles.rowBody}>
                  <Text
                    style={[
                      styles.title,
                      { color: n.read ? theme.muted : theme.text },
                      n.read && styles.titleRead,
                    ]}
                    accessibilityLabel={n.read ? n.title : `Unread. ${n.title}`}
                  >
                    {n.title}
                  </Text>

                  <Text style={[styles.message, { color: n.read ? theme.muted : theme.text }]}>
                    {n.message}
                  </Text>

                  <Text style={[styles.time, { color: theme.muted }]}>
                    {new Date(n.createdAt).toLocaleString()}
                  </Text>

                  {!n.read && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${n.title} as read`}
                      style={({ pressed }) => [styles.markButton, pressed && styles.pressed]}
                      onPress={() => markRead(n.id)}
                    >
                      <Check size={16} color={theme.text} weight="bold" />
                      <Text style={[styles.markLabel, { color: theme.text }]}>Mark as read</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  contentEmpty: { flexGrow: 1 },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 44,
    marginBottom: 8,
  },
  summary: { fontSize: 14, flexShrink: 1 },
  clearButton: {
    minHeight: 44,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  clearLabel: { fontSize: 15, fontWeight: "600" },

  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  dotCol: { width: 10, paddingTop: 6, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowBody: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: "600" },
  titleRead: { fontWeight: "500" },
  message: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  time: { fontSize: 12, marginTop: 6 },
  markButton: {
    minHeight: 44,
    marginTop: 4,
    marginBottom: -10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 12,
  },
  markLabel: { fontSize: 14, fontWeight: "600" },

  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 80,
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
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },

  pressed: { opacity: 0.7 },
});
