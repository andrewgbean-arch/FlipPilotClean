import { Stack, router, useLocalSearchParams } from "expo-router";
import { BookOpen } from "phosphor-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GUIDES, guideBySlug } from "@/content/guides";
import { useTheme } from "@/styles/ThemeContext";

// One of the flipping guides from the Explore tab (src/content/guides.ts).
export default function GuideScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const guide = guideBySlug(slug);

  if (!guide) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.background }]}>
        <Text style={[styles.body, { color: theme.text, textAlign: "center" }]}>{"That guide isn't here any more."}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backLink}>
          <Text style={[styles.body, { color: theme.gold, fontWeight: "700" }]}>Back to Explore</Text>
        </Pressable>
      </View>
    );
  }

  const others = GUIDES.filter((g) => g.slug !== guide.slug);
  const next = others[GUIDES.indexOf(guide) % others.length];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 40 }]}
    >
      <Stack.Screen options={{ title: guide.title }} />

      <View style={[styles.iconBadge, { backgroundColor: theme.card, borderColor: theme.goldSoftGlow }]}>
        <BookOpen size={30} color={theme.gold} />
      </View>
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        {guide.title}
      </Text>
      <Text style={[styles.meta, { color: theme.muted }]}>{guide.minutes} minute read</Text>
      <Text style={[styles.intro, { color: theme.text }]}>{guide.intro}</Text>

      {guide.sections.map((section, i) => (
        <View key={i} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          {section.heading ? (
            <Text style={[styles.heading, { color: theme.gold }]} accessibilityRole="header">
              {section.heading}
            </Text>
          ) : null}
          {(section.paragraphs ?? []).map((p, j) => (
            <Text key={`p${j}`} style={[styles.body, { color: theme.text }]}>
              {p}
            </Text>
          ))}
          {(section.bullets ?? []).map((b, j) => (
            <View key={`b${j}`} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: theme.gold }]} />
              <Text style={[styles.body, styles.bulletText, { color: theme.text }]}>{b}</Text>
            </View>
          ))}
        </View>
      ))}

      {next ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Next guide: ${next.title}`}
          onPress={() => router.replace({ pathname: "/guide/[slug]", params: { slug: next.slug } })}
          style={({ pressed }) => [styles.next, { backgroundColor: theme.card, borderColor: theme.hairline }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.nextLabel, { color: theme.muted }]}>Next guide</Text>
          <Text style={[styles.nextTitle, { color: theme.text }]}>{next.title}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  backLink: { minHeight: 44, justifyContent: "center" },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center" },
  meta: { fontSize: 13, textAlign: "center", marginTop: -6 },
  intro: { fontSize: 17, lineHeight: 25, marginTop: 4, marginBottom: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 10 },
  heading: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 24 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  bulletText: { flex: 1 },
  next: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 8, gap: 2 },
  nextLabel: { fontSize: 13 },
  nextTitle: { fontSize: 17, fontWeight: "700" },
});
