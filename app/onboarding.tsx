import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SpeakerHigh, SpeakerSlash } from "phosphor-react-native";

import { useTheme } from "@/styles/ThemeContext";
import GoldFoil from "@/components/ui/GoldFoil";
import { isNarrationMuted, setNarrationMuted } from "@/utils/onboarding";
import { startTour } from "@/features/tour/TourContext";

/**
 * Shown once, right after the age/terms screen: a brief branded moment before handing off into
 * the real guided walkthrough (see src/features/tour/) — narration plays while the tour actually
 * navigates through the live app and spotlights the real buttons, rather than describing them on
 * static slides. This screen itself no longer shows the 4-slide summary that used to live here;
 * markOnboardingSeen() is now set by the tour itself (skipTour()/finishing it), not by reaching
 * this card, so quitting before the tour finishes still shows it again next launch.
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    isNarrationMuted().then(setMuted);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setNarrationMuted(next);
  };

  const begin = () => {
    router.replace("/home");
    startTour();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? "Turn narration on" : "Turn narration off"}
        hitSlop={10}
        onPress={toggleMute}
        style={[
          styles.muteButton,
          { top: insets.top + 12, backgroundColor: theme.card, borderColor: theme.hairline },
        ]}
      >
        {muted ? <SpeakerSlash size={20} color={theme.muted} /> : <SpeakerHigh size={20} color={theme.gold} />}
      </Pressable>

      <View style={styles.center}>
        <View style={[styles.logoCircle, { backgroundColor: theme.card, borderColor: theme.goldDeep }]}>
          <Text style={[styles.logoText, { color: theme.gold }]}>FP</Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Let's show you around</Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          A quick guided tour of the real screens — scanning, your flips, the Marketplace and
          checking a car. Skippable any time, and you can watch it again later from Settings.
        </Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start the tour"
          onPress={begin}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.gold, overflow: "hidden", opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <GoldFoil />
          <Text style={{ color: theme.black, fontWeight: "800", fontSize: 16 }}>Start the tour</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/home")} hitSlop={10}>
          <Text style={[styles.skip, { color: theme.muted }]}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between" },
  muteButton: {
    position: "absolute",
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logoCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  logoText: { fontSize: 40, fontWeight: "800" },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  bottom: { paddingHorizontal: 20, paddingTop: 8, alignItems: "center", gap: 16 },
  primary: { alignItems: "center", paddingVertical: 16, borderRadius: 14, width: "100%" },
  skip: { fontSize: 15, fontWeight: "700" },
});
