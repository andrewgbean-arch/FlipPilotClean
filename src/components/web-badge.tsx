import { version } from "expo/package.json";
import { Image } from "expo-image";
import { useColorScheme, StyleSheet, View, Text } from "react-native";

const textVariants = StyleSheet.create({
  small: { fontSize: 13, opacity: 0.75 },
});

export function WebBadge() {
  const scheme = useColorScheme();

  return (
    <View style={styles.container}>
      <Text style={[textVariants.small, styles.versionText]}>
        v{version}
      </Text>

      <Image
        source={
          scheme === "dark"
            ? require("../assets/images/expo-badge-white.png")
            : require("../assets/images/expo-badge.png")
        }
        style={styles.badgeImage}
      />
    </View>
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
    fontWeight: "600",
  },
  badgeImage: {
    width: 123,
    aspectRatio: 123 / 24,
  },
});
