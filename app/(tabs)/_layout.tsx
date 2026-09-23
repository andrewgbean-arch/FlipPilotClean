import * as Haptics from "expo-haptics";
import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";

import {
  Car,
  ClockCounterClockwise,
  Compass,
  Heart,
  House,
  Scan as ScanIcon,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";

import { StyleSheet, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDealerNotifications } from "@/features/vehicles/context/DealerNotificationsContext";
import { useTheme } from "@/styles/ThemeContext";
import { hasAcceptedLegal } from "@/utils/legalConsent";

const ICON_SIZE = 24;

// The navigator passes the tint as a ColorValue; a platform colour object can't be handed to
// Phosphor (it needs a string), and the tab bar only ever supplies string tints here.
const tabIcon =
  (Icon: PhosphorIcon) =>
  ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Icon
      size={ICON_SIZE}
      weight={focused ? "fill" : "regular"}
      color={typeof color === "string" ? color : undefined}
    />
  );

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  // Nobody gets into the app until they have confirmed they are an adult and
  // agreed to the terms. Every main screen lives under these tabs, so this is
  // the one place it has to be checked.
  useEffect(() => {
    let active = true;
    hasAcceptedLegal().then((accepted) => {
      if (active && !accepted) router.replace("/welcome");
    });
    return () => {
      active = false;
    };
  }, []);

  const { notifications } = useDealerNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  // Room for a 24pt icon and an 11pt label between the padding, whatever the bottom inset is.
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      initialRouteName="home"
      // A light tick when switching tabs, like a native tab bar.
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync().catch(() => {});
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.gold,
        tabBarInactiveTintColor: theme.muted,

        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: "rgba(255, 255, 255, 0.08)",
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 56 + bottomPadding,
          paddingTop: 6,
          paddingBottom: bottomPadding,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: "600",
        },

        tabBarBadgeStyle: {
          backgroundColor: theme.gold,
          color: theme.background,
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarLabel: "Home", tabBarIcon: tabIcon(House) }}
      />

      <Tabs.Screen
        name="scan"
        options={{ tabBarLabel: "Scan", tabBarIcon: tabIcon(ScanIcon) }}
      />

      <Tabs.Screen
        name="history"
        options={{
          tabBarLabel: "History",
          tabBarIcon: tabIcon(ClockCounterClockwise),
        }}
      />

      <Tabs.Screen
        name="favourites"
        options={{ tabBarLabel: "Favourites", tabBarIcon: tabIcon(Heart) }}
      />

      <Tabs.Screen
        name="motors"
        options={{
          tabBarLabel: "Motors",
          tabBarIcon: tabIcon(Car),
          tabBarBadge: unread > 0 ? unread : undefined,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{ tabBarLabel: "Explore", tabBarIcon: tabIcon(Compass) }}
      />
    </Tabs>
  );
}
