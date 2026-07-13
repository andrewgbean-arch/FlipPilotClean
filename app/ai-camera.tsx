import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";

import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const NAVY = "#0A1128";
const GOLD = "#FFD700";

export default function AiCameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [loading, setLoading] = useState(false);

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
    Animated.loop(
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
    ).start();
  };

  const buildUnifiedPayload = (raw: any, image: string) => {
    return {
      title: raw.title || "Unknown Item",
      image,
      barcode: "N/A",
      buy: raw.smartPrice ?? null,
      sell: raw.googlePriceMax ?? null,
      confidence: raw.confidence ?? null,
      google: {
        min: raw.googlePriceMin ?? null,
        max: raw.googlePriceMax ?? null,
      },
      ebay: {
        average: raw.ebayData?.average ?? null,
        lowest: raw.ebayData?.lowest ?? null,
        highest: raw.ebayData?.highest ?? null,
      },
      amazon: {
        min: raw.amazonPriceMin ?? null,
        max: raw.amazonPriceMax ?? null,
      },
    };
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || loading) return;

    setLoading(true);
    startScanWave();

    try {
      const photo = await cameraRef.current.takePicture();

      const base64 = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: "base64",
      });

      const res = await fetch("http://192.168.0.47:3001/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          userId: "demo-user-1",
          deviceId: "device-1",
        }),
      });

      const data = await res.json();

      // SUPER NOVA VISION MODE DATA
      setVisionBox(data.ai?.box ?? null);
      setConfidence(data.ai?.confidence ?? null);

      const raw = {
        ...data.market,
        ...data.ai,
      };

      const payload = buildUnifiedPayload(raw, photo.uri);

      router.push({
        pathname: "/scan/scan-results",
        params: { data: JSON.stringify(payload) },
      });
    } catch (err) {
      console.log("AI camera error:", err);

      router.push({
        pathname: "/scan/scan-results",
        params: {
          data: JSON.stringify({
            title: "Unknown Item",
            image: "",
            barcode: "N/A",
            buy: null,
            sell: null,
            confidence: null,
            google: { min: null, max: null },
            ebay: { average: null, lowest: null, highest: null },
            amazon: { min: null, max: null },
          }),
        },
      });
    }

    setLoading(false);
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access is required</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  startLockPulse();

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        <CameraView style={styles.camera} ref={cameraRef} facing="back" />

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
            <Text style={styles.confidenceText}>
              Confidence: {(confidence * 100).toFixed(1)}%
            </Text>
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
