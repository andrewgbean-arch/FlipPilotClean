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
import type { BarcodeSettings } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { Barcode, Camera, CameraRotate, Check, Flashlight } from "phosphor-react-native";

import { useTheme } from "@/styles/ThemeContext";
import { describeApiError, identifyBarcode, identifyPhoto } from "@/utils/api";
import { putPending } from "@/utils/pendingScan";
import { photoForUpload } from "@/utils/photo";
import { SCAN_AGAIN_EVENT, transformIdentity } from "@/utils/scanTransform";
import ScanWaitingAd, { AD_REVEAL_DELAY_MS } from "@/components/ScanWaitingAd";

// Laser + AI Tips
const LASER_COLOR = "#FF3B3B";
const AI_TIPS = [
  "Hold device steady…",
  "Line the barcode up inside the frame.",
  "No barcode? Use Scan photo instead.",
  "Check for scratches before listing.",
  "Bundles sell faster — consider grouping items.",
  "Compare SOLD prices, not active listings.",
  "Good photos increase sale speed.",
  "Check item weight — affects postage profit.",
];

// expo-camera unbinds the shared camera when any camera view is destroyed, so give the
// previous screen's camera a moment to go away before this one mounts.
const CAMERA_SETTLE_MS = 300;
// The photo is shrunk before it is sent (see photoForUpload), so capture at a good quality.
const PHOTO_QUALITY = 0.7;
const TOAST_MS = 4000;

