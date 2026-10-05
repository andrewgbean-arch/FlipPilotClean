import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import * as Speech from "expo-speech";
import { Play } from "phosphor-react-native";

import { useTheme } from "@/styles/ThemeContext";

/**
 * A throwaway screen for picking the tour's narration voice by actually listening to it: these
 * are the PHONE'S OWN installed system voices (the same free engine the tour uses, see
 * src/utils/voice.ts), which can't be sampled from anywhere but the device itself. Once a voice
 * is chosen, tell Claude its name/identifier shown here and it gets hard-coded as the preferred
 * one — this screen isn't meant to stay in the app long-term.
 */

const SAMPLE_LINE = "Hi, I'm your guide to Flip Pilot. Let's take a quick look around.";

export default function VoicePickerScreen() {
  const theme = useTheme();
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((all) => {
        const english = all.filter((v) => v.language?.toLowerCase().startsWith("en"));
        setVoices(english);
      })
      .catch(() => setVoices([]))
      .finally(() => setLoading(false));
    return () => {
      Speech.stop().catch(() => {});
    };
  }, []);

  const play = (voice: Speech.Voice) => {
    Speech.stop().catch(() => {});
    setPlayingId(voice.identifier);
    setTimeout(() => {
      Speech.speak(SAMPLE_LINE, {
        voice: voice.identifier,
        pitch: 1.08,
        rate: 1.02,
        onDone: () => setPlayingId(null),
        onStopped: () => setPlayingId(null),
        onError: () => setPlayingId(null),
      });
    }, 150);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.intro, { color: theme.muted }]}>
        Every English voice your phone has installed. Tap one to hear the sample line, then tell
        boss which name sounds right.
      </Text>

      {loading ? (
        <Text style={{ color: theme.muted, textAlign: "center", marginTop: 40 }}>Loading voices…</Text>
      ) : voices.length === 0 ? (
        <Text style={{ color: theme.muted, textAlign: "center", marginTop: 40 }}>
          No English voices reported by this phone.
        </Text>
      ) : (
        <FlatList
          data={voices}
          keyExtractor={(v) => v.identifier}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play sample in ${item.name}`}
              onPress={() => play(item)}
              style={[styles.row, { borderColor: theme.hairline, backgroundColor: theme.card }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>
                  {item.language} · {item.quality === Speech.VoiceQuality.Enhanced ? "Enhanced" : "Default"}
                </Text>
                <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
                  {item.identifier}
                </Text>
              </View>
              <Play
                size={22}
                weight={playingId === item.identifier ? "fill" : "regular"}
                color={playingId === item.identifier ? theme.gold : theme.text}
              />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  intro: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  name: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12, marginTop: 2 },
});
