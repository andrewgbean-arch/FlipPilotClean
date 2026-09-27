import React from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowClockwise, DeviceRotate, DownloadSimple, HandTap, Headphones, Lock, LockOpen, Play, Trash } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";

import { CHAPTERS, GAME_PAGES, type Chapter } from "@/game/nightglass";
import { DOWNLOADS_AVAILABLE, useChapterDownloads } from "@/game/nightglassDownloads";
import { confirmUnlock, isUnlocked, useSeasonProgress, whenUnlocks, type SeasonProgress } from "@/game/nightglassUnlocks";

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
  const downloads = useChapterDownloads();
  const season = useSeasonProgress();

  const onPhone = (ch: Chapter) => !!GAME_PAGES[ch.id] || downloads.versions[ch.id] !== undefined;
  // A chapter can be played once it is out and the player has unlocked it (one already on the phone
  // stays playable offline), or before release day in a development build.
  const available = (ch: Chapter) => (ch.comingLabel ? __DEV__ : isUnlocked(season.progress, ch.id) || onPhone(ch));

  const unlock = async (ch: Chapter) => {
    const cost = season.progress?.signedIn ? season.progress.unlockCredits : 25;
    const next = await confirmUnlock(ch, cost);
    if (!next) return;
    season.setProgress(next);
    if (DOWNLOADS_AVAILABLE && ch.download && !onPhone(ch)) downloads.download(ch);
  };
  const toFetch = CHAPTERS.filter((ch) => ch.download && available(ch) && !onPhone(ch) && downloads.progress[ch.id] === undefined);
  const fetchMb = toFetch.reduce((sum, ch) => sum + (ch.download?.mb ?? 0), 0);

  const downloadAll = async () => {
    for (const ch of toFetch) await downloads.download(ch);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>OPERATION</Text>
        <Text style={styles.title} accessibilityRole="header">
          Nightglass
        </Text>
        <View style={styles.rule} />
        <Text style={styles.tagline}>Vienna, 1987. One night. One microfilm. No second chances.</Text>
        <Text style={styles.meta}>A fully voiced spy adventure · a new chapter every four weeks</Text>
      </View>

      {DOWNLOADS_AVAILABLE && toFetch.length > 1 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Download all ${toFetch.length} chapters, ${fetchMb.toFixed(0)} megabytes`}
          onPress={downloadAll}
          style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
        >
          <DownloadSimple size={20} color={AMBER} weight="bold" />
          <Text style={styles.outlineText}>Download all chapters ({fetchMb.toFixed(0)} MB)</Text>
        </Pressable>
      )}

      {CHAPTERS.map((ch) => (
        <ChapterCard
          key={ch.number}
          ch={ch}
          downloads={downloads}
          available={available(ch)}
          season={season.progress}
          checked={season.loaded}
          onUnlock={() => unlock(ch)}
        />
      ))}

      <View style={styles.tips}>
        <Tip Icon={DeviceRotate} text="Turn your phone sideways" />
        <Tip Icon={HandTap} text="Tap to act, hold to examine" />
        <Tip Icon={Headphones} text="Best with headphones" />
      </View>
      <Text style={styles.footnote}>
        Chapter One comes with the app. A new chapter unlocks every four weeks from the day you start, or unlock the next one straight
        away for credits. Once downloaded, chapters play offline, and you can delete them at any time to free up space and download
        them again whenever you want to revisit them. Your progress is saved on this phone and kept if you delete a chapter.
      </Text>
    </ScrollView>
  );
}

type CardProps = {
  ch: Chapter;
  downloads: ReturnType<typeof useChapterDownloads>;
  available: boolean;
  season: SeasonProgress | null;
  checked: boolean;
  onUnlock: () => void;
};

function ChapterCard({ ch, downloads, available, season, checked, onUnlock }: CardProps) {
  const locked = !!ch.comingLabel;
  // Out, but not yet unlocked for this player.
  const waiting = !locked && !available;
  const preview = locked && __DEV__;
  const bundled = !!GAME_PAGES[ch.id];
  const version = downloads.versions[ch.id];
  const downloaded = version !== undefined;
  const outdated = downloaded && !!ch.download && version < ch.download.version;
  const progress = downloads.progress[ch.id];
  const error = downloads.errors[ch.id];
  // The web build streams chapters from the server rather than keeping them.
  const playable = bundled || downloaded || (Platform.OS === "web" && !!ch.download);

  const play = () => router.push({ pathname: "/nightglass-play", params: { chapter: String(ch.id) } });
  const confirmDelete = () =>
    Alert.alert(
      `Delete Chapter ${ch.number}?`,
      `This frees about ${ch.download?.mb ?? 0} MB. Your progress is kept, and you can download it again at any time.`,
      [
        { text: "Keep it", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => downloads.remove(ch) },
      ]
    );

  return (
    <View style={[styles.card, locked && styles.cardLocked]}>
      <View style={styles.cardHead}>
        <Text style={styles.chapterNo}>CHAPTER {ch.number.toUpperCase()}</Text>
        <Text style={[styles.badge, locked ? styles.badgeLocked : styles.badgeLive]}>{locked ? ch.comingLabel : "Out now"}</Text>
      </View>
      <Text style={styles.place}>{ch.place}</Text>
      <Text style={styles.blurb}>{ch.blurb}</Text>
      {locked && (
        <View style={styles.lockedRow}>
          <Lock size={18} color={MUTED} />
          <Text style={styles.lockedText}>Unlocks on release day</Text>
        </View>
      )}
      {waiting && <UnlockPanel ch={ch} progress={season} checked={checked} onUnlock={onUnlock} />}

      {available && progress !== undefined && (
        <View style={styles.progressBox} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
          <Text style={styles.progressText}>
            Downloading {ch.place}… {Math.round(progress * 100)}%
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(3, progress * 100)}%` }]} />
          </View>
        </View>
      )}

      {available && progress === undefined && playable && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${preview ? "Preview" : "Play"} chapter ${ch.number}, ${ch.place}`}
          onPress={play}
          style={({ pressed }) => [styles.playBtn, preview && styles.previewBtn, pressed && styles.pressed]}
        >
          <Play size={20} color={preview ? AMBER : INK} weight="fill" />
          <Text style={[styles.playText, preview && styles.previewText]}>
            {preview ? `Preview Chapter ${ch.number} (test builds only)` : `Play Chapter ${ch.number}`}
          </Text>
        </Pressable>
      )}

      {available && progress === undefined && !playable && ch.download && DOWNLOADS_AVAILABLE && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Download chapter ${ch.number}, ${ch.download.mb} megabytes`}
          onPress={() => downloads.download(ch)}
          style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
        >
          <DownloadSimple size={20} color={AMBER} weight="bold" />
          <Text style={styles.outlineText}>
            {preview ? "Download to preview" : `Download Chapter ${ch.number}`} ({ch.download.mb} MB)
          </Text>
        </Pressable>
      )}

      {available && !playable && ch.download && !DOWNLOADS_AVAILABLE && (
        <Text style={styles.lockedText}>{"Chapters can't be downloaded in this version of the app."}</Text>
      )}

      {available && progress === undefined && downloaded && (
        <View style={styles.smallRow}>
          {outdated && (
            <Pressable accessibilityRole="button" onPress={() => downloads.download(ch)} style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}>
              <ArrowClockwise size={16} color={AMBER} />
              <Text style={styles.smallText}>Update ({ch.download?.mb} MB)</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete chapter ${ch.number} from this phone`}
            onPress={confirmDelete}
            style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
          >
            <Trash size={16} color={MUTED} />
            <Text style={[styles.smallText, styles.smallMuted]}>Delete download</Text>
          </Pressable>
        </View>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

/** For a chapter that is out but not yet unlocked: when it comes, and how to have it now. */
function UnlockPanel({ ch, progress, checked, onUnlock }: { ch: Chapter; progress: SeasonProgress | null; checked: boolean; onUnlock: () => void }) {
  const row = (text: string) => (
    <View style={styles.lockedRow}>
      <Lock size={18} color={MUTED} />
      <Text style={[styles.lockedText, styles.flex]}>{text}</Text>
    </View>
  );
  if (!progress) return row(checked ? "Connect to the internet to see when this chapter unlocks." : "Checking…");
  if (!progress.signedIn) {
    return (
      <>
        {row("Sign in to unlock a new chapter every four weeks.")}
        <Pressable accessibilityRole="button" onPress={() => router.push("/sign-in")} style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}>
          <Text style={styles.outlineText}>Sign in</Text>
        </Pressable>
      </>
    );
  }
  if (progress.next?.chapter !== ch.id) {
    const before = CHAPTERS.find((c) => c.id === ch.id - 1);
    return row(`Unlocks four weeks after Chapter ${before?.number ?? ch.id - 1}.`);
  }
  return (
    <>
      {row(`Unlocks by itself ${whenUnlocks(progress.next.unlocksAt)}.`)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Unlock chapter ${ch.number} now for ${progress.unlockCredits} credits`}
        onPress={onUnlock}
        style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
      >
        <LockOpen size={20} color={AMBER} weight="bold" />
        <Text style={styles.outlineText}>Unlock now · {progress.unlockCredits} credits</Text>
      </Pressable>
    </>
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
  previewBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: AMBER },
  previewText: { color: AMBER, fontSize: 15 },
  pressed: { opacity: 0.8 },
  outlineBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 999,
    paddingVertical: 13,
  },
  outlineText: { color: AMBER, fontSize: 16, fontWeight: "800" },
  progressBox: { marginTop: 8, gap: 8 },
  progressText: { color: BONE, fontSize: 14 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(239,228,204,0.12)", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: AMBER },
  smallRow: { flexDirection: "row", justifyContent: "flex-end", gap: 18, marginTop: 4 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  smallText: { color: AMBER, fontSize: 14, fontWeight: "700" },
  smallMuted: { color: MUTED, fontWeight: "600" },
  errorText: { color: "#ff9a8a", fontSize: 14, lineHeight: 20 },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  lockedText: { color: MUTED, fontSize: 14 },
  flex: { flex: 1 },

  tips: { flexDirection: "row", gap: 10, marginTop: 4 },
  tip: { flex: 1, alignItems: "center", gap: 6, backgroundColor: CARD, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6 },
  tipText: { color: MUTED, fontSize: 12, textAlign: "center", lineHeight: 16 },
  footnote: { color: MUTED, fontSize: 12, textAlign: "center" },
});
