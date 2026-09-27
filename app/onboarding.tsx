import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Barcode, Car, SpeakerHigh, SpeakerSlash, Storefront, Trophy } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";

import { useTheme } from "@/styles/ThemeContext";
import GoldFoil from "@/components/ui/GoldFoil";
import { isNarrationMuted, markOnboardingSeen, setNarrationMuted } from "@/utils/onboarding";
import { speakLine, stopSpeaking } from "@/utils/voice";

/**
 * Shown once, right after the age/terms screen: a short, skippable tour of what FlipPilot
 * actually does, since a first-time person otherwise lands straight on Home with six tabs and
 * no explanation. Narrated by the phone's own voice (free — no ElevenLabs credits are needed
 * here; that's kept for the paid business app), muted with one tap if it's not wanted.
 */

type Step = { Icon: PhosphorIcon; title: string; body: string; say: string };

const STEPS: Step[] = [
  {
    Icon: Barcode,
    title: "Scan to see what it's worth",
    body: "Point the camera at a barcode, or take a photo of anything else. FlipPilot works out what it is and a fair price to buy and sell it for.",
    say: "Point the camera at a barcode, or take a photo of anything else, and FlipPilot works out what it's worth.",
  },
  {
    Icon: Trophy,
    title: "Keep track of your flips",
    body: "Save what you scan, and it's there in History. Star your best finds in Favourites so you don't lose them in the list.",
    say: "Save what you scan, and it's there in your History, with your favourites starred so they're easy to find again.",
  },
  {
    Icon: Storefront,
    title: "Buy and sell nearby",
    body: "The Marketplace is people in your area buying and selling directly. List something in a minute, or message a seller about theirs.",
    say: "The Marketplace is people nearby buying and selling directly with each other, right from the app.",
  },
  {
    Icon: Car,
    title: "Checking a car? Get its MOT history",
    body: "Look up a registration to see its full MOT record, mileage history and advisories, before you buy or sell it.",
    say: "If you're looking at a car, look up its registration to see its full MOT history and mileage before you buy.",
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);

  // The mute preference is read once; toggling it during the tour updates both the screen and storage.
  useEffect(() => {
    isNarrationMuted().then(setMuted);
  }, []);

  useEffect(() => {
    stopSpeaking();
    if (!muted) speakLine(STEPS[index].say);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, muted]);

  const finish = () => {
    stopSpeaking();
    markOnboardingSeen();
    router.replace("/home");
  };

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    scrollRef.current?.scrollTo({ x: clamped * SCREEN_WIDTH, animated: true });
    setIndex(clamped);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setNarrationMuted(next);
    if (next) stopSpeaking();
    else speakLine(STEPS[index].say);
  };

  const isLast = index === STEPS.length - 1;
  const step = useMemo(() => STEPS[index], [index]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topRow, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? "Turn narration on" : "Turn narration off"}
          hitSlop={10}
          onPress={toggleMute}
          style={[styles.iconButton, { backgroundColor: theme.card, borderColor: theme.hairline }]}
        >
          {muted ? (
            <SpeakerSlash size={20} color={theme.muted} />
          ) : (
            <SpeakerHigh size={20} color={theme.gold} />
          )}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={finish} hitSlop={10}>
          <Text style={[styles.skip, { color: theme.muted }]}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (next !== index) setIndex(next);
        }}
        style={{ flex: 1 }}
      >
        {STEPS.map((s, i) => (
          <View key={s.title} style={[styles.page, { width: SCREEN_WIDTH }]}>
            <View style={[styles.iconCircle, { backgroundColor: theme.card, borderColor: theme.goldDeep }]}>
              <s.Icon size={48} color={theme.gold} weight="fill" />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>{s.title}</Text>
            <Text style={[styles.body, { color: theme.muted }]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View
              key={s.title}
              style={[
                styles.dot,
                { backgroundColor: i === index ? theme.gold : theme.hairline },
              ]}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? "Get started" : "Next"}
          onPress={() => (isLast ? finish() : goTo(index + 1))}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.gold, overflow: "hidden", opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <GoldFoil />
          <Text style={{ color: theme.black, fontWeight: "800", fontSize: 16 }}>
            {isLast ? "Get started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skip: { fontSize: 15, fontWeight: "700" },
  page: {
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  bottom: { paddingHorizontal: 20, paddingTop: 8 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  primary: { alignItems: "center", paddingVertical: 16, borderRadius: 14 },
});
