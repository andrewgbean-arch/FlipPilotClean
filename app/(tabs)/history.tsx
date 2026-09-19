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
  Share,
  StyleSheet,
  TextInput,
  Text,
} from "react-native";
import { Broom, Export, Heart, Trophy } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import FlipCard, { getBuyPrice, getProfit, getSellPrice } from "@/components/FlipCard";
import { formatMoney, formatSignedMoney } from "@/features/vehicles/utils/vehicleStats";

// Ids are uuids, so recency has to come from the timestamp.
const savedAt = (f: FlipRecord) => Date.parse(f.timestamp) || 0;

// Records that came from the vehicle flows carry a registration and have their
// own detail screen; everything else (scanned items) opens the flip details.
const detailsHref = (f: FlipRecord) =>
  f.mot?.reg ? `/vehicles/details/${f.id}` : `/flip/${f.id}`;

// CSV text cell: rarity and sell speed are words ("Common", "Fast"), not numbers.
const csvText = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;

// text variants
const textVariants = StyleSheet.create({
  h2: { fontSize: 26, fontWeight: "700" },
  h3: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 16 },
  small: { fontSize: 13, opacity: 0.75 },
});

const HAIRLINE = "rgba(255, 255, 255, 0.08)";

// Animated pressable
const AnimatedPressable = ({
  children,
  style,
  onPress,
  accessibilityLabel,
  accessibilityRole,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "link";
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        style={style}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export default function HistoryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const {
    vehicles: flips,
    deleteVehicle,
    toggleFavourite: toggleVehicleFavourite,
    clearAll,
    loaded,
    loadError,
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
    | "smartPrice"
    | "googlePrice"
  >("newest");

  const [search, setSearch] = useState("");
  const [showFavesOnly, setShowFavesOnly] = useState(false);

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

  const deleteFlipHard = (id: string | null) => {
    if (!id) return;

    deleteVehicle(id);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showOverlayMessage("Flip deleted");

    setConfirmDelete(null);
  };

  const deleteFlip = (id: string) => setConfirmDelete(id);

  const clearAllFlips = async () => {
    await clearAll();
    setConfirmClearAll(false);
    showOverlayMessage("History cleared");
  };

  const toggleFavourite = (id: string) => {
    const isFav = !flips.find((i) => i.id === id)?.favourite;

    toggleVehicleFavourite(id);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showOverlayMessage(isFav ? "Added to favourites" : "Removed from favourites");
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
          if (!!a.favourite === !!b.favourite) return savedAt(b) - savedAt(a);
          return a.favourite ? -1 : 1;
        });
        break;

      case "newest":
      default:
        list.sort((a, b) => savedAt(b) - savedAt(a));
        break;
    }

    return list;
  }, [flips, search, showFavesOnly, sortMode]);

  // Saved flips open by id. The scan-results screen only understands a fresh
  // scan payload, and it would offer to save this flip a second time.
  const openDetails = (item: FlipRecord) => {
    router.push(detailsHref(item));
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
          csvText(f.rarity),
          csvText(f.sellSpeed),

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

  const renderItem = ({ item }: { item: FlipRecord }) => (
    <FlipCard
      item={item}
      onOpen={() => openDetails(item)}
      onToggleFavourite={() => toggleFavourite(item.id)}
      onDelete={() => deleteFlip(item.id)}
    />
  );

  const hasFlips = flips.length > 0;
  const emptyTitle = loadError
    ? "Couldn't load your flips"
    : hasFlips
    ? "No matching flips"
    : "No flips yet";
  const emptyBody =
    loadError ??
    (hasFlips
      ? "Try a different search, or turn off the favourites filter."
      : "Scan an item and save it, and it will show up here.");

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top + 16 },
      ]}
    >
      {/* HEADER */}
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: theme.text }]} accessibilityRole="header">
          History
        </Text>

        <View style={styles.headerButtonsRow}>
          {/* FAV FILTER */}
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={showFavesOnly ? "Show all flips" : "Show favourites only"}
            style={[
              styles.headerIconBtn,
              showFavesOnly && { backgroundColor: theme.card },
            ]}
            onPress={() => setShowFavesOnly((v) => !v)}
          >
            <Heart
              size={22}
              weight={showFavesOnly ? "fill" : "regular"}
              color={showFavesOnly ? theme.gold : theme.text}
            />
          </AnimatedPressable>

          {/* CLEAR ALL */}
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Clear all history"
            style={styles.headerIconBtn}
            onPress={() => setConfirmClearAll(true)}
          >
            <Broom size={22} color={theme.text} />
          </AnimatedPressable>

          {/* EXPORT */}
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Export flips"
            style={styles.headerIconBtn}
            onPress={exportToCSV}
          >
            <Export size={22} color={theme.text} />
          </AnimatedPressable>
        </View>
      </View>

      {/* LIST */}
      <FlatList
        data={filteredAndSortedFlips}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          // Nothing until the saved flips have been read, so "No flips yet"
          // never flashes up (or shows for an unreadable list).
          loaded ? (
            <View style={styles.emptyBox}>
              <Text
                style={[textVariants.h3, { color: theme.text, textAlign: "center" }]}
              >
                {emptyTitle}
              </Text>
              <Text
                style={[
                  textVariants.body,
                  { color: theme.muted, textAlign: "center", marginTop: 6 },
                ]}
              >
                {emptyBody}
              </Text>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <>
      {/* SPACER */}
      <View style={{ height: 12 }} />

      {/* STATS */}
      <View style={styles.statsRow}>
        <View
          style={[
            styles.statBox,
            {
              backgroundColor: theme.card,
              borderColor: HAIRLINE,
              borderWidth: 1,
            },
          ]}
        >
          <Text
            style={[
              textVariants.h3,
              { color: theme.text, textAlign: "center" },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatMoney(totalProfit)}
          </Text>
          <Text
            style={[
              textVariants.small,
              { color: theme.muted, textAlign: "center" },
            ]}
          >
            Total profit
          </Text>
        </View>

        <View
          style={[
            styles.statBox,
            {
              backgroundColor: theme.card,
              borderColor: HAIRLINE,
              borderWidth: 1,
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
            Flips
          </Text>
        </View>

        <View
          style={[
            styles.statBox,
            {
              backgroundColor: theme.card,
              borderColor: HAIRLINE,
              borderWidth: 1,
            },
          ]}
        >
          <Text
            style={[
              textVariants.h3,
              { color: theme.text, textAlign: "center" },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {formatMoney(avgProfit)}
          </Text>
          <Text
            style={[
              textVariants.small,
              { color: theme.muted, textAlign: "center" },
            ]}
          >
            Avg profit
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
              borderColor: HAIRLINE,
              borderWidth: 1,
            },
          ]}
          onPress={() => openDetails(bestFlip)}
        >
          <View style={styles.bestHeaderRow}>
            <Trophy size={20} weight="fill" color={theme.gold} />
            <Text style={[textVariants.h3, { color: theme.gold }]}>Best flip</Text>
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
            {formatSignedMoney(getProfit(bestFlip))}
            {(() => {
              const safeBuy = getBuyPrice(bestFlip);
              const safeProfit = getProfit(bestFlip);
              return safeBuy > 0
                ? ` · ROI ${((safeProfit / safeBuy) * 100).toFixed(0)}%`
                : "";
            })()}
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
              borderColor: HAIRLINE,
              borderWidth: 1,
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
              borderColor: HAIRLINE,
              borderWidth: 1,
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
                borderColor: HAIRLINE,
                borderWidth: 1,
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
                    borderColor: HAIRLINE,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => deleteFlipHard(confirmDelete)}
              >
                <Text
                  style={{ color: theme.white, fontWeight: "700" }}
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
                borderColor: HAIRLINE,
                borderWidth: 1,
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
                    borderColor: HAIRLINE,
                    borderWidth: 1,
                  },
                ]}
                onPress={clearAllFlips}
              >
                <Text
                  style={{ color: theme.white, fontWeight: "700" }}
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
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  headerIconBtn: {
    width: 44,
    height: 44,
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
    alignItems: "center",
    gap: 8,
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
  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
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
