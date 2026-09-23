import React, { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LEGAL, MINIMUM_AGE } from "@/constants/legal";
import { useTheme } from "@/styles/ThemeContext";
import { recordLegalAcceptance } from "@/utils/legalConsent";

/**
 * Shown once, before the app can be used: the person confirms they are an adult
 * and agrees to the terms, and is told plainly the three things that are not
 * obvious from the screens: photos go to an AI service, prices are estimates,
 * and the marketplace is people dealing with each other.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [underAge, setUnderAge] = useState(false);

  const openLink = (url: string, what: string) => {
    if (!url) {
      Alert.alert(`${what} isn't set up in this build`, "It has to be published before the app is released.");
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert("Couldn't open the link", url));
  };

  const agree = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await recordLegalAcceptance();
      router.replace("/home");
    } catch {
      setSaving(false);
      Alert.alert("Couldn't save that", "Please try again.");
    }
  };

  const points = [
    ["Prices are estimates.", "They come from public listings and an AI's best guess. They are guidance, not a valuation or advice."],
    ["Photos are analysed by AI.", "When you scan with a photo, it is sent to an AI service (OpenAI) to work out what the item is."],
    ["The marketplace is people dealing directly.", "FlipPilot doesn't handle payments or check items. Meet in public and never pay in advance."],
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={[styles.title, { color: theme.gold }]}>Before you start</Text>
        <Text style={[styles.lead, { color: theme.text }]}>
          FlipPilot helps you price, buy and sell second-hand items. Three things worth knowing:
        </Text>

        {points.map(([head, body]) => (
          <View key={head} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
            <Text style={[styles.cardHead, { color: theme.text }]}>{head}</Text>
            <Text style={[styles.cardBody, { color: theme.muted }]}>{body}</Text>
          </View>
        ))}

        <Text style={[styles.legal, { color: theme.muted }]}>
          By continuing you confirm you are {MINIMUM_AGE} or over and agree to our{" "}
          <Text style={{ color: theme.gold }} onPress={() => openLink(LEGAL.termsUrl, "The terms of use")}>
            Terms of Use
          </Text>{" "}
          and{" "}
          <Text style={{ color: theme.gold }} onPress={() => openLink(LEGAL.privacyPolicyUrl, "The privacy policy")}>
            Privacy Policy
          </Text>
          .
        </Text>

        {underAge && (
          <Text style={[styles.underAge, { color: theme.danger }]}>
            FlipPilot is for adults, so you can't use it yet. Please close the app.
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={agree}
          disabled={saving || underAge}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.gold, opacity: saving || underAge ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={{ color: theme.black, fontWeight: "800", fontSize: 16 }}>
            I'm {MINIMUM_AGE} or over, and I agree
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setUnderAge(true)}
          style={styles.secondary}
        >
          <Text style={{ color: theme.muted, fontWeight: "700" }}>I'm under {MINIMUM_AGE}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  lead: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardHead: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  cardBody: { fontSize: 13, lineHeight: 19 },
  legal: { fontSize: 13, lineHeight: 20, marginTop: 14, marginBottom: 18 },
  underAge: { fontSize: 14, fontWeight: "700", marginBottom: 14 },
  primary: { alignItems: "center", paddingVertical: 15, borderRadius: 14 },
  secondary: { alignItems: "center", paddingVertical: 16 },
});
