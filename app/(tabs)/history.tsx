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
  ScrollView,
  Share,
  StyleProp,
  StyleSheet,
  TextInput,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { Broom, Export, ShoppingBag, Trophy } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import FlipCard, { getBuyPrice, getProfit, getSellPrice } from "@/components/FlipCard";
import { bestBoughtFlip, boughtState, profitSummary } from "@/features/vehicles/utils/boughtStatus";
import { formatMoney, formatSignedMoney } from "@/features/vehicles/utils/vehicleStats";
import { TourTarget } from "@/features/tour/TourTarget";

// Ids are uuids, so recency has to come from the timestamp.
const savedAt = (f: FlipRecord) => Date.parse(f.timestamp) || 0;

// Records that came from the vehicle flows carry a registration and have their
// own detail screen; everything else (scanned items) opens the flip details.
const detailsHref = (f: FlipRecord) =>
  f.mot?.reg ? `/vehicles/details/${f.id}` : `/flip/${f.id}`;

// CSV text cell: rarity and sell speed are words ("Common", "Fast"), not numbers.
const csvText = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;

type SortMode =
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
  | "googlePrice";

// The switch below already sorts by every one of these; this is what turns that
// into something the user can actually pick (it never had a control at all).
const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "profit", label: "Profit" },
  { id: "roi", label: "ROI" },
  { id: "flipScore", label: "FlipScore" },
  { id: "confidence", label: "Confidence" },
  { id: "aiPrice", label: "AI price" },
  { id: "smartPrice", label: "Smart price" },
  { id: "googlePrice", label: "Market price" },
  { id: "demand", label: "Demand" },
  { id: "az", label: "A–Z" },
  { id: "faves", label: "Favourites" },
];

// text variants
const textVariants = StyleSheet.create({
  h2: { fontSize: 26, fontWeight: "700" },
  h3: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 16 },
  small: { fontSize: 13, opacity: 0.75 },
});

const HAIRLINE = "rgba(255, 255, 255, 0.08)";

