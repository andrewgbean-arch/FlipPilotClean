import { version } from "expo/package.json";
import { Image } from "expo-image";
import { useColorScheme, StyleSheet } from "react-native";

import ThemedText from "../styles/theme/ThemedText";
import ThemedView from "../styles/theme/ThemedView";

// local text variant
const textVariants = StyleSheet.create({
  small: { fontSize: 13, opacity: 0.75 },
});

export function WebBadge() {
  const scheme = useColorScheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={[textVariants.small, styles.versionText]}>
        v{version}
      </ThemedText>

      <Image
        source={
          scheme === "dark"
            ? require("../assets/images/expo-badge-white.png")
            : require("../assets/images/expo-badge.png")
        }
        style={styles.badgeImage}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  versionText: {
    textAlign: "center",
  },
  badgeImage: {
    width: 123,
    aspectRatio: 123 / 24,
  },
});
