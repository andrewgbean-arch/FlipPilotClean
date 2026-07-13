import React, { useEffect, useState } from "react";
import { StyleSheet, FlatList, View, Image } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";

import ThemedView from "@/src/styles/theme/ThemedView";
import ThemedText from "@/src/styles/theme/ThemedText";
import AnimatedButton from "@/src/components/AnimatedButton";
import { useTheme } from "@/src/context/ThemeContext";

import { CarRecord } from "@/src/car/carTypes";
import { getAllCars, deleteCar, toggleFavourite } from "@/src/car/carStorage";

import { useRouter } from "expo-router";

export default function VehicleListScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<CarRecord[]>([]);

  // Load cars on mount
  useEffect(() => {
    const load = async () => {
      const cars = await getAllCars();
      setVehicles(cars);
    };
    load();
  }, []);

  // Sort by flipScore (highest first)
  const sortedVehicles = [...vehicles].sort((a, b) => {
    const scoreA = a.analytics?.flipScore || 0;
    const scoreB = b.analytics?.flipScore || 0;
    return scoreB - scoreA;
  });

  const handleDelete = async (id: string) => {
    await deleteCar(id);
    const cars = await getAllCars();
    setVehicles(cars);
  };

  const handleFavourite = async (id: string) => {
    await toggleFavourite(id);
    const cars = await getAllCars();
    setVehicles(cars);
  };

  const renderRightActions = (item: CarRecord) => (
    <View style={{ justifyContent: "center", alignItems: "flex-end", marginBottom: 16 }}>
      <AnimatedButton
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          handleFavourite(item.id);
        }}
        style={[
          styles.swipeAction,
          { backgroundColor: theme.accent, borderColor: theme.goldDeep },
        ]}
      >
        <ThemedText style={{ color: theme.black }}>⭐ Favourite</ThemedText>
      </AnimatedButton>
    </View>
  );

  const renderLeftActions = (item: CarRecord) => (
    <View style={{ justifyContent: "center", alignItems: "flex-start", marginBottom: 16 }}>
      <AnimatedButton
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          handleDelete(item.id);
        }}
        style={[
          styles.swipeAction,
          { backgroundColor: theme.danger, borderColor: theme.goldDeep },
        ]}
      >
        <ThemedText style={{ color: theme.white }}>🗑️ Delete</ThemedText>
      </AnimatedButton>
    </View>
  );

  const renderItem = ({ item }: { item: CarRecord }) => {
    const profit = item.analytics?.profit ?? 0;
    const roi = item.analytics?.roi ?? 0;
    const flipScore = item.analytics?.flipScore ?? 0;

    const fade = useSharedValue(0);
    fade.value = withTiming(1, { duration: 600 });

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: fade.value,
      transform: [{ translateY: (1 - fade.value) * 20 }],
    }));

    return (
      <Animated.View style={animatedStyle}>
        <Swipeable
          renderRightActions={() => renderRightActions(item)}
          renderLeftActions={() => renderLeftActions(item)}
        >
          <AnimatedButton
            style={[
              styles.card,
              { borderColor: theme.goldDeep, backgroundColor: theme.card },
            ]}
            onPress={() => router.push(`/vehicle/${item.id}`)}
          >
            {/* IMAGE */}
            {item.imageUri && (
              <Image
                source={{ uri: item.imageUri }}
                style={{
                  width: "100%",
                  height: 160,
                  borderRadius: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: theme.goldSoftGlow,
                }}
              />
            )}

            {/* TITLE */}
            <ThemedText style={[styles.title, { color: theme.accent }]}>
              {item.year} {item.make} {item.model}
            </ThemedText>

            {/* BADGES */}
            <ThemedView style={styles.badgeRow}>
              <ThemedText style={[styles.badge, { color: theme.success }]}>
                💰 Profit £{profit}
              </ThemedText>

              <ThemedText style={[styles.badge, { color: theme.goldDeep }]}>
                ROI {roi.toFixed(0)}%
              </ThemedText>

              <ThemedText style={[styles.badge, { color: theme.accent }]}>
                🔥 Score {flipScore}
              </ThemedText>

              {item.aiSummary?.verdict && (
                <ThemedText style={[styles.badge, { color: theme.white }]}>
                  🤖 {item.aiSummary.verdict}
                </ThemedText>
              )}

              {item.mot?.expiry && (
                <ThemedText style={[styles.badge, { color: theme.white }]}>
                  🚗 MOT {item.mot.expiry}
                </ThemedText>
              )}
            </ThemedView>

            {/* BUTTON ROW */}
            <ThemedView style={styles.buttonRow}>
              <AnimatedButton
                onPress={() => handleFavourite(item.id)}
                style={[
                  styles.actionBtn,
                  item.favourite
                    ? { backgroundColor: theme.accent, borderColor: theme.goldDeep }
                    : { borderColor: theme.goldDeep },
                ]}
              >
                <ThemedText style={{ color: theme.black }}>⭐</ThemedText>
              </AnimatedButton>

              <AnimatedButton
                onPress={() => handleDelete(item.id)}
                style={[
                  styles.actionBtn,
                  { backgroundColor: theme.danger, borderColor: theme.goldDeep },
                ]}
              >
                <ThemedText style={{ color: theme.white }}>🗑️</ThemedText>
              </AnimatedButton>
            </ThemedView>
          </AnimatedButton>
        </Swipeable>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={sortedVehicles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderWidth: 3,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    fontSize: 14,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 3,
    width: 50,
    alignItems: "center",
  },
  swipeAction: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 3,
    marginHorizontal: 8,
  },
});
