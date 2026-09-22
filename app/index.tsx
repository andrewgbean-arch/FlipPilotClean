import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";

import { useTheme } from "@/styles/useTheme";

const STARTUP_VIDEO = require("../src/assets/videos/startup.mp4");
// Safety net: never strand the user on this screen if the video's end
// event never fires (a slow device, a codec issue, an empty video track).
const FALLBACK_MS = 8000;

export default function IntroScreen() {
  const theme = useTheme();
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  video: { flex: 1 },
});
