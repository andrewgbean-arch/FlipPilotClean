import { DarkTheme, Stack, ThemeProvider as NavigationThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import DealerBanner from "../src/components/DealerBanner";
import ProBadge from "../src/components/ProBadge";

import { SubscriptionProvider } from "../src/context/SubscriptionContext";
import { ThemeProvider, useTheme } from "../src/styles/ThemeContext";

import { VehicleHistoryProvider, useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

// ✔ REAL Dealer Mode Provider
import { UserSettingsProvider } from "@/features/settings/UserSettingsContext";

// Dealer Notifications
import { DealerNotificationsProvider } from "@/features/vehicles/context/DealerNotificationsContext";

// Gold Flash Overlay
import GoldFlashOverlay from "@/components/ui/GoldFlashOverlay";

// ⭐ Gold Confetti Overlay
import GoldConfetti from "@/components/ui/GoldConfetti";

// ⭐ Gold Lightning Flash (milestone accent)
import GoldLightning from "@/components/ui/GoldLightning";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Without this, one render error in any screen unmounts the whole app.
export { RouteErrorScreen as ErrorBoundary } from "@/components/ErrorScreen";

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    // Gesture handlers (vehicle gallery, advisor panel) only work under this root view.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SubscriptionProvider>
        <UserSettingsProvider>
          <ThemeProvider>
            <DealerNotificationsProvider>
              <VehicleHistoryProvider>

                {/* ⭐ Global UI Overlays */}
                <DealerBanner />
                <ProBadgeOverlay />
                <GoldFlashOverlayWrapper />

                <ThemedStack />

              </VehicleHistoryProvider>
            </DealerNotificationsProvider>
          </ThemeProvider>
        </UserSettingsProvider>
      </SubscriptionProvider>
    </GestureHandlerRootView>
  );
}

function GoldFlashOverlayWrapper() {
  const { flashTrigger } = useVehicleHistory();

  return (
    <>
      <GoldFlashOverlay trigger={flashTrigger} />
      <GoldConfetti trigger={flashTrigger} />
      <GoldLightning trigger={flashTrigger} />
    </>
  );
}

// A route with no title falls back to its file path in the header ("flip/[id]").
// Screens declared below set their own; everything else gets a name from here.
const SCREEN_TITLES: Record<string, string> = {
  rate: "Rate FlipPilot",
  "weather/index": "Weather",
  "settings/index": "Settings",
  "feature/[slug]": "Feature",
  "scan/scan-results": "Scan result",
  "flip/[id]": "Flip details",
  "mot/[id]": "MOT history",
  "messages/index": "Messages",
  "messages/[id]": "Message seller",
  bootfairs: "Bootfairs & Events",
  vehicles: "Vehicles",
  "marketplace/index": "Marketplace",
  "marketplace/MarketplaceHub": "Marketplace",
  "marketplace/Listings": "Listings",
  "marketplace/[id]": "Listing",
  "marketplace/PublicListing": "Listing",
  "marketplace/PublishFlip": "Publish flip",
  "marketplace/my-listings": "My listings",
  "marketplace/create/index": "Create listing",
  "marketplace/create/new": "Create listing",
  "motors/hub": "Motors",
  "motors/dashboard": "Dashboard",
  "motors/analytics": "Analytics",
  "motors/listings": "Listings",
  "motors/mot-alerts": "MOT alerts",
  "motors/notifications": "Notifications",
  "motors/vehicle-detail": "Vehicle",
  "motors/edit-vehicle": "Edit vehicle",
  "motors/gallery/[id]": "Gallery",
};

function ThemedStack() {
  const theme = useTheme();

  // The app is dark-only. Give the native root view and the navigator the same
  // background so nothing flashes white while a screen mounts or a transition runs.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

  const navigationTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: theme.gold,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: "rgba(255, 255, 255, 0.08)",
      notification: theme.gold,
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={({ route }) => ({
          title: SCREEN_TITLES[route.name],
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.gold,
          headerTitleStyle: { fontWeight: "700", fontSize: 17, color: theme.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: theme.background },
        })}
      >
        {/* Core */}
        <Stack.Screen name="index" options={{ headerShown: false }} />

        {/* Tabs: this loads app/(tabs)/_layout.tsx */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Adult + terms confirmation, shown once before the app is usable */}
        <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />

        {/* Core non-tab screens */}
        <Stack.Screen name="ai-camera" options={{ headerShown: false }} />
        <Stack.Screen name="upgrade" options={{ title: "Upgrade" }} />
        <Stack.Screen name="manage-subscription" options={{ title: "Manage Subscription" }} />
        <Stack.Screen name="pro-success" options={{ headerShown: false }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

function ProBadgeOverlay() {
  return (
    <View
      style={{
        position: "absolute",
        top: 50,
        right: 20,
        zIndex: 999,
        pointerEvents: "none",
      }}
    >
      <ProBadge />
    </View>
  );
}
