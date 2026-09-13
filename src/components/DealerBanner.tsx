import { useEffect, useRef, useState } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { useDealerNotifications } from "@/features/vehicles/context/DealerNotificationsContext";
import { useTheme } from "@/styles/ThemeContext";
import { useRouter } from "expo-router";

export default function DealerBanner() {
  const { notifications } = useDealerNotifications();
  const theme = useTheme();
  const router = useRouter();

  const [current, setCurrent] = useState<any>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;

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

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 350,
        useNativeDriver: true,
      }).start(() => setCurrent(null));
    }, 3500);

    return () => clearTimeout(timer);
  }, [notifications]);

  if (!current) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        transform: [{ translateY: slideAnim }],
        backgroundColor: theme.goldDeep,
        padding: 14,
        zIndex: 9999,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        shadowColor: theme.goldSoftGlow,
        shadowOpacity: 0.4,
        shadowRadius: 10,
      }}
    >
      <TouchableOpacity
        onPress={() => router.push("/motors/notifications")}
        style={{ flexDirection: "column" }}
      >
        <Text
          style={{
            color: theme.black,
            fontWeight: "800",
            fontSize: 16,
          }}
        >
          {current.title}
        </Text>
        <Text
          style={{
            color: theme.black,
            marginTop: 4,
            fontSize: 14,
          }}
        >
          {current.message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
