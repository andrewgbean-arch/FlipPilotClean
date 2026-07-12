import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

import ThemedView from "@/components/ThemedView";
import ThemedText from "@/components/ThemedText";
import AnimatedPressable from "@/components/AnimatedPressable";
import { useTheme } from "@/context/ThemeContext";

import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

import { StyleSheet, FlatList, View, Image } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";

import { useRouter } from "expo-router";

export default function VehicleListScreen() {
  const { vehicles, toggleFavourite, deleteVehicle } = useVehicleHistory();
  const theme = useTheme();
  const router = useRouter();

  // Sort by flipScore (highest first)
  const sortedVehicles = [...vehicles].sort((a, b) => {
    const scoreA = a.flipScore || 0;
    const scoreB = b.flipScore || 0;
    return scoreB - scoreA;
  });

  const renderRightActions = (item: FlipRecord) => (
    <View style={{ justifyContent: "center", alignItems: "flex-end", marginBottom: 16 }}>
      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          toggleFavourite(item.id);
        }}
        style={[
          styles.swipeAction,
          { backgroundColor: theme.accent, borderColor: theme.goldDeep },
        ]}
      >
        <ThemedText style={{ color: theme.black }}>⭐ Favourite</ThemedText>
      </AnimatedPressable>
    </View>
  );

  const renderLeftActions = (item: FlipRecord) => (
    <View style={{ justifyContent: "center", alignItems: "flex-start", marginBottom: 16 }}>
      <AnimatedPressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteVehicle(item.id);
        }}
        style={[
          styles.swipeAction,
          { backgroundColor: theme.danger, borderColor: theme.goldDeep },
        ]}
      >
        <ThemedText style={{ color: theme.white }}>🗑️ Delete</ThemedText>
      </AnimatedPressable>
    </View>
  );

  const renderItem = ({ item }: { item: FlipRecord }) => {
    const safeBuy = item.buyPrice || 0;
    const safeSell = item.sellPrice || 0;
    const profit = safeSell - safeBuy;
    const roi = safeBuy > 0 ? ((safeSell - safeBuy) / safeBuy) * 100 : 0;

    const roiColor =
      roi > 40
        ? theme.success
        : roi > 20
        ? theme.goldDeep
        : roi > 10
        ? theme.accent
        : theme.text;

    const riskColor =
      item.aiPrice?.riskLevel === "low"
        ? "#4CAF50"
        : item.aiPrice?.riskLevel === "medium"
        ? "#FFD966"
        : item.aiPrice?.riskLevel === "high"
        ? "#FF6666"
        : theme.muted;

    const motStatus =
      item.mot?.motStatus === "Valid"
        ? "MOT OK"
        : item.mot?.motStatus === "Expired"
        ? "MOT Expired"
        : item.mot?.motStatus || "MOT Unknown";

    const fade = useSharedValue(0);
    fade.value = withTiming(1, { duration: 600 });

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: fade.value,
      transform: [{ translateY: (1 - fade.value) * 20 }],
    }));

    const hasImages = Array.isArray(item.images) && item.images.length > 0;

    return (
      <Animated.View style={animatedStyle}>
        <Swipeable
          renderRightActions={() => renderRightActions(item)}
          renderLeftActions={() => renderLeftActions(item)}
        >
          <AnimatedPressable
            style={[
              styles.card,
              { borderColor: theme.goldDeep, backgroundColor: theme.card },
            ]}
            onPress={() => router.push(`/vehicle/${item.id}`)}
          >
            {/* THUMBNAIL */}
            {hasImages && (
              <Image
                source={{ uri: item.images![0] }}
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
              {item.title}
            </ThemedText>

            {/* BADGES */}
            <ThemedView style={styles.badgeRow}>
              <ThemedText style={[styles.badge, { color: roiColor }]}>
                💰 Profit £{profit}
              </ThemedText>

              <ThemedText style={[styles.badge, { color: roiColor }]}>
                ROI {roi.toFixed(0)}%
              </ThemedText>

              {item.flipScore != null && (
                <ThemedText style={[styles.badge, { color: theme.goldDeep }]}>
                  🔥 Score {item.flipScore}
                </ThemedText>
              )}

              {item.aiPrice?.recommendedSellPrice && (
                <ThemedText style={[styles.badge, { color: theme.white }]}>
                  🤖 AI £{item.aiPrice.recommendedSellPrice}
                </ThemedText>
              )}

              {item.aiPrice?.riskLevel && (
                <ThemedText style={[styles.badge, { color: riskColor }]}>
                  ⚠️ {item.aiPrice.riskLevel.toUpperCase()}
                </ThemedText>
              )}

              {item.mot && (
                <ThemedText style={[styles.badge, { color: theme.white }]}>
                  🚗 {motStatus}
                </ThemedText>
              )}

              {item.favourite && (
                <ThemedText style={[styles.badge]}>
                  ⭐ Favourite
                </ThemedText>
              )}
            </ThemedView>

            {/* AI SUMMARY */}
            {(item.ai?.condition ||
              item.market?.demandScore ||
              item.sellSpeed) && (
              <ThemedText style={[styles.aiSummary]}>
                AI:{" "}
                {[
                  item.ai?.condition && item.ai.condition,
                  item.market?.demandScore &&
                    `Demand ${item.market.demandScore}`,
                  item.sellSpeed && `Speed ${item.sellSpeed}`,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </ThemedText>
            )}

            {/* BUTTON ROW */}
            <ThemedView style={styles.buttonRow}>
              <AnimatedPressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleFavourite(item.id);
                }}
                style={[
                  styles.actionBtn,
                  item.favourite
                    ? {
                        backgroundColor: theme.accent,
                        borderColor: theme.goldDeep,
                      }
                    : { borderColor: theme.goldDeep },
                ]}
              >
                <ThemedText
                  style={{
                    color: item.favourite ? theme.black : theme.accent,
                  }}
                >
                  ⭐
                </ThemedText>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Warning
                  );
                  deleteVehicle(item.id);
                }}
                style={[
                  styles.actionBtn,
                  { backgroundColor: theme.danger, borderColor: theme.goldDeep },
                ]}
              >
                <ThemedText style={{ color: theme.white }}>🗑️</ThemedText>
              </AnimatedPressable>
            </ThemedView>
          </AnimatedPressable>
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
  aiSummary: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 12,
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
