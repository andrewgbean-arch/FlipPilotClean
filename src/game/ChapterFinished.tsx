import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, DownloadSimple, Lock, LockOpen, Play, Trash } from "phosphor-react-native";

import { CHAPTERS, GAME_PAGES, type Chapter } from "./nightglass";
import { DOWNLOADS_AVAILABLE, useChapterDownloads } from "./nightglassDownloads";
import { confirmUnlock, isUnlocked, useSeasonProgress, whenUnlocks } from "./nightglassUnlocks";

const INK = "#05080d";
const CARD = "#0d131b";
const BONE = "#efe4cc";
const AMBER = "#f0b35b";
const MUTED = "rgba(239,228,204,0.62)";
const SERIF = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" });

/**
 * Shown over the game when the player reaches the end of a chapter: the way on to the next chapter
 * (play it, download it, or when it unlocks and how to have it now), and whether to keep the chapter
 * they have just finished on the phone or free the space. Any chapter can be downloaded again later.
 */
export default function ChapterFinished({ ch, onStay }: { ch: Chapter; onStay: () => void }) {
  const insets = useSafeAreaInsets();
  const downloads = useChapterDownloads();
  const season = useSeasonProgress();
  const [choice, setChoice] = useState<"kept" | "removed" | null>(null);

  const next = CHAPTERS.find((c) => c.id === ch.id + 1);
  const onPhone = (c: Chapter) => !!GAME_PAGES[c.id] || downloads.versions[c.id] !== undefined;
  const finishedDownloaded = !GAME_PAGES[ch.id] && downloads.versions[ch.id] !== undefined;

  const playNext = (c: Chapter) => router.replace({ pathname: "/nightglass-play", params: { chapter: String(c.id) } });
  const unlockNext = async (c: Chapter) => {
    const cost = season.progress?.signedIn ? season.progress.unlockCredits : 25;
    const p = await confirmUnlock(c, cost);
    if (!p) return;
    season.setProgress(p);
    if (DOWNLOADS_AVAILABLE && c.download && !onPhone(c)) downloads.download(c);
  };
  const remove = () =>
    Alert.alert(
      `Remove Chapter ${ch.number}?`,
      `This frees about ${ch.download?.mb ?? 0} MB. You can download it again at any time to revisit it, and your progress is kept.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await downloads.remove(ch);
            setChoice("removed");
          },
        },
      ]
    );

  return (
    <View style={[styles.cover, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <CheckCircle size={44} color={AMBER} weight="fill" />
        <Text style={styles.kicker}>CHAPTER {ch.number.toUpperCase()} COMPLETE</Text>
        <Text style={styles.title}>{ch.place}</Text>
        <Text style={styles.body}>Mission accomplished. For now.</Text>

        {next ? (
          <View style={styles.card}>
            <Text style={styles.cardKicker}>NEXT: CHAPTER {next.number.toUpperCase()}</Text>
            <Text style={styles.cardTitle}>{next.place}</Text>
            <NextStep
              next={next}
              onPhone={onPhone(next)}
              unlocked={!!next.comingLabel ? __DEV__ : isUnlocked(season.progress, next.id)}
              season={season}
              downloads={downloads}
              onPlay={() => playNext(next)}
              onUnlock={() => unlockNext(next)}
            />
          </View>
        ) : (
          <Text style={styles.body}>{"That's the season so far. The next chapter is on its way."}</Text>
        )}

        {finishedDownloaded && !choice && (
          <View style={styles.card}>
            <Text style={styles.cardKicker}>CHAPTER {ch.number.toUpperCase()} ON THIS PHONE</Text>
            <Text style={styles.body}>Keep it to play again, or remove it to free up about {ch.download?.mb ?? 0} MB.</Text>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={() => setChoice("kept")} style={({ pressed }) => [styles.halfBtn, pressed && styles.pressed]}>
                <Text style={styles.outlineText}>Keep it</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={remove} style={({ pressed }) => [styles.halfBtn, styles.mutedBtn, pressed && styles.pressed]}>
                <Trash size={18} color={MUTED} />
                <Text style={styles.mutedText}>Remove it</Text>
              </Pressable>
            </View>
          </View>
        )}
        {choice === "removed" && <Text style={styles.body}>Chapter {ch.number} has been removed from this phone.</Text>}
        {choice === "kept" && <Text style={styles.body}>Chapter {ch.number} stays on this phone.</Text>}
        {!GAME_PAGES[ch.id] && (
          <Text style={styles.note}>You can download any chapter again at any time to revisit it. Your progress is kept.</Text>
        )}

        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
          <Text style={styles.linkText}>Back to the chapters</Text>
        </Pressable>
        {choice !== "removed" && (
          <Pressable accessibilityRole="button" onPress={onStay} style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}>
            <Text style={styles.linkMuted}>Stay on the title screen</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

type NextProps = {
  next: Chapter;
  onPhone: boolean;
  unlocked: boolean;
  season: ReturnType<typeof useSeasonProgress>;
  downloads: ReturnType<typeof useChapterDownloads>;
  onPlay: () => void;
  onUnlock: () => void;
};

function NextStep({ next, onPhone, unlocked, season, downloads, onPlay, onUnlock }: NextProps) {
  const progress = downloads.progress[next.id];
  const error = downloads.errors[next.id];
  const line = (text: string) => (
    <View style={styles.row}>
      <Lock size={18} color={MUTED} />
      <Text style={[styles.body, styles.flex]}>{text}</Text>
    </View>
  );

  if (next.comingLabel && !__DEV__) return line(`On its way: ${next.comingLabel.toLowerCase()}.`);
  if (onPhone && (unlocked || !next.comingLabel)) {
    return (
      <Pressable accessibilityRole="button" onPress={onPlay} style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}>
        <Play size={20} color={INK} weight="fill" />
        <Text style={styles.playText}>Play Chapter {next.number}</Text>
      </Pressable>
    );
  }
  if (unlocked) {
    if (progress !== undefined) {
      return (
        <View style={styles.progressBox}>
          <Text style={styles.body}>Downloading… {Math.round(progress * 100)}%</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(3, progress * 100)}%` }]} />
          </View>
        </View>
      );
    }
    if (Platform.OS === "web") {
      return (
        <Pressable accessibilityRole="button" onPress={onPlay} style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}>
          <Play size={20} color={INK} weight="fill" />
          <Text style={styles.playText}>Play Chapter {next.number}</Text>
        </Pressable>
      );
    }
    if (!next.download || !DOWNLOADS_AVAILABLE) return line("Chapters can't be downloaded in this version of the app.");
    return (
      <>
        <Pressable accessibilityRole="button" onPress={() => downloads.download(next)} style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}>
          <DownloadSimple size={20} color={INK} weight="bold" />
          <Text style={styles.playText}>Download Chapter {next.number} ({next.download.mb} MB)</Text>
        </Pressable>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </>
    );
  }

  const p = season.progress;
  if (!p) return line(season.loaded ? "Connect to the internet to see when it unlocks." : "Checking…");
  if (!p.signedIn) {
    return (
      <>
        {line("Sign in to unlock a new chapter every four weeks.")}
        <Pressable accessibilityRole="button" onPress={() => router.push("/sign-in")} style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}>
          <Text style={styles.outlineText}>Sign in</Text>
        </Pressable>
      </>
    );
  }
  if (p.next?.chapter !== next.id) return line("It unlocks after the chapters before it.");
  return (
    <>
      {line(`Unlocks by itself ${whenUnlocks(p.next.unlocksAt)}.`)}
      <Pressable accessibilityRole="button" onPress={onUnlock} style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}>
        <LockOpen size={20} color={INK} weight="bold" />
        <Text style={styles.playText}>Unlock now · {p.unlockCredits} credits</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(5,8,13,0.97)" },
  content: { paddingHorizontal: 22, gap: 14, alignItems: "stretch" },
  kicker: { color: AMBER, fontSize: 13, fontWeight: "800", letterSpacing: 3 },
  title: { color: BONE, fontFamily: SERIF, fontStyle: "italic", fontWeight: "700", fontSize: 38 },
  body: { color: MUTED, fontSize: 15, lineHeight: 22 },
  note: { color: MUTED, fontSize: 13, lineHeight: 19, textAlign: "center" },
  card: { backgroundColor: CARD, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: "rgba(240,179,91,0.28)" },
  cardKicker: { color: AMBER, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  cardTitle: { color: BONE, fontFamily: SERIF, fontSize: 26, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  flex: { flex: 1 },
  playBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: AMBER, borderRadius: 999, paddingVertical: 14 },
  playText: { color: INK, fontSize: 16, fontWeight: "900" },
  outlineBtn: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: AMBER, borderRadius: 999, paddingVertical: 12 },
  outlineText: { color: AMBER, fontSize: 16, fontWeight: "800" },
  halfBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 999,
    paddingVertical: 12,
  },
  mutedBtn: { borderColor: "rgba(239,228,204,0.3)" },
  mutedText: { color: MUTED, fontSize: 16, fontWeight: "700" },
  progressBox: { gap: 8 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(239,228,204,0.12)", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: AMBER },
  error: { color: "#ff9a8a", fontSize: 14, lineHeight: 20 },
  linkBtn: { alignItems: "center", paddingVertical: 10 },
  linkText: { color: AMBER, fontSize: 16, fontWeight: "800" },
  linkMuted: { color: MUTED, fontSize: 15 },
  pressed: { opacity: 0.8 },
});
