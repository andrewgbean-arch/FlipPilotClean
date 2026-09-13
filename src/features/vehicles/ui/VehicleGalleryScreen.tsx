import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  Share,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { analyzeVehiclePhoto } from "@/utils/api";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { width, height } = Dimensions.get("window");

// --- REAL AI PHOTO ANALYSIS (OpenAI vision via backend /vehicle-photo-analysis) ---
async function analyzePhoto(uri: string) {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
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

  // Swipe left/right
  const translateX = useSharedValue(0);
  const swipeGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (viewerIndex !== null) {
        if (e.translationX < -80 && viewerIndex < images.length - 1) {
          setViewerIndex(viewerIndex + 1);
        } else if (e.translationX > 80 && viewerIndex > 0) {
          setViewerIndex(viewerIndex - 1);
        }
      }
      translateX.value = withSpring(0);
    });

  const animatedSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Pinch + zoom
  const scale = useSharedValue(1);
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = e.scale;
    })
    .onEnd(() => {
      scale.value = withSpring(1);
    });

  const animatedZoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const combinedGesture = Gesture.Simultaneous(swipeGesture, pinchGesture);

  const openViewer = (index: number) => {
    setViewerIndex(index);
  };

  const closeViewer = () => {
    setViewerIndex(null);
    setAiData(null);
    scale.value = 1;
    translateX.value = 0;
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

    analyzePhoto(images[viewerIndex]).then((result) => {
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
  };

  const shareImage = async () => {
    if (viewerIndex === null) return;
    await Share.share({
      message: "Check out this flip!",
      url: images[viewerIndex],
    });
  };

  const enhanceImage = () => {
    scale.value = withSpring(1.15);
    setTimeout(() => {
      scale.value = withSpring(1);
    }, 400);
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
                  animatedSwipeStyle,
                  animatedZoomStyle,
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
                onPress={shareImage}
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

              {/* ENHANCE BUTTON */}
              <TouchableOpacity
                onPress={enhanceImage}
                style={{
                  marginTop: 10,
                  backgroundColor: theme.goldDeep,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.goldSoftGlow,
                }}
              >
                <Text style={{ color: theme.black }}>✨ Enhance</Text>
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
