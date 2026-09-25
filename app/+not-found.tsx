import { Stack, router } from "expo-router";
import GoldFoil from "@/components/ui/GoldFoil";
import { Compass } from "phosphor-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/styles/useTheme";

export default function NotFoundScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <Compass size={32} color={theme.gold} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Page not found</Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          That screen doesn't exist or has moved.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          style={({ pressed }) => [styles.button, { backgroundColor: theme.gold, overflow: "hidden" }, pressed && styles.pressed]}
          onPress={() => router.replace("/home")}
        >
          <GoldFoil />
          <Text style={[styles.buttonText, { color: theme.black }]}>Back to home</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    minWidth: 220,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
});
