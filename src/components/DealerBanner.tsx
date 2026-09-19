import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Bell, X } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDealerNotifications } from "@/features/vehicles/context/DealerNotificationsContext";
import type { DealerNotification } from "@/features/vehicles/context/DealerNotificationsContext";
import { useTheme } from "@/styles/ThemeContext";
import { useRouter } from "expo-router";

// How far above its resting place the banner sits while hidden. Generous, so
// it clears the status bar and a notch whatever height the card ends up.
const HIDDEN_Y = -240;

export default function DealerBanner() {
  const { notifications } = useDealerNotifications();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [current, setCurrent] = useState<DealerNotification | null>(null);
  const slideAnim = useRef(new Animated.Value(HIDDEN_Y)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    Animated.timing(slideAnim, {
      toValue: HIDDEN_Y,
      duration: 350,
      useNativeDriver: true,
    }).start(() => setCurrent(null));
  };

  // Show newest unread notification
  useEffect(() => {
    const unread = notifications.find((n) => !n.read);
    if (!unread) return;

    setCurrent(unread);

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(hide, 3500);
    hideTimer.current = timer;

    return () => clearTimeout(timer);
  }, [notifications]);

  // Closing it by hand: stop the automatic hide, then slide away as usual.
  const dismiss = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hide();
  };

  if (!current) return null;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity: slideAnim.interpolate({
            inputRange: [HIDDEN_Y, HIDDEN_Y / 4, 0],
            outputRange: [0, 1, 1],
          }),
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${current.title}. ${current.message}. Open notifications`}
          style={({ pressed }) => [styles.body, pressed && styles.pressed]}
          onPress={() => router.push("/motors/notifications")}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme.background }]}>
            <Bell size={20} color={theme.gold} />
          </View>

          <View style={styles.texts}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {current.title}
            </Text>
            <Text style={[styles.message, { color: theme.muted }]} numberOfLines={2}>
              {current.message}
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          onPress={dismiss}
        >
          <X size={18} color={theme.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  close: {
    width: 44,
    height: 44,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.75,
  },
});
