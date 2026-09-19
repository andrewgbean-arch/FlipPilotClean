import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import {
  Backspace,
  Barcode,
  BookmarkSimple,
  Camera,
  Check,
  CheckCircle,
  Heart,
  ImageBroken,
  PencilSimple,
  WarningCircle,
  X,
} from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/styles/ThemeContext";
import { SCAN_AGAIN_EVENT } from "@/utils/scanTransform";

// A photo scan's picture sits in the cache folder, which the OS can clear at any time.
// Keep a copy in the documents folder so a saved flip doesn't lose its photo.
const keepPhoto = async (uri: string): Promise<string> => {
  const dir = FileSystem.documentDirectory;
  if (!dir || !uri.startsWith("file://") || uri.startsWith(dir)) return uri;

  try {
    const dest = `${dir}flip-photo-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (err) {
    console.log("Couldn't keep a copy of the scan photo:", err);
    return uri;
  }
};

// Keys of the price keypad, in reading order (three to a row).
const CALC_KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "DEL"];
const CALC_ROWS = [0, 3, 6, 9].map((start) => CALC_KEYS.slice(start, start + 3));

// Where the item is being bought decides how much of its resale price is worth paying.
// Charity shops are the base case (half of what it should sell for, which leaves room for
// fees, postage and profit); a car boot is where you can haggle harder; a shop or online
// seller has already taken their cut.
const SOURCES = [
  { key: "carboot", label: "Car boot", share: 0.35 },
  { key: "charity", label: "Charity shop", share: 0.5 },
  { key: "shop", label: "Shop/online", share: 0.65 },
] as const;
type SourceKey = (typeof SOURCES)[number]["key"];

// "+£12.50" or "-£3.20". A profit of exactly zero carries no sign.
const signedMoney = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}£${Math.abs(n).toFixed(2)}`;
const signedPercent = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toFixed(1)}%`;

// One of the two big Buy / Sell tiles. Tapping it opens the keypad.
function PriceTile({
  label,
  value,
  onPress,
  locked,
}: {
  label: string;
  value: number | null;
  onPress: () => void;
  // Once the flip is saved the prices are part of the record, so they can no longer be edited here.
  locked?: boolean;
}) {
  const theme = useTheme();
  const valueText = value != null ? `£${value.toFixed(2)}` : "Tap to set";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value != null ? valueText : "not set"}`}
      accessibilityHint={locked ? undefined : "Opens the keypad to change this price"}
      accessibilityState={{ disabled: !!locked }}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.tileTop}>
        <Text style={[styles.tileLabel, { color: theme.muted }]}>{label}</Text>
        {locked ? null : <PencilSimple size={16} color={theme.muted} />}
      </View>
      <Text
        style={[
          value != null ? styles.tileValue : styles.tileEmpty,
          { color: value != null ? theme.text : theme.muted },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {valueText}
      </Text>
    </Pressable>
  );
}

