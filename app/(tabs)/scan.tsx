import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import { useTheme } from "@/styles/ThemeContext";
import { searchBarcode, aiLookup } from "@/utils/api";
import { transformScanResult } from "@/utils/scanTransform";

// Laser + AI Tips
const LASER_COLOR = "#FF3B3B";
const AI_TIPS = [
  "Target acquired… stabilising.",
  "Analyzing object surface…",
  "Scanning thermal signature…",
  "Hold device steady…",
  "Optimizing focus…",
  "Check for scratches before listing.",
  "Bundles sell faster — consider grouping items.",
  "Compare SOLD prices, not active listings.",
  "Good photos increase sale speed.",
  "Check item weight — affects postage profit.",
  "High demand detected.",
  "Strong resale potential.",
  "Market volatility low.",
  "Trending category — good timing.",
  "Resale margin looks promising.",
];

export default function ScanScreen() {
  const theme = useTheme();
  const { mode } = useTheme();
  const isPro = mode === "pro";

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"back" | "front">("back");
  const [torch, setTorch] = useState(false);

  // Scan state
  const [loading, setLoading] = useState(false);
  const [barcodeLocked, setBarcodeLocked] = useState(false);

  // Flash animation
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [flashVisible, setFlashVisible] = useState(false);

  // Success animation
  const successScale = useRef(new Animated.Value(0)).current;
  const [showSuccess, setShowSuccess] = useState(false);

  // Frame pulse
  const framePulse = useRef(new Animated.Value(0)).current;

  // Laser animation
  const laserY = useRef(new Animated.Value(0)).current;

  // AI Tip
  const [currentTip, setCurrentTip] = useState(AI_TIPS[0]);
  const tipOpacity = useRef(new Animated.Value(1)).current;

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  // ============================
  // Modernized Helpers
  // ============================

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const triggerFlash = () => {
    setFlashVisible(true);
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => setFlashVisible(false));
  };

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

  const triggerFramePulse = () => {
    framePulse.setValue(0);
    Animated.timing(framePulse, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start(() => framePulse.setValue(0));
  };

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

  // ============================
  // Effects
  // ============================

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

  useEffect(() => {
    const interval = setInterval(rotateTip, 3000);
    return () => clearInterval(interval);
  }, []);

  // ============================
  // Transform backend → UI
  // ============================
  // `/search` and `/search-image` return { ai, market, pricing, flipScore, image, title, barcode, ... }.
  // scan-results.tsx expects { product: { title, barcode }, ai: { fair_price, suggested_buy, suggested_sell, flip_score }, image }.

  const transform = transformScanResult;

  // ============================
  // Barcode Scan
  // ============================

  const handleBarcode = async ({ data }: { data: string }) => {
    if (barcodeLocked || loading) return;

    setBarcodeLocked(true);
    setLoading(true);

    try {
      const res = await searchBarcode(data);

      if (!res || res.error) {
        throw new Error(res?.error ?? "Search failed");
      }

      const finalObj = transform(res);

      triggerSuccess();
      triggerFramePulse();
      triggerFlash();

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

  // ============================
  // Photo Scan
  // ============================

  const takePhoto = async () => {
    try {
      if (!cameraRef.current || loading || !cameraReady) return;

      const photo = await cameraRef.current.takePictureAsync();

      const base64 = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: "base64",
      });

      setLoading(true);

      const res = await aiLookup(base64);

      if (!res || res.error) {
        throw new Error(res?.error ?? "AI lookup failed");
      }

      const finalObj = transform(res, photo.uri);

      triggerSuccess();
      triggerFramePulse();
      triggerFlash();

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

  // ============================
  // Permission Screens
  // ============================

  if (permission === null) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
        <Text style={{ marginTop: 20, color: theme.gold, fontWeight: "700" }}>
          Preparing camera…
        </Text>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingHorizontal: 32 }]}>
        <View style={[styles.permissionIconBadge, { backgroundColor: theme.goldSoftGlow }]}>
          <Text style={{ fontSize: 28 }}>📷</Text>
        </View>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
          Camera access needed
        </Text>
        <Text style={{ color: theme.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>
          FlipPilot uses your camera to scan barcodes and identify items for flipping.
        </Text>

        <Pressable
          style={[styles.permissionButton, { backgroundColor: theme.gold }]}
          onPress={requestPermission}
        >
          <Text style={{ color: theme.black, fontWeight: "900", fontSize: 18 }}>
            Enable Camera
          </Text>
        </Pressable>
      </View>
    );
  }

  // ============================
  // Main UI
  // ============================

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
              <Text style={{ color: theme.text, fontWeight: "900" }}>
                {torch ? "🔦" : "💡"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.utilityButton, { backgroundColor: theme.card }]}
              onPress={() =>
                setCameraFacing((f) => (f === "back" ? "front" : "back"))
              }
            >
              <Text style={{ color: theme.text, fontWeight: "900" }}>🔄</Text>
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

            {/* LASER */}
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

          {/* AI TIP */}
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

          {/* BUTTONS */}
          <View style={styles.bottomButtons}>
            <Pressable
              style={[styles.scanButton, { backgroundColor: theme.gold }]}
              onPress={() => setBarcodeLocked(false)}
            >
              <Text style={{ color: theme.black, fontWeight: "900", fontSize: 18 }}>
                SCAN BARCODE
              </Text>
            </Pressable>

            <Pressable
              style={[styles.scanButton, { backgroundColor: theme.gold }]}
              onPress={takePhoto}
            >
              <Text style={{ color: theme.black, fontWeight: "900", fontSize: 18 }}>
                SCAN PHOTO
              </Text>
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
          <Text style={{ marginTop: 20, color: theme.gold, fontWeight: "900" }}>
            Analyzing…
          </Text>
        </View>
      )}

      {/* TOAST */}
      {toastVisible && (
        <Animated.View style={[styles.toast, { borderColor: theme.gold }]}>
          <Text style={{ color: theme.gold, fontWeight: "800" }}>
            {toastMessage}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// =========================
// Styles
// =========================

const styles = StyleSheet.create({
  container: { flex: 1 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  permissionIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

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
