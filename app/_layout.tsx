import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import ProBadge from "../src/components/ProBadge";
import { FlipHistoryProvider } from "../src/context/FlipHistoryContext";
import { SubscriptionProvider } from "../src/context/SubscriptionContext";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";


SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SubscriptionProvider>
      <ThemeProvider>
        <FlipHistoryProvider>
          <ProBadgeOverlay />
          <ThemedStack />
        </FlipHistoryProvider>
      </ThemeProvider>
    </SubscriptionProvider>
  );
}

function ThemedStack() {
  const theme = useTheme();

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.accent,
        headerTitleStyle: { fontWeight: "800", color: theme.text },
        contentStyle: { backgroundColor: theme.background },
      }}
    >
   
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(market)" options={{ headerShown: false }} />
      <Stack.Screen name="ai-camera" options={{ headerShown: false }} />
      <Stack.Screen name="upgrade" options={{ title: "Upgrade" }} />
      <Stack.Screen name="manage-subscription" options={{ title: "Manage Subscription" }} />
      <Stack.Screen name="pro-success" options={{ headerShown: false }} />
    </Stack>
  );
}

import { View } from "react-native";

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

