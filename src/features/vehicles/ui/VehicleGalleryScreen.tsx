import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  Alert,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { analyzeVehiclePhoto } from "@/utils/api";
import { shareImage } from "@/utils/share/shareImage";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { width, height } = Dimensions.get("window");

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// Photos from barcode scans are web links, but reading and sharing need a file
// on the phone, so those are downloaded to the cache first.
async function toLocalFile(uri: string): Promise<string> {
  if (!/^https?:\/\//i.test(uri)) return uri;
  const target = `${FileSystem.cacheDirectory}flip-photo-${Date.now()}.jpg`;
  const result = await FileSystem.downloadAsync(uri, target);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Photo download failed (${result.status})`);
  }
  return result.uri;
}

// --- REAL AI PHOTO ANALYSIS (OpenAI vision via backend /vehicle-photo-analysis) ---
async function analyzePhoto(uri: string) {
  try {
    const localUri = await toLocalFile(uri);
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: "base64" });
    const result = await analyzeVehiclePhoto(base64);
    if (!result || result.ok === false) return null;
    return result;
  } catch (err) {
    console.log("❌ Photo analysis error:", err);
    return null;
  }
}

export default function VehicleGalleryScreen({
  vehicle,
  updateVehicle,
  theme,
}: {
  vehicle: ReturnType<typeof useVehicleHistory>["vehicles"][number];
  updateVehicle: ReturnType<typeof useVehicleHistory>["updateVehicle"];
  theme: any;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showUI, setShowUI] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiData, setAiData] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const images = vehicle.images ?? [];

  // Both gestures run on the JS thread (runOnJS): the swipe changes React
  // state, which a UI-thread worklet cannot do.
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // One finger: swipe to the next/previous photo, or drag around when zoomed in
  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .maxPointers(1)
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        const maxX = ((savedScale.value - 1) * width) / 2;
        const maxY = ((savedScale.value - 1) * height) / 2;
        translateX.value = clamp(savedX.value + e.translationX, -maxX, maxX);
        translateY.value = clamp(savedY.value + e.translationY, -maxY, maxY);
      } else {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
        return;
      }
      if (viewerIndex !== null) {
        if (e.translationX < -80 && viewerIndex < images.length - 1) {
          setViewerIndex(viewerIndex + 1);
        } else if (e.translationX > 80 && viewerIndex > 0) {
          setViewerIndex(viewerIndex - 1);
        }
      }
      translateX.value = withSpring(0);
    });

  // Two fingers: pinch to zoom. The zoom stays after the fingers lift; each
  // pinch multiplies from the level the last one left (savedScale), 1x to 4x.
  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 0.5, 4);
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        savedScale.value = scale.value;
        const maxX = ((scale.value - 1) * width) / 2;
        const maxY = ((scale.value - 1) * height) / 2;
        translateX.value = clamp(translateX.value, -maxX, maxX);
        translateY.value = clamp(translateY.value, -maxY, maxY);
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      }
    });

  // One animated style: separate ones would overwrite each other's transform
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const combinedGesture = Gesture.Simultaneous(swipeGesture, pinchGesture);

  const resetZoom = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
  };

  const openViewer = (index: number) => {
    resetZoom();
    setViewerIndex(index);
  };

  const closeViewer = () => {
    setViewerIndex(null);
    setAiData(null);
    resetZoom();
  };

  // Run real AI photo analysis whenever the viewed photo changes (with AI on)
  React.useEffect(() => {
    if (!aiEnabled || viewerIndex === null) {
      setAiData(null);
      return;
    }

    let cancelled = false;
    setAiLoading(true);
    setAiData(null);

    const photo = images[viewerIndex];
    if (!photo) {
      setAiLoading(false);
      return;
    }

    analyzePhoto(photo).then((result) => {
      if (!cancelled) {
        setAiData(result);
        setAiLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [viewerIndex, aiEnabled]);

  const deleteImage = () => {
    if (viewerIndex === null) return;
    const newImages = images.filter((_, i) => i !== viewerIndex);
    updateVehicle(vehicle.id, { images: newImages });
    setViewerIndex(null);
    setShowDeleteConfirm(false);
    setAiData(null);
    resetZoom();
  };

  const sharePhoto = async () => {
    if (viewerIndex === null || !images[viewerIndex]) return;
    try {
      await shareImage(await toLocalFile(images[viewerIndex]));
    } catch (err) {
      console.log("Photo share error:", err);
      Alert.alert("Couldn't share this photo", "Check your connection and try again.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* FULLSCREEN VIEWER */}
      {viewerIndex !== null && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height,
            backgroundColor: theme.black,
            zIndex: 999,
          }}
        >
          {/* TAP TO HIDE UI */}
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => setShowUI(!showUI)}
          >
            <GestureDetector gesture={combinedGesture}>
              <Animated.Image
                source={{ uri: images[viewerIndex] }}
                style={[
                  {
                    width,
                    height,
                    resizeMode: "contain",
                  },
                  animatedImageStyle,
                ]}
              />
            </GestureDetector>
          </TouchableOpacity>

          {/* TOP UI */}
          {showUI && (
            <View
              style={{
                position: "absolute",
                top: 40,
                left: 0,
                right: 0,
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: 20,
              }}
            >
              <TouchableOpacity
                onPress={closeViewer}
                style={{
                  backgroundColor: theme.card,
                  padding: 10,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.goldSoftGlow,
                }}
              >
                <Text style={{ color: theme.white, fontSize: 18 }}>← Back</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setAiEnabled(!aiEnabled)}
                  style={{
                    backgroundColor: aiEnabled ? theme.goldDeep : theme.card,
                    padding: 10,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.goldSoftGlow,
                  }}
                >
                  <Text
                    style={{
                      color: aiEnabled ? theme.black : theme.white,
                      fontSize: 16,
                    }}
                  >
                    🤖 AI {aiEnabled ? "On" : "Off"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowDeleteConfirm(true)}
                  style={{
                    backgroundColor: theme.goldDeep,
                    padding: 10,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.goldSoftGlow,
                  }}
                >
                  <Text style={{ color: theme.black, fontSize: 18 }}>
                    🗑 Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* AI PANEL */}
          {showUI && aiEnabled && (aiLoading || aiData) && (
            <View
              style={{
                position: "absolute",
                bottom: 120,
                left: 20,
                right: 20,
                backgroundColor: theme.card,
                padding: 16,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.goldSoftGlow,
                shadowColor: theme.goldDeep,
                shadowOpacity: 0.3,
                shadowRadius: 10,
              }}
            >
              <Text
                style={{
                  color: theme.goldDeep,
                  fontSize: 18,
                  fontWeight: "700",
                  marginBottom: 10,
                }}
              >
                🤖 AI Photo Analysis
              </Text>

              {aiLoading ? (
                <Text style={{ color: theme.muted }}>Analysing photo…</Text>
              ) : !aiData ? (
                <Text style={{ color: theme.muted }}>Analysis unavailable — try again.</Text>
              ) : (
                <>
                  <Text style={{ color: theme.white }}>
                    Condition: {aiData.condition}
                  </Text>
                  <Text style={{ color: theme.white, marginTop: 4 }}>
                    Damage: {aiData.damage}
                  </Text>
                  <Text style={{ color: theme.white, marginTop: 4 }}>
                    Rust: {aiData.rust}
                  </Text>
                  <Text style={{ color: theme.white, marginTop: 4 }}>
                    Cleanliness: {aiData.cleanliness}
                  </Text>
                  {aiData.valueImpact > 0 && (
                    <Text style={{ color: theme.danger, marginTop: 4 }}>
                      Estimated value impact: -£{aiData.valueImpact}
                    </Text>
                  )}
                  {aiData.summary && (
                    <Text style={{ color: theme.muted, marginTop: 10 }}>
                      {aiData.summary}
                    </Text>
                  )}
                </>
              )}
            </View>
          )}

          {/* BOTTOM UI */}
          {showUI && (
            <View
              style={{
                position: "absolute",
                bottom: 40,
                left: 0,
                right: 0,
                alignItems: "center",
              }}
            >
              {/* PAGE DOTS */}
              <View style={{ flexDirection: "row", gap: 6 }}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor:
                        i === viewerIndex ? theme.goldDeep : theme.muted,
                    }}
                  />
                ))}
              </View>

              {/* SHARE BUTTON */}
              <TouchableOpacity
                onPress={sharePhoto}
                style={{
                  marginTop: 20,
                  backgroundColor: theme.card,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.goldSoftGlow,
                }}
              >
                <Text style={{ color: theme.white }}>Share Image</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* DELETE CONFIRM MODAL */}
          <Modal transparent visible={showDeleteConfirm}>
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.6)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  backgroundColor: theme.card,
                  padding: 20,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.goldSoftGlow,
                  width: "80%",
                }}
              >
                <Text
                  style={{
                    color: theme.white,
                    fontSize: 18,
                    marginBottom: 20,
                    textAlign: "center",
                  }}
                >
                  Delete this image?
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setShowDeleteConfirm(false)}
                    style={{
                      padding: 10,
                      backgroundColor: theme.card,
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: theme.goldSoftGlow,
                      width: "45%",
                    }}
                  >
                    <Text style={{ color: theme.white, textAlign: "center" }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={deleteImage}
                    style={{
                      padding: 10,
                      backgroundColor: theme.goldDeep,
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: theme.goldSoftGlow,
                      width: "45%",
                    }}
                  >
                    <Text style={{ color: theme.black, textAlign: "center" }}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {/* GRID GALLERY */}
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {images.length === 0 && (
          <Text style={{ color: theme.muted, fontSize: 16 }}>
            No images added yet.
          </Text>
        )}

        {images.map((uri, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => openViewer(index)}
            style={{
              width: "48%",
              backgroundColor: theme.card,
              borderRadius: theme.radius.md,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: theme.goldSoftGlow,
            }}
          >
            <Image
              source={{ uri }}
              style={{
                width: "100%",
                height: 160,
              }}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
