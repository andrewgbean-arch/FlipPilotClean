import { useTheme } from "../../src/context/ThemeContext";
import { Stack } from "expo-router";

export default function MarketLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.accent,
        headerTitleStyle: { fontWeight: "800", color: theme.text },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Market Lookup" }}
      />
    </Stack>
  );
}


