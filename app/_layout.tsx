import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";

import DealerBanner from "../src/components/DealerBanner";
import ProBadge from "../src/components/ProBadge";

import { SubscriptionProvider } from "../src/context/SubscriptionContext";
import { ThemeProvider, useTheme } from "../src/styles/ThemeContext";

import { VehicleHistoryProvider, useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipHistoryProvider } from "@/context/FlipHistoryContext";

// ✔ REAL Dealer Mode Provider
import { UserSettingsProvider } from "@/features/settings/UserSettingsContext";

// Dealer Notifications
import { DealerNotificationsProvider } from "@/features/vehicles/context/DealerNotificationsContext";

// Dealer AI
import { DealerAIProvider } from "@/features/dealer-ai/DealerAIContext";

// Gold Flash Overlay
import GoldFlashOverlay from "@/components/ui/GoldFlashOverlay";

// ⭐ Gold Confetti Overlay
import GoldConfetti from "@/components/ui/GoldConfetti";

// ⭐ Gold Lightning Flash (milestone accent)
import GoldLightning from "@/components/ui/GoldLightning";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SubscriptionProvider>
      <UserSettingsProvider>
        <DealerAIProvider>
          <ThemeProvider>
            <DealerNotificationsProvider>
              <FlipHistoryProvider>
                <VehicleHistoryProvider>

                  {/* ⭐ Global UI Overlays */}
                  <DealerBanner />
                  <ProBadgeOverlay />
                  <GoldFlashOverlayWrapper />

                  <ThemedStack />

                </VehicleHistoryProvider>
              </FlipHistoryProvider>
            </DealerNotificationsProvider>
          </ThemeProvider>
        </DealerAIProvider>
      </UserSettingsProvider>
    </SubscriptionProvider>
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

function ThemedStack() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.accent,
        headerTitleStyle: { fontWeight: "800", color: theme.text },
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      {/* Core */}
      <Stack.Screen name="index" options={{ headerShown: false }} />

      {/* ⭐ Tabs — this loads app/(tabs)/_layout.tsx */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Core non-tab screens */}
      <Stack.Screen name="ai-camera" options={{ headerShown: false }} />
      <Stack.Screen name="upgrade" options={{ title: "Upgrade" }} />
      <Stack.Screen name="manage-subscription" options={{ title: "Manage Subscription" }} />
      <Stack.Screen name="pro-success" options={{ headerShown: false }} />

      {/* ❌ DO NOT manually register dealer or finance screens here */}
      {/* Expo Router will auto-load everything inside /app/dealer and /app/dealer/finance */}
    </Stack>
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
