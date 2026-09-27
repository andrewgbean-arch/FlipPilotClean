import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Asset } from "expo-asset";
import { StatusBar } from "expo-status-bar";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { CHAPTERS, GAME_PAGES } from "@/game/nightglass";
import { chapterFile, chapterUrl, isDownloaded } from "@/game/nightglassDownloads";

const INK = "#03060a";
const AMBER = "#f0b35b";

/**
 * Full-screen player for Operation Nightglass. The page lays itself sideways
 * on an upright phone, so it plays in landscape although the app is
 * portrait-only. "Exit to FlipPilot" in the game's menu posts {type: "exit"}.
 */
export default function NightglassPlayer() {
  // Each chapter is one self-contained page: Chapter One comes with the app, later ones are downloaded.
  const { chapter } = useLocalSearchParams<{ chapter?: string }>();
  const id = Number(chapter) || 1;
  const ch = CHAPTERS.find((c) => c.id === id) ?? CHAPTERS[0];
  const place = ch.place;
  // The web build has nowhere to keep a download, so it plays a later chapter straight from the server.
  const streamed = Platform.OS === "web" && !GAME_PAGES[ch.id] ? chapterUrl(ch) : null;
  const [loaded, setUri] = useState<string | null>(null);
  const uri = streamed ?? loaded;
  const [failed, setFailed] = useState(false);
  const web = useRef<WebView>(null);

  // The game makes its own sound. Pause it when FlipPilot goes to the
  // background (Android would otherwise keep playing) and resume on return.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const call = state === "active" ? "resume" : "pause";
      web.current?.injectJavaScript(`window.NightglassAudio && window.NightglassAudio.${call}(); true;`);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    const bundled = GAME_PAGES[ch.id];
    if (bundled) {
      Asset.fromModule(bundled)
        .downloadAsync()
        .then((a) => alive && setUri(a.localUri ?? a.uri))
        .catch(() => alive && setFailed(true));
    } else if (!streamed) {
      isDownloaded(ch.id)
        .then((ok) => alive && (ok ? setUri(chapterFile(ch.id)) : setFailed(true)))
        .catch(() => alive && setFailed(true));
    }
    return () => {
      alive = false;
    };
  }, [ch, streamed]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      if (JSON.parse(e.nativeEvent.data)?.type === "exit") router.back();
    } catch {
      // not a message from the game
    }
  };

  if (failed) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>
          {GAME_PAGES[ch.id] ? "The game could not be opened. Please try again." : `Chapter ${ch.number} isn't on this phone yet. Download it from the chapter list first.`}
        </Text>
      </View>
    );
  }
  if (!uri) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <ActivityIndicator color={AMBER} size="large" />
        <Text style={styles.text}>Loading {place}…</Text>
      </View>
    );
  }
  if (Platform.OS === "web") {
    // react-native-webview has no web build; a plain iframe does the job there.
    return React.createElement("iframe", {
      src: uri,
      title: "Operation Nightglass",
      allow: "autoplay; fullscreen",
      style: { border: 0, width: "100%", height: "100%", background: INK },
    });
  }
  // WKWebView needs read access to the folder holding the page (bundled, or downloaded).
  const folder = uri.slice(0, uri.lastIndexOf("/") + 1);
  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <WebView
        ref={web}
        source={{ uri }}
        originWhitelist={["*"]}
        allowingReadAccessToURL={folder}
        allowFileAccess
        allowFileAccessFromFileURLs
        javaScriptEnabled
        domStorageEnabled
        // Sound starts on the player's first tap inside the game; the game
        // also marks itself as media playback so it is heard on silent mode.
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsAirPlayForMediaPlayback={false}
        bounces={false}
        scrollEnabled={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        onMessage={onMessage}
        style={styles.screen}
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.center, StyleSheet.absoluteFill]}>
            <ActivityIndicator color={AMBER} size="large" />
            <Text style={styles.text}>Loading {place}…</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: INK },
  center: { flex: 1, backgroundColor: INK, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  text: { color: "rgba(239,228,204,0.75)", fontSize: 15, textAlign: "center" },
});
