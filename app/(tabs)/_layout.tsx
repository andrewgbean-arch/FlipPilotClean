import { Tabs } from "expo-router";

import {
  Clock,
  CompassRose,
  Heart,
  House,
  Scan as ScanIcon,
  Briefcase,
} from "phosphor-react-native";

import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ⭐ Motors notifications
import { useDealerNotifications } from "@/features/vehicles/context/DealerNotificationsContext";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // ⭐ unread count (Motors only)
  const { notifications } = useDealerNotifications();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,

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

      {/* HOME */}
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

      {/* SCAN */}
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

      {/* HISTORY */}
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

      {/* FAVOURITES */}
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

      {/* ⭐ MOTORS (with unread badge) */}
      <Tabs.Screen
        name="motors"
        options={{
          tabBarLabel: "Motors",
          tabBarIcon: ({ focused }) => (
            <BadgeWrapper unread={unread}>
              <CompassRose
                size={30}
                weight={focused ? "bold" : "regular"}
                color={focused ? "#FFD700" : "rgba(255, 215, 0, 0.45)"}
              />
            </BadgeWrapper>
          ),
        }}
      />

      {/* ⭐ DEALER TAB */}
      <Tabs.Screen
        name="dealer"
        options={{
          tabBarLabel: "Dealer",
          tabBarIcon: ({ focused }) => (
            <Briefcase
              size={30}
              weight={focused ? "bold" : "regular"}
              color={focused ? "#FFD700" : "rgba(255, 215, 0, 0.45)"}
            />
          ),
        }}
      />

      {/* EXPLORE */}
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

    </Tabs>
  );
}

function BadgeWrapper({
  children,
  unread,
}: {
  children: React.ReactNode;
  unread: number;
}) {
  return (
    <View style={{ position: "relative" }}>
      {children}

      {unread > 0 && (
        <View
          style={{
            position: "absolute",
            top: -6,
            right: -10,
            backgroundColor: "#FFD700",
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              color: "#000",
              fontWeight: "800",
              fontSize: 12,
            }}
          >
            {unread}
          </Text>
        </View>
      )}
    </View>
  );
}
