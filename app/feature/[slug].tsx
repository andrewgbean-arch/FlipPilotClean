import { useLocalSearchParams, router } from "expo-router";
import { ScrollView, Text, View, Pressable, StyleSheet } from "react-native";

import { useTheme } from "@/styles/useTheme";

export default function FeatureDetailScreen() {
  const { slug, content, icon } = useLocalSearchParams<{
    slug: string;
    content: string;
    icon: string;
  }>();
  const theme = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={{ color: theme.accent, fontWeight: "900" }}>← Back</Text>
      </Pressable>

      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.title, { color: theme.accent }]}>{slug}</Text>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.goldDeep },
        ]}
      >
        <Text style={[styles.content, { color: theme.text }]}>{content}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 60,
  },
  backBtn: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 3,
    padding: 20,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
});
