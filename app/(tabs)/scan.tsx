import { useFlipHistory } from "../../src/context/FlipHistoryContext";

import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { usePro, useTheme } from "../../src/context/ThemeContext";
import { ThemedText } from "../../src/styles/theme/ThemedText";
import ThemedView from "../../src/styles/theme/ThemedView";

// RED LASER
const LASER_COLOR = "#FF3B3B";

// AI TIP POOL (Mixed: Tactical + Flipping + Market)
const AI_TIPS = [
  // Tactical HUD
  "Target acquired… stabilising.",
  "Analyzing object surface…",
  "Scanning thermal signature…",
  "Hold device steady…",
  "Optimizing focus…",

  // Flipping Advice
  "Check for scratches before listing.",
  "Bundles sell faster — consider grouping items.",
  "Compare SOLD prices, not active listings.",
  "Good photos increase sale speed.",
  "Check item weight — affects postage profit.",

  // Market Predictions
  "High demand detected.",
  "Strong resale potential.",
  "Market volatility low.",
  "Trending category — good timing.",
  "Resale margin looks promising.",
];

export default function ScanScreen() {
  const theme = useTheme();
  const { isPro } = usePro();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const { setTempScanData } = useFlipHistory();

  const [loading, setLoading] = useState(false);
  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"back" | "front">("back");

  const [barcodeLocked, setBarcodeLocked] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // Flash animation
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [flashVisible, setFlashVisible] = useState(false);

  const triggerFlash = (color: string = "white") => {
    setFlashVisible(true);
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => setFlashVisible(false));
  };

  // SUCCESS CHECKMARK ANIMATION
  const successScale = useRef(new Animated.Value(0)).current;
  const [showSuccess, setShowSuccess] = useState(false);

  const triggerSuccess = () => {
    setShowSuccess(true);
    successScale.setValue(0);

    Animated.spring(successScale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(successScale, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => setShowSuccess(false));
      }, 600);
    });
  };

  // FRAME PULSE
  const framePulse = useRef(new Animated.Value(0)).current;

  const triggerFramePulse = () => {
    framePulse.setValue(0);
    Animated.timing(framePulse, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start(() => framePulse.setValue(0));
  };


  // Laser animation
  const laserY = useRef(new Animated.Value(0)).current;

  const startLaser = () => {
    laserY.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserY, {
          toValue: 1,
          duration: isPro ? 1400 : 1800,
          useNativeDriver: true,
        }),
        Animated.timing(laserY, {
          toValue: 0,
          duration: isPro ? 1400 : 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // AI TIP ROTATION (Hologram style)
  const [currentTip, setCurrentTip] = useState(AI_TIPS[0]);
  const tipOpacity = useRef(new Animated.Value(1)).current;

  const rotateTip = () => {
    Animated.sequence([
      Animated.timing(tipOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(tipOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    const next = AI_TIPS[Math.floor(Math.random() * AI_TIPS.length)];
    setCurrentTip(next);
  };

  useEffect(() => {
    const interval = setInterval(rotateTip, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    requestPermission();
  }, []);

  useEffect(() => {
    if (permission?.granted) {
      setTimeout(() => {
        setCameraReady(true);
        startLaser();
      }, 150);
    }
  }, [permission?.granted]);

  // TRANSFORMER
  const transform = (input: any, imageUri?: string) => ({
    ai: input.ai ?? {},
    market: input.market ?? {},
    pricing: input.pricing ?? {},
    ebayItems: input.ebayItems ?? [],
    flipScore: input.flipScore ?? 0,
    flipPotential: input.flipPotential ?? "Unknown",
    sellSpeed: input.sellSpeed ?? "Unknown",
    rarity: input.rarity ?? "Unknown",
    insights: input.insights ?? "",
    image: imageUri ?? input.image ?? null,
    title: input.title ?? input.ai?.title ?? "Unknown Item",
  });

  // BARCODE SCAN
  const handleBarcode = async ({ data }: { data: string }) => {
    if (barcodeLocked || loading) return;

    setBarcodeLocked(true);

   
    try {
      setLoading(true);

      const result = await fetch(
        `http://192.168.0.47:3001/search?q=${data}`
      ).then((r) => r.json());

      const finalObj = transform(result, result.image);
      setTempScanData(finalObj);

      // Success effects
      triggerSuccess();
      triggerFramePulse();
      triggerFlash("green");

      router.push({
        pathname: "/scan/scan-results",
        params: { data: JSON.stringify(finalObj) },
      });
    } catch (err) {
      console.log("Barcode scan error:", err);
      showToast("Scan failed — try again");
    } finally {
      setLoading(false);
      setTimeout(() => setBarcodeLocked(false), 800);
    }
  };

  // PHOTO SCAN
  const takePhoto = async () => {
    try {
      if (!cameraRef.current || loading || !cameraReady) return;


      const photo = await cameraRef.current.takePictureAsync();

    const base64 = await FileSystem.readAsStringAsync(photo.uri, {
  encoding: "base64",
});


      setLoading(true);

      const result = await fetch("http://192.168.0.47:3001/search-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          userId: "default-user",
          deviceId: "default-device",
        }),
      }).then((r) => r.json());

      const finalObj = transform(result, photo.uri);
      setTempScanData(finalObj);

      triggerSuccess();
      triggerFramePulse();
      triggerFlash("green");

      router.push({
        pathname: "/scan/scan-results",
        params: { data: JSON.stringify(finalObj) },
      });
    } catch (err) {
      console.log("Photo scan error:", err);
      showToast("Scan failed — try again");
    } finally {
      setLoading(false);
    }
  };

  // PERMISSION SCREENS
  if (permission === null) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={theme.gold} />
        <ThemedText style={{ marginTop: 20, color: theme.gold, fontWeight: "700" }}>
          Preparing camera…
        </ThemedText>
      </ThemedView>
    );
  }

  if (!permission?.granted) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={{ color: theme.text, fontSize: 22, fontWeight: "900" }}>
          Camera access needed
        </ThemedText>

        <Pressable
          style={[styles.permissionButton, { backgroundColor: theme.gold }]}
          onPress={requestPermission}
        >
          <ThemedText style={{ color: theme.black, fontWeight: "900", fontSize: 18 }}>
            Enable Camera
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      {!loading && (
        <View style={{ flex: 1 }}>
          {cameraReady && (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={cameraFacing}
              enableTorch={torch}
              barcodeScannerSettings={{
                barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128"],
              }}
              onBarcodeScanned={barcodeLocked || loading ? undefined : handleBarcode}
            />
          )}

          {/* TOP RIGHT BUTTONS */}
          <View style={styles.topRight}>
            <Pressable
              style={[styles.utilityButton, { backgroundColor: theme.card }]}
              onPress={() => setTorch((t) => !t)}
            >
              <ThemedText style={{ color: theme.text, fontWeight: "900" }}>
                {torch ? "🔦" : "💡"}
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.utilityButton, { backgroundColor: theme.card }]}
              onPress={() =>
                setCameraFacing((f) => (f === "back" ? "front" : "back"))
              }
            >
              <ThemedText style={{ color: theme.text, fontWeight: "900" }}>
                🔄
              </ThemedText>
            </Pressable>
          </View>

          {/* SCAN FRAME */}
          <View style={styles.frameContainer}>
            <Animated.View
              style={[
                styles.frame,
                {
                  borderColor: framePulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [theme.gold, "green"],
                  }),
                },
              ]}
            />

            {/* RED LASER */}
            <Animated.View
              style={[
                styles.laser,
                {
                  backgroundColor: LASER_COLOR,
                  transform: [
                    {
                      translateY: laserY.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 220],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>

          {/* HOLOGRAM AI TIP */}
          <Animated.View style={[styles.holoTip, { opacity: tipOpacity }]}>
            <Text style={styles.holoText}>{currentTip}</Text>
          </Animated.View>

          {/* SUCCESS CHECKMARK */}
          {showSuccess && (
            <Animated.View
              style={[
                styles.successCheck,
                {
                  transform: [{ scale: successScale }],
                },
              ]}
            >
              <Text style={styles.successText}>✔</Text>
            </Animated.View>
          )}

          {/* BUTTONS (STACKED) */}
          <View style={styles.bottomButtons}>
            <Pressable
              style={[
                styles.scanButton,
                { backgroundColor: theme.gold },
              ]}
              onPress={() => setBarcodeLocked(false)}
            >
              <ThemedText style={{ color: theme.black, fontWeight: "900", fontSize: 18 }}>
                SCAN BARCODE
              </ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.scanButton,
                { backgroundColor: theme.gold },
              ]}
              onPress={takePhoto}
            >
              <ThemedText style={{ color: theme.black, fontWeight: "900", fontSize: 18 }}>
                SCAN PHOTO
              </ThemedText>
            </Pressable>
          </View>

          {/* FLASH */}
          {flashVisible && (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "rgba(255,255,255,0.4)", opacity: flashOpacity },
              ]}
            />
          )}
        </View>
      )}

      {/* LOADING */}
      {loading && (
        <ThemedView style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
          <ThemedText style={{ marginTop: 20, color: theme.gold, fontWeight: "900" }}>
            Analyzing…
          </ThemedText>
        </ThemedView>
      )}

      {/* TOAST */}
      {toastVisible && (
        <Animated.View style={[styles.toast, { borderColor: theme.gold }]}>
          <Text style={{ color: theme.gold, fontWeight: "800" }}>{toastMessage}</Text>
        </Animated.View>
      )}
    </ThemedView>
  );
}
// =========================
// ⭐ PART 2 — STYLES
// =========================

