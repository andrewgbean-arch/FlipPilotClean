import { CameraView, useCameraPermissions } from "expo-camera";

import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { aiLookup, describeApiError } from "@/utils/api";
import { normalizeConfidence, transformScanResult } from "@/utils/scanTransform";

const NAVY = "#0A1128";
const GOLD = "#FFD700";

// expo-camera unbinds the shared camera when any camera view is destroyed, so give the
// previous screen's camera a moment to go away before this one mounts.
const CAMERA_SETTLE_MS = 300;
// Photos travel to the server as base64; this keeps them well under its 10mb body limit.
const PHOTO_QUALITY = 0.5;

export default function AiCameraScreen() {
  const isFocused = useIsFocused();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

  const [loading, setLoading] = useState(false);
  // Set synchronously so a double tap on the shutter can't start two lookups.
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // SUPER NOVA VISION MODE STATES
  const [visionBox, setVisionBox] = useState<any>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  // ANIMATIONS
  const scanWave = useRef(new Animated.Value(0)).current;
  const lockPulse = useRef(new Animated.Value(0)).current;

  const startScanWave = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanWave, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(scanWave, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  const startLockPulse = () => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lockPulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(lockPulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return loop;
  };

  useEffect(() => {
    const loop = startLockPulse();
    return () => loop.stop();
  }, []);

  // The permission can be changed in Settings; look again when the user comes back to the app.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") getPermission();
    });
    return () => sub.remove();
  }, []);

  // Only one screen should hold the camera. Mount it while this screen is in front, and drop it
  // as soon as something is pushed on top (such as the results) or the screen is left.
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

  // Leaving the screen cancels any lookup still in flight, so it can't push results later.
  useFocusEffect(
    useCallback(() => {
      return () => {
        abortRef.current?.abort();
      };
    }, [])
  );

  const openSettings = () => {
    Linking.openSettings().catch(() =>
      Alert.alert(
        "Couldn't open Settings",
        "Open your phone's Settings, find FlipPilot and allow Camera access."
      )
    );
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

  const handleTakePhoto = async () => {
    if (busyRef.current) return;

    if (!cameraRef.current || !cameraReady) {
      Alert.alert("Camera not ready", "The camera is still starting. Try again in a moment.");
      return;
    }

    busyRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    setVisionBox(null);
    setConfidence(null);
    setLoading(true);
    startScanWave();

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
          Alert.alert("Camera problem", "The camera couldn't take that photo. Please try again.");
        }
        return;
      }

      if (controller.signal.aborted) return;

      if (!photo?.base64) {
        Alert.alert("Scan failed", "Couldn't read that photo. Please try again.");
        return;
      }

      const res = await aiLookup(photo.base64, controller.signal);
      if (controller.signal.aborted) return;

      // SUPER NOVA VISION MODE DATA
      setVisionBox(res.ai?.box ?? null);
      setConfidence(normalizeConfidence(res.ai?.confidence));

      const payload = transformScanResult(res, photo.uri);

      router.push({
        pathname: "/scan/scan-results",
        params: { data: JSON.stringify(payload) },
      });
    } catch (err) {
      // Cancelled by the user, or they left the screen: nothing to report.
      if (!controller.signal.aborted) {
        console.log("AI camera error:", err);
        Alert.alert("Scan failed", describeApiError(err));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      busyRef.current = false;
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain;

    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          {canAskAgain
            ? "Camera access is required"
            : "Camera access is turned off for FlipPilot. Turn it on in Settings to identify items with your camera."}
        </Text>
        <Pressable
          style={styles.permissionButton}
          onPress={canAskAgain ? requestPermission : openSettings}
        >
          <Text style={styles.permissionButtonText}>
            {canAskAgain ? "Grant Permission" : "Open Settings"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.smallActionButton, { marginTop: 16 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.smallActionText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        {cameraOn && !cameraFailed && (
          <CameraView
            key={cameraKey}
            style={styles.camera}
            ref={cameraRef}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
            onMountError={handleCameraError}
          />
        )}

        {/* VISION GRID */}
        <View style={styles.visionGrid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={styles.gridLine} />
          ))}
        </View>

        {/* AI BOUNDING BOX */}
        {visionBox && (
          <Animated.View
            style={[
              styles.visionBox,
              {
                left: visionBox.x,
                top: visionBox.y,
                width: visionBox.width,
                height: visionBox.height,
                borderColor: GOLD,
                shadowColor: GOLD,
                shadowOpacity: lockPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.6],
                }),
                shadowRadius: lockPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [6, 18],
                }),
              },
            ]}
          />
        )}

        {/* CONFIDENCE METER */}
        {confidence !== null && (
          <View style={styles.confidenceMeter}>
            <Text style={styles.confidenceText}>Confidence: {confidence}%</Text>
          </View>
        )}

        {/* CAMERA COULD NOT START */}
        {cameraFailed && (
          <View style={styles.cameraFailed}>
            <Text style={styles.permissionText}>
              The camera couldn't start. It may be in use by another app.
            </Text>
            <Pressable style={styles.permissionButton} onPress={retryCamera}>
              <Text style={styles.permissionButtonText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {/* SUPER NOVA SCAN WAVE */}
        {loading && (
          <Animated.View
            style={[
              styles.scanWave,
              {
                opacity: scanWave.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.15, 0.45],
                }),
              },
            ]}
          />
        )}
      </View>

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <Pressable
          style={styles.smallActionButton}
          onPress={() => router.back()}
        >
          <Text style={styles.smallActionText}>Back</Text>
        </Pressable>

        <Pressable style={styles.shutterOuter} onPress={handleTakePhoto}>
          <View style={styles.shutterInner} />
        </Pressable>

        <View style={{ width: 70 }} />
      </View>

      {/* LOADING OVERLAY */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={GOLD} />
          <Pressable
            style={[styles.smallActionButton, { marginTop: 24 }]}
            onPress={() => abortRef.current?.abort()}
          >
            <Text style={styles.smallActionText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  cameraWrapper: { flex: 1, position: "relative" },
  camera: { flex: 1 },

  visionGrid: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  gridLine: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  visionBox: {
    position: "absolute",
    borderWidth: 3,
    borderRadius: 12,
  },

  confidenceMeter: {
    position: "absolute",
    bottom: "20%",
    left: "8%",
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
  },
  confidenceText: {
    color: GOLD,
    fontSize: 16,
    fontWeight: "700",
  },

  scanWave: {
    ...StyleSheet.absoluteFill,
    backgroundColor: GOLD,
    opacity: 0.2,
  },

  bottomBar: {
    position: "absolute",
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
  },

  smallActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(10,17,40,0.9)",
  },
  smallActionText: { color: "white", fontSize: 13, fontWeight: "600" },

  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: GOLD,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: GOLD,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",

    borderColor: "rgba(255,215,0,0.25)",
    borderWidth: 1.5,
    shadowColor: "rgba(255,215,0,0.45)",
    shadowOpacity: 0.4,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 12 },
  },

  cameraFailed: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  permissionText: {
    color: "white",
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "700",
  },
});
