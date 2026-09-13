import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  TextInput,
  Text,
} from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { shareFlip } from "@/utils/share/shareFlip";

// Vehicles added via the manual/scan flow only populate the top-level
// buyPrice/sellPrice/profit fields, not the `pricing` sub-object — fall
// back to those so real flips still show their numbers here.
const getBuyPrice = (f: FlipRecord) => Number(f.pricing?.recommendedBuyPrice ?? f.buyPrice ?? 0);
const getSellPrice = (f: FlipRecord) => Number(f.pricing?.recommendedSellPrice ?? f.sellPrice ?? 0);
const getProfit = (f: FlipRecord) => Number(f.pricing?.predictedProfit ?? f.profit ?? 0);

// text variants
const textVariants = StyleSheet.create({
  h2: { fontSize: 26, fontWeight: "900" },
  h3: { fontSize: 20, fontWeight: "900" },
  body: { fontSize: 16 },
  small: { fontSize: 13, opacity: 0.75 },
});

// Animated pressable
const AnimatedPressable = ({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.timing(scale, {
      toValue: 0.94,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} style={style}>
        {children}
      </Pressable>
    </Animated.View>
  );
};

export default function HistoryScreen() {
  const theme = useTheme();

  const {
    vehicles: flips,
    deleteVehicle,
    toggleFavourite: toggleVehicleFavourite,
    clearAll,
  } = useVehicleHistory();

  const bestFlip = useMemo<FlipRecord | null>(() => {
    if (flips.length === 0) return null;
    return [...flips].sort((a, b) => getProfit(b) - getProfit(a))[0];
  }, [flips]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [overlayText, setOverlayText] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const [sortMode, setSortMode] = useState<
    | "newest"
    | "profit"
    | "roi"
    | "faves"
    | "az"
    | "confidence"
    | "aiPrice"
    | "flipScore"
    | "demand"
    | "rarity"
    | "sellSpeed"
    | "smartPrice"
    | "googlePrice"
  >("newest");

  const [search, setSearch] = useState("");
  const [showFavesOnly, setShowFavesOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const showOverlayMessage = (text: string) => {
    setOverlayText(text);
    setShowOverlay(true);

    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.delay(900),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => setShowOverlay(false));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 300);
  };

  const deleteFlipHard = (id: string | null) => {
    if (!id) return;

    deleteVehicle(id);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showOverlayMessage("Deleted ❌");

    setConfirmDelete(null);
  };

  const deleteFlip = (id: string) => setConfirmDelete(id);

  const clearAllFlips = async () => {
    await clearAll();
    setConfirmClearAll(false);
    showOverlayMessage("Cleared 🧹");
  };

  const toggleFavourite = (id: string) => {
    const isFav = !flips.find((i) => i.id === id)?.favourite;

    toggleVehicleFavourite(id);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showOverlayMessage(isFav ? "Saved ⭐" : "Removed ❌");
  };

  const totalProfit = flips.reduce((sum, item) => sum + getProfit(item), 0);
  const totalItems = flips.length;
  const avgProfit = totalItems > 0 ? totalProfit / totalItems : 0;

  const filteredAndSortedFlips = useMemo(() => {
    let list = [...flips];

    if (search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      list = list.filter((f) => (f.title || "").toLowerCase().includes(q));
    }

    if (showFavesOnly) list = list.filter((f) => f.favourite);

    switch (sortMode) {
      case "profit":
        list.sort((a, b) => getProfit(b) - getProfit(a));
        break;

      case "roi":
        list.sort((a, b) => {
          const aBuy = getBuyPrice(a);
          const bBuy = getBuyPrice(b);
          const aProfit = getProfit(a);
          const bProfit = getProfit(b);

          const aROI = aBuy > 0 ? (aProfit / aBuy) * 100 : 0;
          const bROI = bBuy > 0 ? (bProfit / bBuy) * 100 : 0;

          return bROI - aROI;
        });
        break;

      case "confidence":
        list.sort((a, b) => (b.aiPriceConfidence || 0) - (a.aiPriceConfidence || 0));
        break;

      case "aiPrice":
        list.sort((a, b) => (b.aiPriceMax || 0) - (a.aiPriceMax || 0));
        break;

      case "flipScore":
        list.sort((a, b) => (b.flipScore || 0) - (a.flipScore || 0));
        break;

      case "demand":
        list.sort(
          (a, b) => (b.market?.demandScore || 0) - (a.market?.demandScore || 0)
        );
        break;

      case "rarity":
        list.sort((a, b) => Number(b.rarity || 0) - Number(a.rarity || 0));
        break;

      case "sellSpeed":
        list.sort((a, b) => Number(b.sellSpeed || 0) - Number(a.sellSpeed || 0));
        break;

      case "smartPrice":
        list.sort(
          (a, b) => (b.market?.smartPrice || 0) - (a.market?.smartPrice || 0)
        );
        break;

      case "googlePrice":
        list.sort(
          (a, b) => (b.market?.googlePriceMax || 0) - (a.market?.googlePriceMax || 0)
        );
        break;

      case "az":
        list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;

      case "faves":
        list.sort((a, b) => {
          if (a.favourite === b.favourite)
            return Number(b.id || 0) - Number(a.id || 0);
          return a.favourite ? -1 : 1;
        });
        break;

      case "newest":
      default:
        list.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        break;
    }

    return list;
  }, [flips, search, showFavesOnly, sortMode]);

  const getTrendIcon = (index: number): string => {
    if (index === 0) return "➖";

    const current = filteredAndSortedFlips[index];
    const prev = filteredAndSortedFlips[index - 1];

    if (!current || !prev) return "➖";

    const cProfit = getProfit(current);
    const pProfit = getProfit(prev);

    if (cProfit > pProfit) return "🔺";
    if (cProfit < pProfit) return "🔻";
    return "➖";
  };

  const openDetails = (item: FlipRecord) => {
    router.push({
      pathname: "/scan/scan-results",
      params: { data: JSON.stringify(item) },
    });
  };

  const getRoiColor = (roi: number | null | undefined) => {
    if (roi == null) return theme.muted;
    if (roi > 50) return theme.success;
    if (roi > 0) return theme.accent;
    return theme.danger;
  };

  const exportToCSV = async () => {
    if (flips.length === 0) {
      showOverlayMessage("Nothing to export");
      return;
    }

    const header =
      "Title,Buy,Sell,Profit,ROI,Confidence,AI Price Min,AI Price Max,AI Price Confidence,FlipScore,Rarity,SellSpeed,Google Min,Google Max,SmartPrice,DemandScore,Condition,ConditionScore,Description,FullDescription\n";

    const rows = flips
      .map((f) => {
        const safeBuy = getBuyPrice(f);
        const safeSell = getSellPrice(f);
        const safeProfit = getProfit(f);
        const roi = safeBuy > 0 ? (safeProfit / safeBuy) * 100 : 0;

        return [
          `"${(f.title || "").replace(/"/g, '""')}"`,
          safeBuy.toFixed(2),
          safeSell.toFixed(2),
          safeProfit.toFixed(2),
          roi.toFixed(0),

          Number(f.aiPriceConfidence ?? 0),
          Number(f.aiPriceMin ?? 0),
          Number(f.aiPriceMax ?? 0),
          Number(f.aiPriceConfidence ?? 0),

          Number(f.flipScore ?? 0),
          Number(f.rarity ?? 0),
          Number(f.sellSpeed ?? 0),

          Number(f.market?.googlePriceMin ?? 0),
          Number(f.market?.googlePriceMax ?? 0),
          Number(f.market?.smartPrice ?? 0),
          Number(f.market?.demandScore ?? 0),

          `"${(f.ai?.condition || "").replace(/"/g, '""')}"`,
          Number(f.ai?.conditionScore ?? 0),
          `"${(f.ai?.description || "").replace(/"/g, '""')}"`,
          `"${(f.ai?.fullDescription || "").replace(/"/g, '""')}"`,
        ].join(",");
      })
      .join("\n");

    try {
      await Share.share({
        message: header + rows,
        title: "FlipPilot Export",
      });
    } catch {
      showOverlayMessage("Export failed");
    }
  };

  const renderItem = ({ item, index }: { item: FlipRecord; index: number }) => {
    const trend = getTrendIcon(index);

    const safeBuy = getBuyPrice(item);
    const safeSell = getSellPrice(item);
    const safeProfit = getProfit(item);
    const roi = safeBuy > 0 ? (safeProfit / safeBuy) * 100 : 0;

    const roiColor = getRoiColor(roi);

    return (
      <View>
        <AnimatedPressable
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: 3,
            },
          ]}
          onPress={() => openDetails(item)}
        >
          {typeof item.images?.[0] === "string" &&
            item.images?.[0].trim().length > 0 && (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: item.images?.[0] }} style={styles.image} />
              </View>
            )}

          {/* HEADER */}
          <View style={styles.cardHeaderRow}>
            <Text style={[textVariants.body, styles.name, { color: theme.text }]}>
              📦 {item.title}
            </Text>

            <Text style={[textVariants.body, styles.trendBadge, { color: theme.text }]}>
              {trend}
            </Text>
          </View>

          {/* BUY / SELL */}
          <View style={styles.row}>
            <Text style={[textVariants.body, styles.text, { color: theme.text }]}>
              Buy: £{safeBuy.toFixed(2)}
            </Text>
            <Text style={[textVariants.body, styles.text, { color: theme.text }]}>
              Sell: £{safeSell.toFixed(2)}
            </Text>
          </View>

          {/* PROFIT */}
          <Text
            style={[
              textVariants.h3,
              styles.profit,
              { color: safeProfit >= 0 ? theme.success : theme.danger },
            ]}
          >
            £{safeProfit.toFixed(2)}
          </Text>

          {/* BADGES */}
          <View style={styles.badgeRow}>
            <Text
              style={[
                textVariants.body,
                styles.roiBadge,
                { color: roiColor },
              ]}
            >
              ROI {roi.toFixed(0)}%
            </Text>

            {item.aiPriceConfidence != null && (
              <Text style={[textVariants.body, styles.confBadge, { color: theme.text }]}>
                Conf {item.aiPriceConfidence.toFixed(0)}%
              </Text>
            )}

            {item.flipScore != null && (
              <Text style={[textVariants.body, styles.favBadge, { color: theme.text }]}>
                🔥 Score {item.flipScore}
              </Text>
            )}

            {item.rarity != null && (
              <Text style={[textVariants.body, styles.favBadge, { color: theme.text }]}>
                🎲 Rarity {item.rarity}
              </Text>
            )}

            {item.sellSpeed != null && (
              <Text style={[textVariants.body, styles.favBadge, { color: theme.text }]}>
                ⚡ Speed {item.sellSpeed}
              </Text>
            )}

            {item.market?.demandScore != null && (
              <Text style={[textVariants.body, styles.favBadge, { color: theme.text }]}>
                📈 Demand {item.market.demandScore}
              </Text>
            )}
            {item.favourite && (
              <Text style={[textVariants.body, styles.favBadge, { color: theme.accent }]}>
                ⭐ Favourite
              </Text>
            )}
          </View>

          {/* CONDITION */}
          {item.ai?.condition && (
            <Text
              style={[
                textVariants.body,
                styles.conditionText,
                { color: theme.text },
              ]}
            >
              Condition: {item.ai.condition}
            </Text>
          )}

          {/* AI SUMMARY */}
          {(item.ai?.condition ||
            item.market?.demandScore ||
            item.sellSpeed) && (
            <Text
              style={[
                textVariants.small,
                styles.conditionText,
                { color: theme.muted },
              ]}
            >
              AI:{" "}
              {item.ai?.condition ? `${item.ai.condition} • ` : ""}
              {item.market?.demandScore
                ? `Demand ${item.market.demandScore} • `
                : ""}
              {item.sellSpeed ? `Speed ${item.sellSpeed}` : ""}
            </Text>
          )}

          {/* BUTTON ROW */}
          <View style={styles.buttonRow}>
            {/* SHARE */}
            <AnimatedPressable
              onPress={() =>
                shareFlip({
                  title: item.title,
                  buyPrice: safeBuy,
                  sellPrice: safeSell,
                  roi,
                  profit: safeProfit,
                  confidence: item.aiPriceConfidence || 0,
                  origin: item.ai?.condition || "Unknown",
                  description: item.ai?.description || "",
                  image: item.images?.[0],
                })
              }
              style={[
                styles.fav,
                {
                  backgroundColor: theme.accent,
                  borderColor: theme.goldDeep,
                  borderWidth: 3,
                },
              ]}
            >
              <Text style={[textVariants.h3, { color: theme.black }]}>✈️</Text>
            </AnimatedPressable>

            {/* FAVOURITE */}
            <AnimatedPressable
              onPress={() => toggleFavourite(item.id)}
              style={[
                styles.fav,
                styles.favLabelButton,
                item.favourite
                  ? {
                      backgroundColor: theme.accent,
                      borderColor: theme.goldDeep,
                      borderWidth: 3,
                    }
                  : {
                      borderWidth: 3,
                      borderColor: theme.goldDeep,
                    },
              ]}
            >
              <Text
                style={[
                  styles.favLabelText,
                  {
                    color: item.favourite ? theme.black : theme.accent,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {item.favourite ? "⭐ Favourited" : "☆ Add to Favourites"}
              </Text>
            </AnimatedPressable>

            {/* DELETE */}
            <AnimatedPressable
              onPress={() => deleteFlip(item.id)}
              style={[
                styles.fav,
                {
                  backgroundColor: theme.danger,
                  borderColor: theme.goldDeep,
                  borderWidth: 3,
                },
              ]}
            >
              <Text style={[textVariants.h3, { color: theme.white }]}>🗑️</Text>
            </AnimatedPressable>
          </View>
        </AnimatedPressable>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      {/* HEADER */}
      <View style={styles.headerRow}>
        <Text style={[textVariants.h2, { color: theme.accent }]}>
          ✈️ FlipPilot
        </Text>

        <View style={styles.headerButtonsRow}>
          {/* FAV FILTER */}
          <AnimatedPressable
            style={[
              styles.headerIconBtn,
              showFavesOnly && {
                borderWidth: 2,
                borderColor: theme.goldDeep,
              },
            ]}
            onPress={() => setShowFavesOnly((v) => !v)}
          >
            <Text
              style={[
                textVariants.h3,
                {
                  color: showFavesOnly ? theme.accent : theme.text,
                },
              ]}
            >
              ⭐
            </Text>
          </AnimatedPressable>

          {/* CLEAR ALL */}
          <AnimatedPressable
            style={styles.headerIconBtn}
            onPress={() => setConfirmClearAll(true)}
          >
            <Text style={[textVariants.h3, { color: theme.text }]}>🧹</Text>
          </AnimatedPressable>

          {/* EXPORT */}
          <AnimatedPressable
            style={styles.headerIconBtn}
            onPress={exportToCSV}
          >
            <Text style={[textVariants.h3, { color: theme.text }]}>📤</Text>
          </AnimatedPressable>
        </View>
      </View>

      {/* LIST */}
      <FlatList
        data={filteredAndSortedFlips}
        keyExtractor={(item) => item.id || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
        ListHeaderComponent={
          <>
      {/* DIVIDER */}
      <View
        style={{
          height: 2,
          backgroundColor: theme.goldDeep,
          marginVertical: 12,
          opacity: 0.4,
        }}
      />

      {/* STATS */}
      <View style={styles.statsRow}>
        <View
          style={[
            styles.statBox,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: 3,
            },
          ]}
        >
          <Text
            style={[
              textVariants.h3,
              { color: theme.text, textAlign: "center" },
            ]}
          >
            £{totalProfit.toFixed(2)}
          </Text>
          <Text
            style={[
              textVariants.small,
              { color: theme.muted, textAlign: "center" },
            ]}
          >
            Profit
          </Text>
        </View>

        <View
          style={[
            styles.statBox,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: 3,
            },
          ]}
        >
          <Text
            style={[
              textVariants.h3,
              { color: theme.text, textAlign: "center" },
            ]}
          >
            {totalItems}
          </Text>
          <Text
            style={[
              textVariants.small,
              { color: theme.muted, textAlign: "center" },
            ]}
          >
            Items
          </Text>
        </View>

        <View
          style={[
            styles.statBox,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: 3,
            },
          ]}
        >
          <Text
            style={[
              textVariants.h3,
              { color: theme.text, textAlign: "center" },
            ]}
          >
            £{avgProfit.toFixed(2)}
          </Text>
          <Text
            style={[
              textVariants.small,
              { color: theme.muted, textAlign: "center" },
            ]}
          >
            Avg
          </Text>
        </View>
      </View>

      {/* BEST FLIP */}
      {bestFlip && (
        <AnimatedPressable
          style={[
            styles.bestCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: 3,
            },
          ]}
          onPress={() => openDetails(bestFlip)}
        >
          <View style={styles.bestHeaderRow}>
            <Text style={[textVariants.h3, { color: theme.accent }]}>
              🏆 Best Flip
            </Text>
            <Text style={[textVariants.h3, { color: theme.accent }]}>👑</Text>
          </View>

          {bestFlip.images?.[0] && (
            <View style={styles.bestImageWrapper}>
              <Image
                source={{ uri: bestFlip.images[0] }}
                style={styles.bestImage}
              />
            </View>
          )}

          <Text
            style={[
              textVariants.body,
              { color: theme.text, marginTop: 8 },
            ]}
          >
            {bestFlip.title}
          </Text>

          <Text
            style={[
              textVariants.body,
              { color: theme.muted, marginTop: 4 },
            ]}
          >
            £{getProfit(bestFlip).toFixed(2)} •{" "}
            {(() => {
              const safeBuy = getBuyPrice(bestFlip);
              const safeProfit = getProfit(bestFlip);
              const roi = safeBuy > 0 ? (safeProfit / safeBuy) * 100 : 0;
              return roi.toFixed(0);
            })()}
            %
          </Text>
        </AnimatedPressable>
      )}

      {/* SEARCH */}
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search flips..."
          placeholderTextColor={theme.muted}
          value={search}
          onChangeText={setSearch}
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: 3,
              color: theme.text,
            },
          ]}
        />
      </View>
          </>
        }
      />

      {/* OVERLAY TOAST */}
      {showOverlay && (
        <Animated.View
          style={[
            styles.overlayToast,
            {
              opacity: fadeAnim,
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: 3,
            },
          ]}
        >
          <Text style={{ color: theme.text }}>{overlayText}</Text>
        </Animated.View>
      )}

      {/* DELETE MODAL */}
      <Modal
        visible={!!confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: theme.card,
                borderColor: theme.goldDeep,
                borderWidth: 3,
              },
            ]}
          >
            <Text
              style={[
                textVariants.h3,
                { color: theme.accent, textAlign: "center" },
              ]}
            >
              Delete flip?
            </Text>

            <Text
              style={[
                textVariants.body,
                {
                  color: theme.muted,
                  textAlign: "center",
                  marginTop: 8,
                },
              ]}
            >
              This cannot be undone.
            </Text>

            <View style={styles.modalButtonsRow}>
              <AnimatedPressable
                style={[
                  styles.modalCancel,
                  { borderColor: theme.muted, borderWidth: 2 },
                ]}
                onPress={() => setConfirmDelete(null)}
              >
                <Text style={{ color: theme.text }}>Cancel</Text>
              </AnimatedPressable>

              <AnimatedPressable
                style={[
                  styles.modalDelete,
                  {
                    backgroundColor: theme.danger,
                    borderColor: theme.goldDeep,
                    borderWidth: 3,
                  },
                ]}
                onPress={() => deleteFlipHard(confirmDelete)}
              >
                <Text
                  style={{ color: theme.white, fontWeight: "900" }}
                >
                  Delete
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* CLEAR ALL MODAL */}
      <Modal
        visible={confirmClearAll}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmClearAll(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: theme.card,
                borderColor: theme.goldDeep,
                borderWidth: 3,
              },
            ]}
          >
            <Text
              style={[
                textVariants.h3,
                { color: theme.accent, textAlign: "center" },
              ]}
            >
              Clear all history?
            </Text>

            <Text
              style={[
                textVariants.body,
                {
                  color: theme.muted,
                  textAlign: "center",
                  marginTop: 8,
                },
              ]}
            >
              This will remove all flips from your device.
            </Text>

            <View style={styles.modalButtonsRow}>
              <AnimatedPressable
                style={[
                  styles.modalCancel,
                  { borderColor: theme.muted, borderWidth: 2 },
                ]}
                onPress={() => setConfirmClearAll(false)}
              >
                <Text style={{ color: theme.text }}>Cancel</Text>
              </AnimatedPressable>

              <AnimatedPressable
                style={[
                  styles.modalDelete,
                  {
                    backgroundColor: theme.danger,
                    borderColor: theme.goldDeep,
                    borderWidth: 3,
                  },
                ]}
                onPress={clearAllFlips}
              >
                <Text
                  style={{ color: theme.white, fontWeight: "900" }}
                >
                  Clear
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  /* HEADER */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  /* STATS */
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    padding: 10,
    marginHorizontal: 4,
    borderRadius: 10,
  },

  /* BEST FLIP */
  bestCard: {
    marginVertical: 10,
    padding: 12,
    borderRadius: 12,
  },
  bestHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bestImageWrapper: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  bestImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
  },

  /* SEARCH */
  searchRow: {
    marginVertical: 12,
  },
  searchInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 16,
  },

  /* LIST */
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },

  /* CARD */
  card: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
  },
  imageWrapper: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 160,
    borderRadius: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  name: {
    flex: 1,
    marginRight: 8,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  text: {
    flex: 1,
  },
  profit: {
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  roiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  confBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  favBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  conditionText: {
    marginTop: 6,
  },

  /* BUTTON ROW */
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  fav: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  favLabelButton: {
    flex: 2.2,
    paddingHorizontal: 6,
  },
  favLabelText: {
    fontSize: 13,
    fontWeight: "800",
  },

  /* OVERLAY TOAST */
  overlayToast: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 12,
  },

  /* MODALS */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDelete: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
