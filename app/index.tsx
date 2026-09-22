import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";

import { useTheme } from "@/styles/useTheme";

const STARTUP_VIDEO = require("../src/assets/videos/startup.mp4");
// Safety net: never strand the user on this screen if the video's end
// event never fires (a slow device, a codec issue, an empty video track).
const FALLBACK_MS = 8000;

function LoadingDots({ color }: { color: string }) {
  const pulses = useRef([0, 1, 2].map(() => new Animated.Value(0.25))).current;

  useEffect(() => {
    const loops = pulses.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(value, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.25, duration: 420, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [pulses]);

  return (
    <View style={styles.dotsRow}>
      {pulses.map((value, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { backgroundColor: color, opacity: value, transform: [{ scale: value }] }]}
        />
      ))}
    </View>
  );
}

export default function IntroScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigatedRef = useRef(false);

  const player = useVideoPlayer(STARTUP_VIDEO, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  const goHome = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace("/home");
  };

  useEffect(() => {
    const sub = player.addListener("playToEnd", goHome);
    const fallback = setTimeout(goHome, FALLBACK_MS);
    return () => {
      sub.remove();
      clearTimeout(fallback);
    };
  }, [player]);

  // The background is exactly the app's own, so the screen flows straight
  // on from the native splash and into Home with no colour change.
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        accessibilityLabel="FlipPilot"
      />
      <View
        style={[
          styles.loadingWrap,
          { bottom: insets.bottom + 28, backgroundColor: theme.background },
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.loadingText, { color: theme.gold }]}>Loading content</Text>
        <LoadingDots color={theme.gold} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  video: { flex: 1 },
  loadingWrap: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
