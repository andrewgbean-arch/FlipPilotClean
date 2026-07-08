import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
} from "react-native";


type ViewShotRef = {
  capture?: () => Promise<string>;
};


import { ThemedText } from "../../src/styles/theme/ThemedText";
import ThemedView from "../../src/styles/theme/ThemedView";

import { useTheme } from "../../src/context/ThemeContext";
import { FlipRecord } from "../../src/models/FlipRecord";
import { shareFlip } from "../../src/utils/share/shareFlip";


const STORAGE_KEY = "@flippilot_history";

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
  const theme = useTheme();
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
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export default function HistoryScreen() {
  const theme = useTheme();

  const [flips, setFlips] = useState<FlipRecord[]>([]);
  const [bestFlip, setBestFlip] = useState<FlipRecord | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
 const shareCardRefs = useRef<Record<string, ViewShotRef | null>>({});


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

  const loadFlips = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: FlipRecord[] = data ? JSON.parse(data) : [];

      const sortedByTime = [...parsed].sort(
        (a, b) => Number(b.id || 0) - Number(a.id || 0)
      );
      setFlips(sortedByTime);

      if (parsed.length > 0) {
        const best = [...parsed].sort(
          (a, b) =>
            (b.pricing?.predictedProfit || 0) -
            (a.pricing?.predictedProfit || 0)
        )[0];
        setBestFlip(best);
      } else {
        setBestFlip(null);
      }
    } catch {
      setFlips([]);
      setBestFlip(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFlips();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFlips();
    setRefreshing(false);
  };

  const deleteFlipHard = async (id: string | null) => {
    if (!id) return;

    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: FlipRecord[] = existing ? JSON.parse(existing) : [];
    const updated = parsed.filter((f) => f.id !== id);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setFlips(
      [...updated].sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showOverlayMessage("Deleted ❌");

    if (updated.length > 0) {
      const best = [...updated].sort(
        (a, b) =>
          (b.pricing?.predictedProfit || 0) -
          (a.pricing?.predictedProfit || 0)
      )[0];
      setBestFlip(best);
    } else {
      setBestFlip(null);
    }

    setConfirmDelete(null);
  };

  const deleteFlip = (id: string) => setConfirmDelete(id);

  const clearAllFlips = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setFlips([]);
    setBestFlip(null);
    setConfirmClearAll(false);
    showOverlayMessage("Cleared 🧹");
  };

  const toggleFavourite = async (id: string) => {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: FlipRecord[] = existing ? JSON.parse(existing) : [];

    const updated = parsed.map((item) =>
      item.id === id ? { ...item, favourite: !item.favourite } : item
    );

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    const sorted = [...updated].sort(
      (a, b) => Number(b.id || 0) - Number(a.id || 0)
    );
    setFlips(sorted);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const isFav = updated.find((i) => i.id === id)?.favourite;
    showOverlayMessage(isFav ? "Saved ⭐" : "Removed ❌");

    if (updated.length > 0) {
      const best = [...updated].sort(
        (a, b) =>
          (b.pricing?.predictedProfit || 0) -
          (a.pricing?.predictedProfit || 0)
      )[0];
      setBestFlip(best);
    } else {
      setBestFlip(null);
    }
  };

  const totalProfit = flips.reduce(
    (sum, item) => sum + (item.pricing?.predictedProfit || 0),
    0
  );
  const totalItems = flips.length;
  const avgProfit = totalItems > 0 ? totalProfit / totalItems : 0;

  const filteredAndSortedFlips = useMemo(() => {
    let list = [...flips];

    if (search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      list = list.filter((f) =>
        (f.title || "").toLowerCase().includes(q)
      );
    }

    if (showFavesOnly) list = list.filter((f) => f.favourite);

    switch (sortMode) {
      case "profit":
        list.sort(
          (a, b) =>
            (b.pricing?.predictedProfit || 0) -
            (a.pricing?.predictedProfit || 0)
        );
        break;

      case "roi":
        list.sort((a, b) => {
          const aBuy = Number(a.pricing?.recommendedBuyPrice || 0);
          const bBuy = Number(b.pricing?.recommendedBuyPrice || 0);
          const aProfit = Number(a.pricing?.predictedProfit || 0);
          const bProfit = Number(b.pricing?.predictedProfit || 0);

          const aROI = aBuy > 0 ? (aProfit / aBuy) * 100 : 0;
          const bROI = bBuy > 0 ? (bProfit / bBuy) * 100 : 0;

          return bROI - aROI;
        });
        break;

      case "confidence":
        list.sort(
          (a, b) =>
            (b.aiPriceConfidence || 0) -
            (a.aiPriceConfidence || 0)
        );
        break;

      case "aiPrice":
        list.sort(
          (a, b) =>
            (b.aiPriceMax || 0) - (a.aiPriceMax || 0)
        );
        break;

      case "flipScore":
        list.sort(
          (a, b) => (b.flipScore || 0) - (a.flipScore || 0)
        );
        break;

      case "demand":
        list.sort(
          (a, b) =>
            (b.market?.demandScore || 0) -
            (a.market?.demandScore || 0)
        );
        break;

      case "rarity":
        list.sort(
          (a, b) =>
            Number(b.rarity || 0) - Number(a.rarity || 0)
        );
        break;

      case "sellSpeed":
        list.sort(
          (a, b) =>
            Number(b.sellSpeed || 0) - Number(a.sellSpeed || 0)
        );
        break;

      case "smartPrice":
        list.sort(
          (a, b) =>
            (b.market?.smartPrice || 0) -
            (a.market?.smartPrice || 0)
        );
        break;

      case "googlePrice":
        list.sort(
          (a, b) =>
            (b.market?.googlePriceMax || 0) -
            (a.market?.googlePriceMax || 0)
        );
        break;

      case "az":
        list.sort((a, b) =>
          (a.title || "").localeCompare(b.title || "")
        );
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
        list.sort(
          (a, b) => Number(b.id || 0) - Number(a.id || 0)
        );
        break;
    }

    return list;
  }, [flips, search, showFavesOnly, sortMode]);

  const getTrendIcon = (index: number): string => {
    if (index === 0) return "➖";

    const current = filteredAndSortedFlips[index];
    const prev = filteredAndSortedFlips[index - 1];

    if (!current || !prev) return "➖";

    const cProfit = current.pricing?.predictedProfit || 0;
    const pProfit = prev.pricing?.predictedProfit || 0;

    if (cProfit > pProfit) return "🔺";
    if (cProfit < pProfit) return "🔻";
    return "➖";
  };

  const openDetails = (item: FlipRecord) => {
    router.push({
      pathname: "/flip/[id]",
      params: { id: item.id },
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
      const safeBuy = Number(f.pricing?.recommendedBuyPrice || 0);
      const safeSell = Number(f.pricing?.recommendedSellPrice || 0);
      const safeProfit = Number(f.pricing?.predictedProfit || 0);
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

 const renderItem = ({
  item,
  index,
}: {
  item: FlipRecord;
  index: number;
}) => {
  const trend = getTrendIcon(index);

  const safeBuy = Number(item.pricing?.recommendedBuyPrice || 0);
  const safeSell = Number(item.pricing?.recommendedSellPrice || 0);
  const safeProfit = Number(item.pricing?.predictedProfit || 0);
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
        {/* IMAGE */}
        {typeof item.image === "string" &&
          item.image.trim().length > 0 && (
            <ThemedView style={styles.imageWrapper}>
              <Image
                source={{ uri: item.image }}
                style={styles.image}
              />
            </ThemedView>
          )}

        {/* HEADER */}
        <ThemedView style={styles.cardHeaderRow}>
          <ThemedText style={[textVariants.body, styles.name]}>
            📦 {item.title}
          </ThemedText>

          <ThemedText
            style={[textVariants.body, styles.trendBadge]}
          >
            {trend}
          </ThemedText>
        </ThemedView>

        {/* BUY / SELL */}
        <ThemedView style={styles.row}>
          <ThemedText style={[textVariants.body, styles.text]}>
            Buy: £{safeBuy.toFixed(2)}
          </ThemedText>
          <ThemedText style={[textVariants.body, styles.text]}>
            Sell: £{safeSell.toFixed(2)}
          </ThemedText>
        </ThemedView>

        {/* PROFIT */}
        <ThemedText
          style={[
            textVariants.h3,
            styles.profit,
            { color: safeProfit >= 0 ? theme.success : theme.danger },
          ]}
        >
          £{safeProfit.toFixed(2)}
        </ThemedText>

        {/* BADGES */}
        <ThemedView style={styles.badgeRow}>
          <ThemedText
            style={[
              textVariants.body,
              styles.roiBadge,
              { color: roiColor },
            ]}
          >
            ROI {roi.toFixed(0)}%
          </ThemedText>

          {item.aiPriceConfidence != null && (
            <ThemedText style={[textVariants.body, styles.confBadge]}>
              Conf {item.aiPriceConfidence.toFixed(0)}%
            </ThemedText>
          )}

          {item.flipScore != null && (
            <ThemedText style={[textVariants.body, styles.favBadge]}>
              🔥 Score {item.flipScore}
            </ThemedText>
          )}

          {item.rarity != null && (
            <ThemedText style={[textVariants.body, styles.favBadge]}>
              🎲 Rarity {item.rarity}
            </ThemedText>
          )}

          {item.sellSpeed != null && (
            <ThemedText style={[textVariants.body, styles.favBadge]}>
              ⚡ Speed {item.sellSpeed}
            </ThemedText>
          )}

          {item.market?.demandScore != null && (
            <ThemedText style={[textVariants.body, styles.favBadge]}>
              📈 Demand {item.market.demandScore}
            </ThemedText>
          )}

          {item.favourite && (
            <ThemedText style={[textVariants.body, styles.favBadge]}>
              ⭐ Favourite
            </ThemedText>
          )}
        </ThemedView>

        {/* CONDITION */}
        {item.ai?.condition && (
          <ThemedText
            style={[textVariants.body, styles.conditionText]}
          >
            Condition: {item.ai.condition}
          </ThemedText>
        )}

        {/* AI SUMMARY */}
        {(item.ai?.condition ||
          item.market?.demandScore ||
          item.sellSpeed) && (
          <ThemedText
            style={[textVariants.small, styles.conditionText]}
          >
            AI:{" "}
            {item.ai?.condition ? `${item.ai.condition} • ` : ""}
            {item.market?.demandScore
              ? `Demand ${item.market.demandScore} • `
              : ""}
            {item.sellSpeed ? `Speed ${item.sellSpeed}` : ""}
          </ThemedText>
        )}

        {/* BUTTON ROW */}
        <ThemedView style={styles.buttonRow}>

          {/* SHARE TEXT */}
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
                image: item.image,
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
            <ThemedText style={[textVariants.h3, { color: theme.black }]}>
              ✈️
            </ThemedText>
          </AnimatedPressable>

          {/* FAVOURITE */}
          <AnimatedPressable
            onPress={() => toggleFavourite(item.id)}
            style={[
              styles.fav,
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
            <ThemedText
              style={[
                textVariants.h3,
                {
                  color: item.favourite ? theme.black : theme.accent,
                },
              ]}
            >
              ⭐
            </ThemedText>
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
            <ThemedText style={[textVariants.h3, { color: theme.white }]}>
              🗑️
            </ThemedText>
          </AnimatedPressable>

        </ThemedView>
      </AnimatedPressable>
    </View>
  );
};



   return (
    <ThemedView
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      {/* HEADER */}
      <ThemedView style={styles.headerRow}>
        <ThemedText style={[textVariants.h2, { color: theme.accent }]}>
          ✈️ FlipPilot
        </ThemedText>

        <ThemedView style={styles.headerButtonsRow}>
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
            <ThemedText
              style={[
                textVariants.h3,
                {
                  color: showFavesOnly ? theme.accent : theme.text,
                },
              ]}
            >
              ⭐
            </ThemedText>
          </AnimatedPressable>

          {/* CLEAR ALL */}
          <AnimatedPressable
            style={styles.headerIconBtn}
            onPress={() => setConfirmClearAll(true)}
          >
            <ThemedText style={[textVariants.h3, { color: theme.text }]}>
              🧹
            </ThemedText>
          </AnimatedPressable>

          {/* EXPORT */}
          <AnimatedPressable
            style={styles.headerIconBtn}
            onPress={exportToCSV}
          >
            <ThemedText style={[textVariants.h3, { color: theme.text }]}>
              📤
            </ThemedText>
          </AnimatedPressable>
        </ThemedView>
      </ThemedView>

      {/* GOLD DIVIDER (H2 CHOICE) */}
      <ThemedView
        style={{
          height: 2,
          backgroundColor: theme.goldDeep,
          marginVertical: 12,
          opacity: 0.4,
        }}
      />

      {/* STATS ROW */}
      <ThemedView style={styles.statsRow}>
        <ThemedView
          style={[
            styles.statBox,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: 3,
            },
          ]}
        >
          <ThemedText style={[textVariants.h3, { color: theme.text, textAlign: "center" }]}>
            £{totalProfit.toFixed(2)}
          </ThemedText>
          <ThemedText style={[textVariants.small, { color: theme.muted, textAlign: "center" }]}>
            Profit
          </ThemedText>
        </ThemedView>

        <ThemedView
          style={[
            styles.statBox,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: 3,
            },
          ]}
        >
          <ThemedText style={[textVariants.h3, { color: theme.text, textAlign: "center" }]}>
            {totalItems}
          </ThemedText>
          <ThemedText style={[textVariants.small, { color: theme.muted, textAlign: "center" }]}>
            Items
          </ThemedText>
        </ThemedView>

        <ThemedView
          style={[
            styles.statBox,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: 3,
            },
          ]}
        >
          <ThemedText style={[textVariants.h3, { color: theme.text, textAlign: "center" }]}>
            £{avgProfit.toFixed(2)}
          </ThemedText>
          <ThemedText style={[textVariants.small, { color: theme.muted, textAlign: "center" }]}>
            Avg
          </ThemedText>
        </ThemedView>
      </ThemedView>

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
          <ThemedView style={styles.bestHeaderRow}>
            <ThemedText style={[textVariants.h3, { color: theme.accent }]}>
              🏆 Best Flip
            </ThemedText>
            <ThemedText style={[textVariants.h3, { color: theme.accent }]}>
              👑
            </ThemedText>
          </ThemedView>

          {bestFlip.image && (
            <ThemedView style={styles.bestImageWrapper}>
              <Image
                source={{ uri: bestFlip.image }}
                style={styles.bestImage}
              />
            </ThemedView>
          )}

          <ThemedText style={[textVariants.body, { color: theme.text, marginTop: 8 }]}>
            {bestFlip.title}
          </ThemedText>

          <ThemedText style={[textVariants.body, { color: theme.muted, marginTop: 4 }]}>
            £{(bestFlip.pricing?.predictedProfit || 0).toFixed(2)} •{" "}
            {(() => {
              const safeBuy = Number(bestFlip.pricing?.recommendedBuyPrice || 0);
              const safeProfit = Number(bestFlip.pricing?.predictedProfit || 0);
              const roi = safeBuy > 0 ? (safeProfit / safeBuy) * 100 : 0;
              return roi.toFixed(0);
            })()}
            %
          </ThemedText>
        </AnimatedPressable>
      )}

      {/* SEARCH BAR */}
      <ThemedView style={styles.searchRow}>
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
      </ThemedView>

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
          <ThemedText style={{ color: theme.text }}>
            {overlayText}
          </ThemedText>
        </Animated.View>
      )}

      {/* DELETE MODAL */}
      <Modal
        visible={!!confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(null)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView
            style={[
              styles.modalContainer,
              {
                backgroundColor: theme.card,
                borderColor: theme.goldDeep,
                borderWidth: 3,
              },
            ]}
          >
            <ThemedText style={[textVariants.h3, { color: theme.accent, textAlign: "center" }]}>
              Delete flip?
            </ThemedText>

            <ThemedText style={[textVariants.body, { color: theme.muted, textAlign: "center", marginTop: 8 }]}>
              This cannot be undone.
            </ThemedText>

            <ThemedView style={styles.modalButtonsRow}>
              <AnimatedPressable
                style={[
                  styles.modalCancel,
                  { borderColor: theme.muted, borderWidth: 2 },
                ]}
                onPress={() => setConfirmDelete(null)}
              >
                <ThemedText style={{ color: theme.text }}>
                  Cancel
                </ThemedText>
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
                <ThemedText style={{ color: theme.white, fontWeight: "900" }}>
                  Delete
                </ThemedText>
              </AnimatedPressable>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      {/* CLEAR ALL MODAL */}
      <Modal
        visible={confirmClearAll}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmClearAll(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView
            style={[
              styles.modalContainer,
              {
                backgroundColor: theme.card,
                borderColor: theme.goldDeep,
                borderWidth: 3,
              },
            ]}
          >
            <ThemedText style={[textVariants.h3, { color: theme.accent, textAlign: "center" }]}>
              Clear all history?
            </ThemedText>

            <ThemedText style={[textVariants.body, { color: theme.muted, textAlign: "center", marginTop: 8 }]}>
              This will remove all flips from your device.
            </ThemedText>

            <ThemedView style={styles.modalButtonsRow}>
              <AnimatedPressable
                style={[
                  styles.modalCancel,
                  { borderColor: theme.muted, borderWidth: 2 },
                ]}
                onPress={() => setConfirmClearAll(false)}
              >
                <ThemedText style={{ color: theme.text }}>
                  Cancel
                </ThemedText>
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
                <ThemedText style={{ color: theme.white, fontWeight: "900" }}>
                  Clear
                </ThemedText>
              </AnimatedPressable>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}


/* ============================
   STYLES (THEME-READY)
   ============================ */

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
    borderRadius: 10,
    overflow: "hidden",
  },
  bestImage: {
    width: "100%",
    height: 160,
    resizeMode: "cover",
  },

  /* SEARCH */
  searchRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  searchInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  /* LIST */
  listContent: {
    paddingBottom: 40,
  },

  /* CARD */
  card: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
  },
  imageWrapper: {
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
  },
  image: {
    width: "100%",
    height: 160,
    resizeMode: "cover",
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
    opacity: 0.7,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  text: {},
  profit: {
    marginTop: 4,
  },

  /* BADGES */
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
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
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  fav: {
    flex: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  /* OVERLAY TOAST */
  overlayToast: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
  },

  /* MODALS */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    borderRadius: 12,
    padding: 16,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 16,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  modalDelete: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
});
