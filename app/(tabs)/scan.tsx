import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  DeviceEventEmitter,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PermissionStatus } from "expo";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useIsFocused } from "expo-router";

import { useTheme } from "@/styles/ThemeContext";
import { aiLookup, describeApiError, searchBarcode } from "@/utils/api";
import { SCAN_AGAIN_EVENT, transformScanResult } from "@/utils/scanTransform";

// Laser + AI Tips
const LASER_COLOR = "#FF3B3B";
const AI_TIPS = [
  "Hold device steady…",
  "Line the barcode up inside the frame.",
  "No barcode? Use SCAN PHOTO instead.",
  "Check for scratches before listing.",
  "Bundles sell faster — consider grouping items.",
  "Compare SOLD prices, not active listings.",
  "Good photos increase sale speed.",
  "Check item weight — affects postage profit.",
];

// expo-camera unbinds the shared camera when any camera view is destroyed, so give the
// previous screen's camera a moment to go away before this one mounts.
const CAMERA_SETTLE_MS = 300;
// Photos travel to the server as base64; this keeps them well under its 10mb body limit.
const PHOTO_QUALITY = 0.5;
const TOAST_MS = 4000;

export default function ScanScreen() {
  const theme = useTheme();
  const { mode } = useTheme();
  const isPro = mode === "pro";
  const isFocused = useIsFocused();

  // Camera
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<"back" | "front">("back");
  const [torch, setTorch] = useState(false);

  // Scan state
  const [loading, setLoading] = useState(false);
  // Barcode scanning switches off after every lookup and only resumes when the user asks
  // (SCAN BARCODE, or Scan Again on the results), so a code still in view can't repeat lookups.
  const [barcodeArmed, setBarcodeArmed] = useState(true);
  // Set synchronously so two camera events in the same frame can't start two lookups.
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Flash animation
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [flashVisible, setFlashVisible] = useState(false);

  // Success animation
  const successScale = useRef(new Animated.Value(0)).current;
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================
  // Modernized Helpers
  // ============================

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), TOAST_MS);
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
      successTimer.current = setTimeout(() => {
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

  // Ask the first time only. Once the OS has been asked and refused, it may not show the
  // prompt again, so the permission screen offers Settings instead.
  useEffect(() => {
    if (permission?.status === PermissionStatus.UNDETERMINED) {
      requestPermission();
    }
  }, [permission?.status]);

  // The permission can be changed in Settings; look again when the user comes back to the app.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") getPermission();
    });
    return () => sub.remove();
  }, []);

  // Only one screen should hold the camera. Mount it while this tab is in front, and drop it
  // as soon as the tab is covered or left so nothing scans in the background.
  useEffect(() => {
    if (!isFocused || !permission?.granted) {
      setCameraOn(false);
      setCameraReady(false);
      setCameraFailed(false);
      return;
    }

    const timer = setTimeout(() => setCameraOn(true), CAMERA_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isFocused, permission?.granted]);

  // Leaving the tab (or the screen) cancels any lookup still in flight.
  useFocusEffect(
    useCallback(() => {
      return () => {
        abortRef.current?.abort();
      };
    }, [])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(SCAN_AGAIN_EVENT, () =>
      setBarcodeArmed(true)
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!cameraOn) return;

    const duration = isPro ? 1400 : 1800;
    laserY.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserY, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(laserY, { toValue: 0, duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [cameraOn, isPro]);

  useEffect(() => {
    if (!cameraOn) return;

    const interval = setInterval(rotateTip, 3000);
    return () => clearInterval(interval);
  }, [cameraOn]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  // ============================
  // Scan flow
  // ============================

  const beginScan = () => {
    busyRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    return controller;
  };

  const endScan = (controller: AbortController) => {
    if (abortRef.current === controller) abortRef.current = null;
    busyRef.current = false;
    setLoading(false);
  };

  const cancelScan = () => {
    abortRef.current?.abort();
  };

  const failScan = (err: unknown, controller: AbortController, label: string) => {
    // Cancelled by the user, or they left the screen: nothing to report.
    if (controller.signal.aborted) return;

    console.log(label, err);
    showToast(describeApiError(err));
  };

  const openResults = (payload: ReturnType<typeof transformScanResult>) => {
    triggerSuccess();
    triggerFramePulse();
    triggerFlash();

    router.push({
      pathname: "/scan/scan-results",
      params: { data: JSON.stringify(payload) },
    });
  };

  const handleCameraError = (event: { message: string }) => {
    console.log("Camera failed to start:", event?.message);
    setCameraReady(false);
    setCameraFailed(true);
  };

  const retryCamera = () => {
    setCameraFailed(false);
    setCameraKey((k) => k + 1);
  };

  const openSettings = () => {
    Linking.openSettings().catch(() =>
      Alert.alert(
        "Couldn't open Settings",
        "Open your phone's Settings, find FlipPilot and allow Camera access."
      )
    );
  };

  // ============================
  // Barcode Scan
  // ============================

  const handleBarcode = async ({ data }: { data: string }) => {
    if (busyRef.current || !barcodeArmed) return;

    setBarcodeArmed(false);
    const controller = beginScan();

    try {
      const res = await searchBarcode(data, controller.signal);
      if (controller.signal.aborted) return;

      openResults(transformScanResult(res));
    } catch (err) {
      failScan(err, controller, "Barcode scan error:");
    } finally {
      endScan(controller);
    }
  };

  // ============================
  // Photo Scan
  // ============================

  const takePhoto = async () => {
    if (busyRef.current) return;

    if (!cameraRef.current || !cameraReady) {
      showToast("The camera is still starting. Try again in a moment.");
      return;
    }

    setBarcodeArmed(false);
    const controller = beginScan();

    try {
      let photo;
      try {
        photo = await cameraRef.current.takePictureAsync({
          quality: PHOTO_QUALITY,
          base64: true,
        });
      } catch (err) {
        console.log("Photo capture error:", err);
        if (!controller.signal.aborted) {
          showToast("The camera couldn't take that photo. Please try again.");
        }
        return;
      }

      if (controller.signal.aborted) return;

      if (!photo?.base64) {
        showToast("Couldn't read that photo. Please try again.");
        return;
      }

      const res = await aiLookup(photo.base64, controller.signal);
      if (controller.signal.aborted) return;

      openResults(transformScanResult(res, photo.uri));
    } catch (err) {
      failScan(err, controller, "Photo scan error:");
    } finally {
      endScan(controller);
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

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain;

    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingHorizontal: 32 }]}>
        <View style={[styles.permissionIconBadge, { backgroundColor: theme.goldSoftGlow }]}>
          <Text style={{ fontSize: 28 }}>📷</Text>
        </View>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
          Camera access needed
        </Text>
        <Text style={{ color: theme.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>
          {canAskAgain
            ? "FlipPilot uses your camera to scan barcodes and identify items for flipping."
            : "Camera access is turned off for FlipPilot. Turn it on in Settings to scan barcodes and identify items for flipping."}
        </Text>

        <Pressable
          style={[styles.permissionButton, { backgroundColor: theme.gold }]}
          onPress={canAskAgain ? requestPermission : openSettings}
        >
          <Text style={{ color: theme.black, fontWeight: "900", fontSize: 18 }}>
            {canAskAgain ? "Enable Camera" : "Open Settings"}
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
      <View style={{ flex: 1 }}>
        {cameraOn && !cameraFailed && (
          <CameraView
            key={cameraKey}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={cameraFacing}
            enableTorch={torch}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128"],
            }}
            onBarcodeScanned={handleBarcode}
            onCameraReady={() => setCameraReady(true)}
            onMountError={handleCameraError}
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
                      outputRange: [0, 254],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>

        {/* AI TIP */}
        <Animated.View style={[styles.holoTip, { opacity: tipOpacity }]}>
          <Text style={styles.holoText}>
            {barcodeArmed
              ? currentTip
              : "Barcode scanning is paused. Tap SCAN BARCODE to scan again."}
          </Text>
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

        {/* CAMERA COULD NOT START */}
        {cameraFailed && (
          <View
            style={[
              styles.cameraFailed,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
            ]}
          >
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: "900", textAlign: "center" }}>
              The camera couldn't start
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>
              It may be in use by another app. Close other apps that use the camera, then try again.
            </Text>
            <Pressable
              style={[styles.permissionButton, { backgroundColor: theme.gold }]}
              onPress={retryCamera}
            >
              <Text style={{ color: theme.black, fontWeight: "900", fontSize: 16 }}>
                Try again
              </Text>
            </Pressable>
          </View>
        )}

        {/* BUTTONS */}
        <View style={styles.bottomButtons}>
          <Pressable
            style={[
              styles.scanButton,
              { backgroundColor: theme.gold },
              barcodeArmed && styles.scanButtonActive,
            ]}
            onPress={() => setBarcodeArmed(true)}
            disabled={barcodeArmed}
          >
            <Text style={{ color: theme.black, fontWeight: "900", fontSize: 18 }}>
              {barcodeArmed ? "SCANNING FOR BARCODE" : "SCAN BARCODE"}
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

      {/* LOADING */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.gold} />
          <Text style={{ marginTop: 20, color: theme.gold, fontWeight: "900" }}>
            Analyzing…
          </Text>
          <Pressable
            style={[styles.cancelButton, { borderColor: theme.gold }]}
            onPress={cancelScan}
          >
            <Text style={{ color: theme.gold, fontWeight: "800", fontSize: 16 }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      )}

      {/* TOAST */}
      {toastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { borderColor: theme.gold }]}
        >
          <Text style={{ color: theme.gold, fontWeight: "800", textAlign: "center" }}>
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
    top: 0,
    width: "100%",
    height: 4,
    borderRadius: 4,
    opacity: 0.9,
  },

  holoTip: {
    position: "absolute",
    top: "60%",
    alignSelf: "center",
    maxWidth: "88%",
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
  textAlign: "center",
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

scanButtonActive: {
  opacity: 0.6,
},

permissionButton: {
  marginTop: 20,
  paddingVertical: 16,
  paddingHorizontal: 40,
  borderRadius: 14,
},

cameraFailed: {
  position: "absolute",
  top: "30%",
  alignSelf: "center",
  width: "84%",
  padding: 20,
  borderRadius: 16,
  borderWidth: 1,
  alignItems: "center",
  zIndex: 30,
},

loadingOverlay: {
  ...StyleSheet.absoluteFill,
  backgroundColor: "rgba(0,0,0,0.7)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 40,
},

cancelButton: {
  marginTop: 28,
  paddingVertical: 12,
  paddingHorizontal: 32,
  borderRadius: 14,
  borderWidth: 1.5,
},

toast: {
  position: "absolute",
  bottom: 120,
  alignSelf: "center",
  maxWidth: "88%",
  backgroundColor: "rgba(10,17,40,0.95)",
  paddingVertical: 12,
  paddingHorizontal: 22,
  borderRadius: 14,
  borderWidth: 2,
  zIndex: 50,
},
});
