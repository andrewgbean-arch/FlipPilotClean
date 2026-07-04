import { Image } from "expo-image";
import { Platform, StyleSheet, ScrollView } from "react-native";
import { Link } from "expo-router";

import ThemedText from "../../src/components/ThemedText";
import ThemedView from "../../src/components/ThemedView";

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">FlipPilot</ThemedText>
        <ThemedText type="subtitle">Your flipping companion</ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">Quick Start</ThemedText>
        <ThemedText>
          Edit{" "}
          <ThemedText type="smallBold">app/(tabs)/index.tsx</ThemedText> to see changes.
        </ThemedText>

        <ThemedText>
          Press{" "}
          <ThemedText type="smallBold">
            {Platform.select({
              ios: "cmd + d",
              android: "cmd + m",
              web: "F12",
            })}
          </ThemedText>{" "}
          to open developer tools.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">Explore</ThemedText>

        <Link href="/modal">
          <ThemedText type="linkPrimary">Open Modal</ThemedText>
        </Link>

        <ThemedText>
          Tap the Explore tab to learn more about what's included in this starter app.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">Reset Project</ThemedText>
        <ThemedText>
          Run{" "}
          <ThemedText type="smallBold">npm run reset-project</ThemedText> to get a fresh{" "}
          <ThemedText type="smallBold">app</ThemedText> directory.
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 20,
  },
  header: {
    gap: 4,
  },
  card: {
    gap: 8,
    marginBottom: 8,
  },
});