// Animated pressable
//
// The press animation needs a wrapper around the Pressable, so this is TWO boxes: the wrapper takes the
// button's place in its parent's layout, and the Pressable fills the wrapper. `style` is the look (padding,
// border, colour) and must never carry `flex`: a flexed Pressable inside the wrapper is squashed down to its
// own padding and the label inside it is not drawn at all — that is what left the delete and clear-all
// buttons as two blank pills. Where the button sits in its row (e.g. half the width) goes in `wrapperStyle`.
const AnimatedPressable = ({
  children,
  style,
  wrapperStyle,
  onPress,
  accessibilityLabel,
  accessibilityRole,
}: {
  children: React.ReactNode;
  style?: any;
  wrapperStyle?: StyleProp<ViewStyle>;
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
    <Animated.View style={[wrapperStyle, { transform: [{ scale }] }]}>
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

  // The best flip is the best of what was actually BOUGHT: an estimate on something never bought isn't a flip.
  const bestFlip = useMemo<FlipRecord | null>(() => bestBoughtFlip(flips), [flips]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [overlayText, setOverlayText] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const [search, setSearch] = useState("");
  const [showFavesOnly, setShowFavesOnly] = useState(false);
  // Show only the saved items that haven't been answered with "Did you buy it?" yet.
  const [toConfirmOnly, setToConfirmOnly] = useState(false);

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

  // Only what was actually bought counts towards profit (see boughtStatus.ts); the rest is still an estimate.
  const summary = useMemo(() => profitSummary(flips), [flips]);
  const totalProfit = summary.total;
  const totalItems = flips.length;
  const avgProfit = summary.bought > 0 ? totalProfit / summary.bought : 0;
  const toConfirmActive = toConfirmOnly && summary.unconfirmed > 0;
  const favouriteCount = useMemo(() => flips.filter((f) => f.favourite).length, [flips]);

  const filteredAndSortedFlips = useMemo(() => {
    let list = [...flips];

    if (search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      list = list.filter((f) => (f.title || "").toLowerCase().includes(q));
    }

    if (showFavesOnly) list = list.filter((f) => f.favourite);
    if (toConfirmActive) list = list.filter((f) => boughtState(f) === "unconfirmed");

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
  }, [flips, search, showFavesOnly, sortMode, toConfirmActive]);

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
      "Title,Buy,Sell,Profit,ROI,Confidence,AI Price Min,AI Price Max,AI Price Confidence,FlipScore,Rarity,SellSpeed,Google Min,Google Max,SmartPrice,DemandScore,Condition,ConditionScore,Description,FullDescription,Bought\n";

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

          // Whether the Buy/Profit figures above are real (bought) or only the scan's estimate.
          { bought: "yes", "not-bought": "no", unconfirmed: "not answered" }[boughtState(f)],
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
  // On the Favourites tab with nothing hearted yet: say how to add one, rather than "no matching flips".
  const noFavouritesYet = showFavesOnly && favouriteCount === 0 && !loadError;
  const emptyTitle = loadError
    ? "Couldn't load your flips"
    : noFavouritesYet
    ? "No favourites yet"
    : hasFlips
    ? "No matching flips"
    : "No flips yet";
  const emptyBody =
    loadError ??
    (noFavouritesYet
      ? "Tap the heart on a flip and it will show up here."
      : hasFlips
      ? showFavesOnly
        ? "Try a different search, or look under All flips."
        : "Try a different search."
      : "Scan an item and save it, and it will show up here.");

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top + 16 },
      ]}
    >
      {/* HEADER */}
      <TourTarget id="history.list">
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: theme.text }]} accessibilityRole="header">
          History
        </Text>

        <View style={styles.headerButtonsRow}>
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
      </TourTarget>

      {/* TABS: every flip, or just the favourites (this used to be a tab of its own in the bottom bar) */}
      <View
        accessibilityRole="tablist"
        style={[styles.tabs, { backgroundColor: theme.card, borderColor: HAIRLINE }]}
      >
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: !showFavesOnly }}
          accessibilityLabel="All flips"
          onPress={() => setShowFavesOnly(false)}
          style={({ pressed }) => [
            styles.tab,
            !showFavesOnly && { backgroundColor: theme.goldTint, borderColor: theme.gold },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={[styles.tabText, { color: !showFavesOnly ? theme.gold : theme.text }]}>
            All flips
          </Text>
        </Pressable>

        <TourTarget id="history.favourites-tab" style={styles.tabTarget}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: showFavesOnly }}
            accessibilityLabel={`Favourites, ${favouriteCount}`}
            onPress={() => setShowFavesOnly(true)}
            style={({ pressed }) => [
              styles.tab,
              showFavesOnly && { backgroundColor: theme.goldTint, borderColor: theme.gold },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.tabText, { color: showFavesOnly ? theme.gold : theme.text }]}>
              Favourites{favouriteCount > 0 ? ` (${favouriteCount})` : ""}
            </Text>
          </Pressable>
        </TourTarget>
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

      {/* STATS (about every flip, so left off the Favourites tab where they would read as the favourites' own) */}
      {!showFavesOnly ? (
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
      ) : null}

      {/* ITEMS NOT YET ANSWERED: they are not in the profit total until the person says they bought them */}
      {summary.unconfirmed > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            toConfirmActive
              ? "Showing only items still to confirm. Show all flips"
              : `${summary.unconfirmed} saved ${summary.unconfirmed === 1 ? "item is" : "items are"} not counted in your profit yet. Show them`
          }
          onPress={() => setToConfirmOnly((on) => !on)}
          style={({ pressed }) => [
            styles.confirmBanner,
            { backgroundColor: theme.card, borderColor: theme.gold },
            pressed && { opacity: 0.8 },
          ]}
        >
          <ShoppingBag size={22} weight="fill" color={theme.gold} />
          <View style={{ flex: 1 }}>
            <Text style={[textVariants.body, { color: theme.text, fontWeight: "700" }]}>
              {summary.unconfirmed} saved {summary.unconfirmed === 1 ? "item isn't" : "items aren't"} counted in your profit yet
            </Text>
            <Text style={[textVariants.small, { color: theme.muted, marginTop: 2 }]}>
              {toConfirmActive
                ? "Showing only those. Tap to show everything."
                : "Say which you bought, and what you paid, so your profit is right. Tap to see them."}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* BEST FLIP */}
      {bestFlip && !showFavesOnly && (
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

      {/* SORT */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sortRow}
        keyboardShouldPersistTaps="handled"
      >
        {SORT_OPTIONS.map((opt) => {
          const active = sortMode === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${opt.label}`}
              onPress={() => setSortMode(opt.id)}
              style={[
                styles.sortChip,
                {
                  borderColor: theme.gold,
                  backgroundColor: active ? theme.gold : theme.card,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.background : theme.text,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
                wrapperStyle={styles.modalButtonWrap}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={[
                  styles.modalCancel,
                  { borderColor: theme.muted, borderWidth: 2 },
                ]}
                onPress={() => setConfirmDelete(null)}
              >
                <Text style={[styles.modalButtonLabel, { color: theme.text }]}>Cancel</Text>
              </AnimatedPressable>

              <AnimatedPressable
                wrapperStyle={styles.modalButtonWrap}
                accessibilityRole="button"
                accessibilityLabel="Delete flip"
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
                <Text style={[styles.modalButtonLabel, { color: theme.white }]}>Delete</Text>
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
                wrapperStyle={styles.modalButtonWrap}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={[
                  styles.modalCancel,
                  { borderColor: theme.muted, borderWidth: 2 },
                ]}
                onPress={() => setConfirmClearAll(false)}
              >
                <Text style={[styles.modalButtonLabel, { color: theme.text }]}>Cancel</Text>
              </AnimatedPressable>

              <AnimatedPressable
                wrapperStyle={styles.modalButtonWrap}
                accessibilityRole="button"
                accessibilityLabel="Clear all history"
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
                <Text style={[styles.modalButtonLabel, { color: theme.white }]}>Clear</Text>
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
  confirmBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
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
  /* TABS: All flips | Favourites */
  tabs: {
    flexDirection: "row",
    gap: 4,
    marginTop: 12,
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  tabTarget: { flex: 1 },
  tabText: { fontSize: 14, fontWeight: "700" },

  searchRow: {
    marginVertical: 12,
  },
  searchInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 16,
  },

  /* SORT */
  sortRow: {
    marginBottom: 12,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
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
  // Each button's wrapper takes half the row (see AnimatedPressable). The button itself must NOT set flex.
  modalButtonWrap: {
    flex: 1,
  },
  modalCancel: {
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDelete: {
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
