import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeviceRotate, HandTap, Headphones, Lock, Play } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";

import { CHAPTERS } from "@/game/nightglass";

// A fixed noir palette, like the game's own title screen: it is the same in
// light and dark mode on purpose.
const INK = "#05080d";
const CARD = "#0d131b";
const BONE = "#efe4cc";
const AMBER = "#f0b35b";
const MUTED = "rgba(239,228,204,0.62)";
const SERIF = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" });

export default function NightglassScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>OPERATION</Text>
        <Text style={styles.title} accessibilityRole="header">
          Nightglass
        </Text>
        <View style={styles.rule} />
        <Text style={styles.tagline}>Vienna, 1987. One night. One microfilm. No second chances.</Text>
        <Text style={styles.meta}>A fully voiced spy adventure · a new chapter every month</Text>
      </View>

      {CHAPTERS.map((ch) => {
        const locked = !!ch.comingLabel;
        return (
          <View key={ch.number} style={[styles.card, locked && styles.cardLocked]}>
            <View style={styles.cardHead}>
              <Text style={styles.chapterNo}>CHAPTER {ch.number.toUpperCase()}</Text>
              <Text style={[styles.badge, locked ? styles.badgeLocked : styles.badgeLive]}>{locked ? ch.comingLabel : "Out now"}</Text>
            </View>
            <Text style={styles.place}>{ch.place}</Text>
            <Text style={styles.blurb}>{ch.blurb}</Text>
            {locked ? (
              <View style={styles.lockedRow}>
                <Lock size={18} color={MUTED} />
                <Text style={styles.lockedText}>Unlocks on release day</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play chapter ${ch.number}, ${ch.place}`}
                onPress={() => router.push("/nightglass-play")}
                style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
              >
                <Play size={20} color={INK} weight="fill" />
                <Text style={styles.playText}>Play Chapter {ch.number}</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      <View style={styles.tips}>
        <Tip Icon={DeviceRotate} text="Turn your phone sideways" />
        <Tip Icon={HandTap} text="Tap to act, hold to examine" />
        <Tip Icon={Headphones} text="Best with headphones" />
      </View>
      <Text style={styles.footnote}>Plays offline. Your progress is saved on this phone, so you can stop and carry on later.</Text>
    </ScrollView>
  );
}

function Tip({ Icon, text }: { Icon: PhosphorIcon; text: string }) {
  return (
    <View style={styles.tip}>
      <Icon size={22} color={AMBER} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: INK },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },

  hero: { paddingVertical: 20 },
  kicker: { color: AMBER, fontSize: 14, fontWeight: "700", letterSpacing: 6 },
  title: { color: BONE, fontFamily: SERIF, fontStyle: "italic", fontWeight: "700", fontSize: 54, lineHeight: 62 },
  rule: { width: 48, height: 2, backgroundColor: AMBER, marginVertical: 12, opacity: 0.8 },
  tagline: { color: BONE, fontSize: 16, lineHeight: 23 },
  meta: { color: MUTED, fontSize: 13, marginTop: 6 },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(240,179,91,0.28)",
  },
  cardLocked: { borderColor: "rgba(239,228,204,0.12)" },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  chapterNo: { color: AMBER, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  badge: { fontSize: 11, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  badgeLive: { color: INK, backgroundColor: AMBER },
  badgeLocked: { color: MUTED, backgroundColor: "rgba(239,228,204,0.1)" },
  place: { color: BONE, fontFamily: SERIF, fontSize: 28, fontWeight: "700" },
  blurb: { color: MUTED, fontSize: 15, lineHeight: 22 },

  playBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: AMBER,
    borderRadius: 999,
    paddingVertical: 14,
  },
  playText: { color: INK, fontSize: 17, fontWeight: "900" },
  pressed: { opacity: 0.8 },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  lockedText: { color: MUTED, fontSize: 14 },

  tips: { flexDirection: "row", gap: 10, marginTop: 4 },
  tip: { flex: 1, alignItems: "center", gap: 6, backgroundColor: CARD, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6 },
  tipText: { color: MUTED, fontSize: 12, textAlign: "center", lineHeight: 16 },
  footnote: { color: MUTED, fontSize: 12, textAlign: "center" },
});
