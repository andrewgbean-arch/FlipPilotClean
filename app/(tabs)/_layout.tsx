import { Tabs } from "expo-router";

import {
  Clock,
  CompassRose,
  Heart,
  House,
  Scan as ScanIcon,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,

        // We no longer use tabBarActiveTintColor or tabBarInactiveTintColor
        // because icons now have custom gold colours.

        tabBarStyle: {
          backgroundColor: "rgba(10, 25, 49, 0.96)",
          height: 128,
          paddingBottom: insets.bottom + 34,
          paddingTop: 12,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12,
        },

        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "700",
          color: "#FFD700",
        },
      }}
    >

      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ focused }) => (
            <House
              size={30}
              weight={focused ? "bold" : "regular"}
              color={focused ? "#FFD700" : "rgba(255, 215, 0, 0.45)"}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          tabBarLabel: "Scan",
          tabBarIcon: ({ focused }) => (
            <ScanIcon
              size={30}
              weight={focused ? "bold" : "regular"}
              color={focused ? "#FFD700" : "rgba(255, 215, 0, 0.45)"}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          tabBarLabel: "History",
          tabBarIcon: ({ focused }) => (
            <Clock
              size={30}
              weight={focused ? "bold" : "regular"}
              color={focused ? "#FFD700" : "rgba(255, 215, 0, 0.45)"}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="favourites"
        options={{
          tabBarLabel: "Favourites",
          tabBarIcon: ({ focused }) => (
            <Heart
              size={30}
              weight={focused ? "bold" : "regular"}
              color={focused ? "#FFD700" : "rgba(255, 215, 0, 0.45)"}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          tabBarLabel: "Explore",
          tabBarIcon: ({ focused }) => (
            <CompassRose
              size={30}
              weight={focused ? "bold" : "regular"}
              color={focused ? "#FFD700" : "rgba(255, 215, 0, 0.45)"}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="market"
        options={{
          tabBarLabel: "Market",
          tabBarIcon: ({ focused }) => (
            <CompassRose
              size={30}
              weight={focused ? "bold" : "regular"}
              color={focused ? "#FFD700" : "rgba(255, 215, 0, 0.45)"}
            />
          ),
        }}
      />

    </Tabs>
  );
}