// A label on the left and a value on the right, used inside a grouped card.
function FactRow({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.factRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <Text style={[styles.factLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

export default function ScanResultsScreen() {
  const params = useLocalSearchParams();
  const { addVehicle, toggleFavourite, vehicles, loadError } = useVehicleHistory();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [source, setSource] = useState<SourceKey>("charity");
  const [imageFailed, setImageFailed] = useState(false);

  const [buyPrice, setBuyPrice] = useState<number | null>(null);
  const [sellPrice, setSellPrice] = useState<number | null>(null);

  const [calcVisible, setCalcVisible] = useState(false);
  const [calcMode, setCalcMode] = useState<"buy" | "sell" | null>(null);
  const [calcValue, setCalcValue] = useState("");

  useEffect(() => {
    try {
      if (params?.data) {
        const parsed = JSON.parse(params.data as string);
        setData(parsed);

        setBuyPrice(parsed.ai?.suggested_buy ?? null);
        setSellPrice(parsed.ai?.suggested_sell ?? null);
      }
    } catch (e) {
      console.log("Failed to parse scan result:", e);
    } finally {
      setLoading(false);
    }
  }, [params?.data]);

  const profit = useMemo(() => {
    if (buyPrice == null || sellPrice == null) return null;
    return +(sellPrice - buyPrice).toFixed(2);
  }, [buyPrice, sellPrice]);

  const roi = useMemo(() => {
    if (buyPrice == null || sellPrice == null || buyPrice === 0) return null;
    return +(((sellPrice - buyPrice) / buyPrice) * 100).toFixed(1);
  }, [buyPrice, sellPrice]);

  const flipScore = useMemo(() => {
    return data?.ai?.flip_score ?? 0;
  }, [data]);

  const openCalculator = (mode: "buy" | "sell") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalcMode(mode);
    setCalcValue(
      mode === "buy"
        ? buyPrice != null
          ? buyPrice.toString()
          : ""
        : sellPrice != null
        ? sellPrice.toString()
        : ""
    );
    setCalcVisible(true);
  };

  const handleCalcKey = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "DEL") return setCalcValue((p) => p.slice(0, -1));
    if (key === "CLR") return setCalcValue("");
    if (key === "." && calcValue.includes(".")) return;
    setCalcValue((p) => (p === "0" && key !== "." ? key : p + key));
  };

  const closeCalculator = () => {
    setCalcVisible(false);
    setCalcMode(null);
  };

  const confirmCalc = () => {
    // An emptied keypad clears the price (it shows "Tap to set"); it does not mean £0.
    const num = calcValue === "" ? NaN : parseFloat(calcValue);
    if (calcMode === "buy") setBuyPrice(isNaN(num) ? null : num);
    if (calcMode === "sell") setSellPrice(isNaN(num) ? null : num);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeCalculator();
  };

  const isFavourite = savedId ? !!vehicles.find((v) => v.id === savedId)?.favourite : false;

  // Picking where the item is being bought sets the buy price to that share of the sell price.
  const chooseSource = (key: SourceKey) => {
    Haptics.selectionAsync().catch(() => {});
    setSource(key);
    const share = SOURCES.find((s) => s.key === key)?.share ?? 0.5;
    if (!saved && sellPrice != null) setBuyPrice(+(sellPrice * share).toFixed(2));
  };

  // The heart saves the flip to History first if it isn't there yet, then favourites it.
  const onFavouritePress = async () => {
    if (saved) {
      if (savedId) {
        Haptics.selectionAsync().catch(() => {});
        toggleFavourite(savedId);
      }
      return;
    }
    await saveToHistory({ favourite: true });
  };

  const saveToHistory = async (options?: { favourite?: boolean }) => {
    if (!data || saved) return;

    // Saving is switched off when the stored History couldn't be read; say so rather than show "Saved".
    if (loadError) {
      Alert.alert("Can't save this flip", loadError);
      return;
    }

    // Mark it saved straight away so a second tap can't save it twice while the photo is copied.
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const image = data.image ? await keepPhoto(data.image) : null;

    const record = addVehicle({
      title: data.title ?? data.product?.title ?? "Unknown Item",
      barcode: data.barcode ?? data.product?.barcode ?? null,
      images: image ? [image] : null,
      favourite: options?.favourite ?? false,
      buyPrice,
      sellPrice,
      flipScore: typeof data.ai?.flip_score === "number" ? data.ai.flip_score : undefined,
      category: data.ai?.category ?? null,
      pricing: {
        recommendedBuyPrice: buyPrice,
        recommendedSellPrice: sellPrice,
        predictedProfit: profit,
      },
      ai: {
        condition: data.ai?.condition ?? null,
        description: data.ai?.description ?? null,
        conditionScore: Number(data.ai?.conditionScore) || null,
        fullDescription: data.ai?.fullDescription ?? null,
        origin: data.ai?.origin ?? null,
        photos: null,
      },
      market: data.market ?? null,
      sellSpeed: data.sellSpeed ?? null,
      rarity: data.rarity ?? null,
      flipPotential: data.flipPotential ?? null,
      insights: data.insights ?? null,
      aiPriceMin: data.aiPriceMin ?? null,
      aiPriceMax: data.aiPriceMax ?? null,
      aiPriceConfidence: data.aiPriceConfidence ?? null,
    });
    setSavedId(record.id);
  };

  const scanAgain = () => {
    // The Scan tab pauses barcode scanning after each lookup; this tells it to resume.
    DeviceEventEmitter.emit(SCAN_AGAIN_EVENT);
    router.dismissTo("/(tabs)/scan");
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
        <Text style={[styles.stateLoading, { color: theme.muted }]}>
          Loading your scan result
        </Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <View
          style={[styles.stateIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
        >
          <WarningCircle size={30} color={theme.warning} />
        </View>
        <Text style={[styles.stateTitle, { color: theme.text }]} accessibilityRole="header">
          Couldn't load this result
        </Text>
        <Text style={[styles.stateBody, { color: theme.muted }]}>
          This scan isn't available any more. Go back and scan the item again.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.stateButton,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)/scan")
          }
        >
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const title = data.title ?? data.product?.title ?? "Unknown Item";
  const barcode = data.barcode ?? data.product?.barcode ?? null;

  const card = { backgroundColor: theme.card, borderColor: theme.hairline };

  // Profit and ROI share one colour: green for a gain, red for a loss, plain for break-even.
  const signColor = (n: number | null) =>
    n == null ? theme.muted : n > 0 ? theme.success : n < 0 ? theme.danger : theme.text;
  const profitColor = signColor(profit);

  const fairPrice = data.ai?.fair_price;

  const scoreColor =
    flipScore >= 70 ? theme.success : flipScore >= 40 ? theme.warning : theme.danger;
  const scoreBand = flipScore >= 70 ? "Strong" : flipScore >= 40 ? "Fair" : "Weak";
  const scorePercent = Math.max(0, Math.min(100, Number(flipScore) || 0));

  const facts: { label: string; value: string }[] = [];
  if (data.ai?.condition) facts.push({ label: "Condition", value: String(data.ai.condition) });
  if (data.ai?.confidence != null) {
    facts.push({ label: "Confidence", value: `${data.ai.confidence}%` });
  }
  const hasAnalysis = Boolean(data.ai?.description || data.ai?.condition);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TITLE */}
        <View style={styles.header}>
          {data.image ? (
            imageFailed ? (
              <View
                accessible
                accessibilityLabel="Photo no longer available"
                style={[styles.thumb, styles.thumbEmpty, card]}
              >
                <ImageBroken size={26} color={theme.muted} />
              </View>
            ) : (
              <Image
                source={{ uri: data.image }}
                style={styles.thumb}
                resizeMode="cover"
                accessibilityLabel="Photo of the scanned item"
                onError={() => setImageFailed(true)}
              />
            )
          ) : null}

          <View style={styles.headerText}>
            <Text
              style={[styles.title, { color: theme.text }]}
              numberOfLines={3}
              accessibilityRole="header"
            >
              {title}
            </Text>
            <View style={styles.metaRow}>
              {barcode ? (
                <Barcode size={14} color={theme.muted} />
              ) : (
                <Camera size={14} color={theme.muted} />
              )}
              <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1} selectable>
                {barcode ?? "Identified from photo"}
              </Text>
            </View>
          </View>
        </View>

        {/* PROFIT + ROI */}
        <View style={[styles.hero, card]}>
          <Text style={[styles.heroLabel, { color: theme.muted }]}>Estimated profit</Text>

          <View style={styles.heroRow}>
            <Text
              style={[styles.profit, { color: profitColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              accessibilityLabel={
                profit != null
                  ? `Estimated ${profit < 0 ? "loss" : "profit"} of £${Math.abs(profit).toFixed(2)}`
                  : "Estimated profit not available yet"
              }
            >
              {profit != null ? signedMoney(profit) : "—"}
            </Text>

            <View style={[styles.roiPill, { backgroundColor: theme.background }]}>
              <Text
                style={[styles.roiText, { color: signColor(roi) }]}
                accessibilityLabel={
                  roi != null ? `Return on investment ${signedPercent(roi)}` : "Return on investment not available"
                }
              >
                ROI {roi != null ? signedPercent(roi) : "—"}
              </Text>
            </View>
          </View>

          {profit == null ? (
            <Text style={[styles.heroHint, { color: theme.muted }]}>
              Set a buy and a sell price to see your profit.
            </Text>
          ) : null}

          <View style={[styles.fairRow, { borderTopColor: theme.hairline }]}>
            <Text style={[styles.factLabel, { color: theme.muted }]}>Fair market price</Text>
            <Text style={[styles.fairValue, { color: theme.text }]}>
              {fairPrice != null ? `£${Number(fairPrice).toFixed(2)}` : "—"}
            </Text>
          </View>
        </View>

        {/* BUY + SELL */}
        <View style={styles.tilesRow}>
          <PriceTile label="Buy price" value={buyPrice} locked={saved} onPress={() => openCalculator("buy")} />
          <PriceTile label="Sell price" value={sellPrice} locked={saved} onPress={() => openCalculator("sell")} />
        </View>

        {/* PRICE GUIDE: new price, what it should sell for, and where you're buying */}
        {sellPrice != null || data.market?.retailPrice != null ? (
          <View style={[styles.group, styles.guideCard, card]}>
            {data.market?.retailPrice != null ? (
              <FactRow
                label="New in the shops"
                value={`£${Number(data.market.retailPrice).toFixed(2)}`}
              />
            ) : null}
            {data.ai?.suggested_sell != null ? (
              <FactRow
                label="Should sell for"
                value={`£${Number(data.ai.suggested_sell).toFixed(2)}`}
                divider={data.market?.retailPrice != null}
              />
            ) : null}

            {sellPrice != null && !saved ? (
              <View style={[styles.sourceBlock, { borderTopColor: theme.hairline }]}>
                <Text style={[styles.sourceLabel, { color: theme.muted }]}>Where are you buying?</Text>
                <View style={styles.sourceRow} accessibilityRole="radiogroup">
                  {SOURCES.map((s) => {
                    const selected = source === s.key;
                    return (
                      <Pressable
                        key={s.key}
                        accessibilityRole="radio"
                        accessibilityLabel={s.label}
                        accessibilityState={{ checked: selected }}
                        onPress={() => chooseSource(s.key)}
                        style={({ pressed }) => [
                          styles.sourceChip,
                          selected
                            ? { backgroundColor: theme.goldTint, borderColor: theme.gold }
                            : { backgroundColor: theme.background, borderColor: theme.hairline },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sourceChipText,
                            { color: selected ? theme.gold : theme.text },
                          ]}
                          numberOfLines={1}
                        >
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.sourceHint, { color: theme.muted }]}>
                  Sets your buy price to about{" "}
                  {Math.round((SOURCES.find((s) => s.key === source)?.share ?? 0.5) * 100)}% of the
                  sell price. Tap the buy price to type what you were asked.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* FLIP SCORE */}
        <View
          accessible
          accessibilityLabel={`FlipScore ${flipScore} out of 100, ${scoreBand}`}
          style={[styles.scoreCard, card]}
        >
          <View style={styles.scoreTop}>
            <Text style={[styles.heroLabel, { color: theme.muted }]}>FlipScore</Text>
            <Text style={[styles.scoreBand, { color: scoreColor }]}>{scoreBand}</Text>
          </View>

          <View style={styles.scoreNumberRow}>
            <Text style={[styles.scoreValue, { color: theme.text }]}>{flipScore}</Text>
            <Text style={[styles.scoreMax, { color: theme.muted }]}>/ 100</Text>
          </View>

          <View style={[styles.meterTrack, { backgroundColor: theme.background }]}>
            <View
              style={[
                styles.meterFill,
                { width: `${scorePercent}%`, backgroundColor: scoreColor },
              ]}
            />
          </View>
        </View>

        {/* AI ANALYSIS */}
        {hasAnalysis ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
              AI analysis
            </Text>
            <View style={[styles.group, card]}>
              {facts.map((fact, i) => (
                <FactRow key={fact.label} label={fact.label} value={fact.value} divider={i > 0} />
              ))}

              {data.ai?.description ? (
                <Text
                  style={[
                    styles.description,
                    { color: theme.text },
                    facts.length > 0 && { borderTopWidth: 1, borderTopColor: theme.hairline },
                  ]}
                >
                  {data.ai.description}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* ACTIONS */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.hairline,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        {saved ? (
          <View style={styles.savedRow} accessibilityLiveRegion="polite">
            <CheckCircle size={16} weight="fill" color={theme.success} />
            <Text style={[styles.savedText, { color: theme.muted }]}>
              This flip is now in your History and Home dashboard
            </Text>
          </View>
        ) : null}

        <View style={styles.footerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavourite ? "Remove from favourites" : "Save to favourites"}
            accessibilityState={{ selected: isFavourite }}
            style={({ pressed }) => [
              styles.heartButton,
              { borderColor: isFavourite ? theme.gold : theme.hairline, backgroundColor: theme.card },
              pressed && styles.pressed,
            ]}
            onPress={onFavouritePress}
          >
            <Heart
              size={24}
              weight={isFavourite ? "fill" : "regular"}
              color={isFavourite ? theme.gold : theme.muted}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan again"
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.hairline, backgroundColor: theme.card },
              pressed && styles.pressed,
            ]}
            onPress={scanAgain}
          >
            <Text style={[styles.secondaryLabel, { color: theme.text }]}>Scan again</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? "Saved to history" : "Save to history"}
            style={({ pressed }) => [
              styles.primaryButton,
              saved
                ? { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.hairline }
                : { backgroundColor: theme.gold },
              pressed && styles.pressed,
            ]}
            onPress={() => saveToHistory()}
            disabled={saved}
          >
            {saved ? (
              <CheckCircle size={20} weight="fill" color={theme.success} />
            ) : (
              <BookmarkSimple size={20} weight="bold" color={theme.black} />
            )}
            <Text style={[styles.primaryLabel, { color: saved ? theme.text : theme.black }]}>
              {saved ? "Saved" : "Save"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* CALCULATOR */}
      <Modal
        visible={calcVisible}
        transparent
        animationType="slide"
        onRequestClose={closeCalculator}
      >
        <View style={styles.modalBackdrop}>
          {/* Tapping outside the sheet closes it (onRequestClose only covers Android's back button). */}
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close keypad"
            onPress={closeCalculator}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.hairline,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: theme.muted }]} />

            <View style={styles.calcHeader}>
              <Text style={[styles.calcTitle, { color: theme.text }]} accessibilityRole="header">
                {calcMode === "buy" ? "Set buy price" : "Set sell price"}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close keypad"
                hitSlop={8}
                style={({ pressed }) => [styles.calcClose, pressed && styles.pressed]}
                onPress={closeCalculator}
              >
                <X size={22} color={theme.muted} />
              </Pressable>
            </View>

            <View style={[styles.calcDisplay, { backgroundColor: theme.background }]}>
              <Text
                style={[styles.calcDisplayText, { color: theme.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                accessibilityLiveRegion="polite"
              >
                £{calcValue || "0"}
              </Text>
            </View>

            <View style={styles.calcGrid}>
              {CALC_ROWS.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.calcRow}>
                  {row.map((key) => (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={
                        key === "DEL" ? "Delete" : key === "." ? "Decimal point" : key
                      }
                      style={({ pressed }) => [
                        styles.calcKey,
                        { backgroundColor: theme.background },
                        pressed && styles.pressed,
                      ]}
                      onPress={() => handleCalcKey(key)}
                    >
                      {key === "DEL" ? (
                        <Backspace size={26} color={theme.text} />
                      ) : (
                        <Text style={[styles.calcKeyText, { color: theme.text }]}>{key}</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>

            <View style={styles.calcBottomRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear amount"
                style={({ pressed }) => [
                  styles.calcClear,
                  { borderColor: theme.hairline, backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
                onPress={() => handleCalcKey("CLR")}
              >
                <Text style={[styles.secondaryLabel, { color: theme.text }]}>Clear</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm price"
                style={({ pressed }) => [
                  styles.calcConfirm,
                  { backgroundColor: theme.gold },
                  pressed && styles.pressed,
                ]}
                onPress={confirmCalc}
              >
                <Check size={20} weight="bold" color={theme.black} />
                <Text style={[styles.primaryLabel, { color: theme.black }]}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  /* LOADING AND NOT-FOUND STATES */
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  stateLoading: { fontSize: 15, marginTop: 16, textAlign: "center" },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stateTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  stateBody: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },
  stateButton: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 32,
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  /* TITLE */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbEmpty: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", lineHeight: 30 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  meta: { flexShrink: 1, fontSize: 13, fontVariant: ["tabular-nums"] },

  /* PROFIT + ROI */
  hero: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  heroLabel: { fontSize: 13 },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  profit: {
    flexShrink: 1,
    fontSize: 40,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  roiPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  roiText: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  heroHint: { fontSize: 13, marginTop: 4 },
  fairRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  fairValue: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },

  /* BUY + SELL */
  tilesRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  tile: {
    flex: 1,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    justifyContent: "space-between",
  },
  tileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tileLabel: { fontSize: 13 },
  tileValue: { fontSize: 26, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tileEmpty: { fontSize: 18, fontWeight: "600" },

  /* FLIP SCORE */
  scoreCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  scoreTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreBand: { fontSize: 14, fontWeight: "700" },
  scoreNumberRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
  },
  scoreValue: { fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"] },
  scoreMax: { fontSize: 16, fontVariant: ["tabular-nums"] },
  meterTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 12,
  },
  meterFill: { height: "100%", borderRadius: 5 },

  /* AI ANALYSIS */
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 12 },
  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  factRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  factLabel: { fontSize: 14 },
  factValue: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  description: { fontSize: 15, lineHeight: 22, padding: 16 },

  /* ACTIONS */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  savedText: { flexShrink: 1, fontSize: 13 },
  footerRow: { flexDirection: "row", gap: 12 },
  heartButton: {
    width: 52,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  guideCard: { marginTop: 12 },
  sourceBlock: { borderTopWidth: 1, padding: 14 },
  sourceLabel: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  sourceRow: { flexDirection: "row", gap: 8 },
  sourceChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceChipText: { fontSize: 13, fontWeight: "600" },
  sourceHint: { fontSize: 12, lineHeight: 17, marginTop: 10 },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: { fontSize: 16, fontWeight: "600" },
  primaryButton: {
    flex: 1.5,
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },

  /* PRICE KEYPAD */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
    marginBottom: 14,
  },
  calcHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calcClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  calcTitle: { fontSize: 18, fontWeight: "700" },
  calcDisplay: {
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  calcDisplayText: {
    fontSize: 36,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  calcGrid: { marginTop: 12, gap: 10 },
  calcRow: { flexDirection: "row", gap: 10 },
  calcKey: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  calcKeyText: { fontSize: 24, fontWeight: "600", fontVariant: ["tabular-nums"] },
  calcBottomRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  calcClear: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calcConfirm: {
    flex: 1.5,
    minHeight: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  pressed: { opacity: 0.7 },
});
