import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View, Image, Dimensions } from "react-native";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import AnimatedPressable from "@/components/AnimatedPressable";
import ThemedText from "@/components/ThemedText";
import ThemedView from "@/components/ThemedView";
import { useTheme } from "@/context/ThemeContext";
import * as Haptics from "expo-haptics";

import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

export default function VehicleGallery() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const { vehicles, updateVehicle } = useVehicleHistory();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle || !vehicle.images || vehicle.images.length === 0) {
    return <ThemedText>No images found.</ThemedText>;
  }

  const [index, setIndex] = useState(0);

  const translateX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const swipeGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX < -80 && index < vehicle.images!.length - 1) {
        translateX.value = withTiming(-width, { duration: 200 });
        setTimeout(() => {
          translateX.value = 0;
          setIndex((i) => i + 1);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 200);
      } else if (event.translationX > 80 && index > 0) {
        translateX.value = withTiming(width, { duration: 200 });
        setTimeout(() => {
          translateX.value = 0;
          setIndex((i) => i - 1);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 200);
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const deleteImage = () => {
    const updated = vehicle.images!.filter((_, i) => i !== index);

    updateVehicle(vehicle.id, {
      images: updated.length > 0 ? updated : null,
    });

    if (updated.length === 0) {
      router.back();
      return;
    }

    setIndex(Math.max(0, index - 1));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.black }}>
      <GestureDetector gesture={swipeGesture}>
        <Animated.View
          style={[
            {
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            },
            animatedStyle,
          ]}
        >
          <Image
            source={{ uri: vehicle.images![index] }}
            style={{
              width: width * 0.95,
              height: height * 0.7,
              borderRadius: 16,
              borderWidth: 3,
              borderColor: theme.goldDeep,
              resizeMode: "cover",
            }}
          />

          <ThemedText
            style={{
              marginTop: 12,
              fontSize: 18,
              color: theme.white,
              textAlign: "center",
            }}
          >
            {index + 1} / {vehicle.images!.length}
          </ThemedText>

          <ThemedView
            style={{
              flexDirection: "row",
              gap: 16,
              marginTop: 20,
              justifyContent: "center",
            }}
          >
            {/* PREV */}
            <AnimatedPressable
              onPress={() => index > 0 && setIndex(index - 1)}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: index === 0 ? theme.muted : theme.accent,
                opacity: index === 0 ? 0.5 : 1,
              }}
            >
              <ThemedText style={{ color: theme.black }}>⬅️ Prev</ThemedText>
            </AnimatedPressable>

            {/* DELETE */}
            <AnimatedPressable
              onPress={deleteImage}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: theme.danger,
              }}
            >
              <ThemedText style={{ color: theme.white }}>🗑️ Delete</ThemedText>
            </AnimatedPressable>

            {/* NEXT */}
            <AnimatedPressable
              onPress={() =>
                index < vehicle.images!.length - 1 && setIndex(index + 1)
              }
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor:
                  index === vehicle.images!.length - 1
                    ? theme.muted
                    : theme.accent,
                opacity: index === vehicle.images!.length - 1 ? 0.5 : 1,
              }}
            >
              <ThemedText style={{ color: theme.black }}>Next ➡️</ThemedText>
            </AnimatedPressable>
          </ThemedView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