// One object for the life of the app: a new object on every render (the tip text
// changes every 3 seconds) makes the camera reconfigure its scanner each time.
const BARCODE_SETTINGS: BarcodeSettings = {
  barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128"],
};

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
  // A quick barcode lookup is often over before anyone could read anything, so
  // the sponsored card only appears once the wait has actually gone on a little.
  const [showWaitingAd, setShowWaitingAd] = useState(false);
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

  useEffect(() => {
    if (!loading) {
      setShowWaitingAd(false);
      return;
    }
    const timer = setTimeout(() => setShowWaitingAd(true), AD_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);

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

  const openResults = (payload: Record<string, any>) => {
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
      // Step 1: what is it? Quick, so the result screen opens straight away and
      // shows "Checking prices" while step 2 (what is it worth?) runs there.
      const id = await identifyBarcode(data, controller.signal);
      if (controller.signal.aborted) return;

      const pendingId = putPending({
        title: id.title,
        barcode: id.barcode ?? data,
        packCount: id.packCount ?? null,
      });
      openResults(transformIdentity({ ...id, barcode: id.barcode ?? data }, { pendingId }));
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
        // No base64 here: a full-size photo as text is slow to build and is shrunk below anyway.
        photo = await cameraRef.current.takePictureAsync({
          quality: PHOTO_QUALITY,
        });
      } catch (err) {
        console.log("Photo capture error:", err);
        if (!controller.signal.aborted) {
          showToast("The camera couldn't take that photo. Please try again.");
        }
        return;
      }

      if (controller.signal.aborted) return;

      if (!photo?.uri) {
        showToast("Couldn't read that photo. Please try again.");
        return;
      }

      const upload = await photoForUpload(photo);
      if (controller.signal.aborted) return;

      if (!upload) {
        showToast("Couldn't read that photo. Please try again.");
        return;
      }

      const id = await identifyPhoto(upload, controller.signal);
      if (controller.signal.aborted) return;

      const pendingId = putPending({
        title: id.title,
        packCount: id.packCount ?? null,
        condition: id.condition ?? null,
        imageBase64: upload,
      });
      openResults(transformIdentity(id, { imageUri: photo.uri, pendingId }));
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
        <Text style={{ marginTop: 20, color: theme.muted, fontWeight: "600" }}>
          Preparing camera…
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain;

    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingHorizontal: 32 }]}>
        <View style={[styles.permissionIconBadge, { backgroundColor: theme.card, borderColor: theme.goldSoftGlow }]}>
          <Camera size={30} color={theme.gold} />
        </View>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "700", textAlign: "center" }}>
          Camera access needed
        </Text>
        <Text style={{ color: theme.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>
          {canAskAgain
            ? "FlipPilot uses your camera to scan barcodes and identify items for flipping."
            : "Camera access is turned off for FlipPilot. Turn it on in Settings to scan barcodes and identify items for flipping."}
        </Text>

        <Pressable
          accessibilityRole="button"
          style={[styles.permissionButton, { backgroundColor: theme.gold }]}
          onPress={canAskAgain ? requestPermission : openSettings}
        >
          <Text style={{ color: theme.black, fontWeight: "700", fontSize: 17 }}>
            {canAskAgain ? "Enable camera" : "Open Settings"}
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
            barcodeScannerSettings={BARCODE_SETTINGS}
            onBarcodeScanned={handleBarcode}
            onCameraReady={() => setCameraReady(true)}
            onMountError={handleCameraError}
          />
        )}

        {/* TOP RIGHT BUTTONS */}
        <View style={styles.topRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
            style={[styles.utilityButton, { backgroundColor: torch ? theme.gold : theme.card }]}
            onPress={() => setTorch((t) => !t)}
          >
            <Flashlight
              size={22}
              weight={torch ? "fill" : "regular"}
              color={torch ? theme.black : theme.text}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch camera"
            style={[styles.utilityButton, { backgroundColor: theme.card }]}
            onPress={() =>
              setCameraFacing((f) => (f === "back" ? "front" : "back"))
            }
          >
            <CameraRotate size={22} color={theme.text} />
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
              : "Scanning is paused. Tap Scan barcode to start again."}
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
            <Check size={56} weight="bold" color={theme.success} />
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
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>
              The camera couldn't start
            </Text>
            <Text style={{ color: theme.muted, fontSize: 14, textAlign: "center", marginTop: 8 }}>
              It may be in use by another app. Close other apps that use the camera, then try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={[styles.permissionButton, { backgroundColor: theme.gold }]}
              onPress={retryCamera}
            >
              <Text style={{ color: theme.black, fontWeight: "700", fontSize: 16 }}>
                Try again
              </Text>
            </Pressable>
          </View>
        )}

        {/* BUTTONS */}
        <View style={styles.bottomButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: barcodeArmed }}
            style={[
              styles.scanButton,
              { backgroundColor: theme.gold },
              barcodeArmed && styles.scanButtonActive,
            ]}
            onPress={() => setBarcodeArmed(true)}
            disabled={barcodeArmed}
          >
            <Barcode size={22} color={theme.black} />
            <Text style={[styles.scanButtonLabel, { color: theme.black }]}>
              {barcodeArmed ? "Scanning for barcode…" : "Scan barcode"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={[styles.scanButton, styles.scanButtonSecondary]}
            onPress={takePhoto}
          >
            <Camera size={22} color={theme.text} />
            <Text style={[styles.scanButtonLabel, { color: theme.text }]}>Scan photo</Text>
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
          <Text style={{ marginTop: 20, color: theme.text, fontSize: 16, fontWeight: "600" }}>
            Analysing…
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel scan"
            style={[styles.cancelButton, { borderColor: "rgba(255,255,255,0.3)" }]}
            onPress={cancelScan}
          >
            <Text style={{ color: theme.text, fontWeight: "600", fontSize: 16 }}>
              Cancel
            </Text>
          </Pressable>

          {showWaitingAd ? <ScanWaitingAd /> : null}
        </View>
      )}

      {/* TOAST */}
      {toastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { borderColor: theme.hairline }]}
        >
          <Text style={{ color: theme.text, fontWeight: "600", textAlign: "center" }}>
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
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 20,
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
  color: "rgba(255,255,255,0.9)",
  fontSize: 15,
  fontWeight: "600",
  textAlign: "center",
},
successCheck: {
  position: "absolute",
  top: "40%",
  alignSelf: "center",
  backgroundColor: "rgba(10,17,40,0.75)",
  padding: 26,
  borderRadius: 100,
  borderWidth: 1,
  borderColor: "rgba(76,175,80,0.6)",
},

bottomButtons: {
  position: "absolute",
  bottom: 60,
  width: "100%",
  paddingHorizontal: 40,
  gap: 14,
},

scanButton: {
  minHeight: 52,
  paddingVertical: 14,
  borderRadius: 14,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
},

scanButtonSecondary: {
  backgroundColor: "rgba(10,17,40,0.78)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.18)",
},

scanButtonLabel: {
  fontSize: 17,
  fontWeight: "700",
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
  minHeight: 48,
  justifyContent: "center",
  paddingHorizontal: 32,
  borderRadius: 14,
  borderWidth: 1,
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
  borderWidth: 1,
  zIndex: 50,
},
});