const styles = StyleSheet.create({
  container: { flex: 1 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  topRight: {
    position: "absolute",
    top: 40,
    right: 20,
    gap: 12,
    zIndex: 20,
  },

  utilityButton: {
    padding: 12,
    borderRadius: 50,
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.9,
  },

  // SCAN FRAME
  frameContainer: {
    position: "absolute",
    top: "25%",
    alignSelf: "center",
    width: 260,
    height: 260,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  frame: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderWidth: 3,
    borderRadius: 18,
  },

  laser: {
    position: "absolute",
    width: "100%",
    height: 4,
    borderRadius: 4,
    opacity: 0.9,
  },

  // HOLOGRAM AI TIP
  holoTip: {
    position: "absolute",
    top: "60%",
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    
  },

  holoText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(255,0,0,0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  // SUCCESS CHECKMARK
  successCheck: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    backgroundColor: "rgba(0,255,0,0.15)",
    padding: 30,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "rgba(0,255,0,0.4)",
  },

  successText: {
    fontSize: 60,
    fontWeight: "900",
    color: "lime",
    textShadowColor: "rgba(0,255,0,0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  // BUTTONS
  bottomButtons: {
    position: "absolute",
    bottom: 60,
    width: "100%",
    paddingHorizontal: 40,
    gap: 14,
  },

  scanButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },

  permissionButton: {
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
  },

  // TOAST
  toast: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    backgroundColor: "rgba(10,17,40,0.95)",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 2,
  },
});
