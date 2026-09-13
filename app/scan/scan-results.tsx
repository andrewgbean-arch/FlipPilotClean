import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/styles/ThemeContext";

export default function ScanResultsScreen() {
  const params = useLocalSearchParams();
  const { addVehicle } = useVehicleHistory();
  const theme = useTheme();
  const isPro = theme.mode === "pro";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

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

  const confirmCalc = () => {
    const num = parseFloat(calcValue || "0");
    if (calcMode === "buy") setBuyPrice(isNaN(num) ? null : num);
    if (calcMode === "sell") setSellPrice(isNaN(num) ? null : num);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCalcVisible(false);
    setCalcMode(null);
  };

  const saveToHistory = () => {
    if (!data || saved) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    addVehicle({
      title: data.title ?? data.product?.title ?? "Unknown Item",
      barcode: data.barcode ?? data.product?.barcode ?? null,
      images: data.image ? [data.image] : null,
      buyPrice,
      sellPrice,
      pricing: {
        recommendedBuyPrice: buyPrice,
        recommendedSellPrice: sellPrice,
        predictedProfit: profit,
      },
      ai: {
        condition: data.ai?.condition ?? null,
        description: data.ai?.description ?? null,
        conditionScore: data.ai?.confidence ?? null,
        fullDescription: null,
        origin: null,
        photos: null,
      },
    });

    setSaved(true);
  };

  if (loading || !data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
        <Text style={{ marginTop: 16, color: theme.gold, fontWeight: "700" }}>
          Loading scan…
        </Text>
      </View>
    );
  }

  const title = data.title ?? data.product?.title ?? "Unknown Item";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* TITLE */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {data.barcode ?? data.product?.barcode ?? "Identified from photo"}
          </Text>
        </View>

        {/* AI DESCRIPTION */}
        {(data.ai?.description || data.ai?.condition) && (
          <View
            style={[
              styles.cardWide,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow, marginBottom: 16 },
            ]}
          >
            <Text style={[styles.cardLabel, { color: theme.gold }]}>AI Analysis</Text>

            {data.ai?.description && (
              <Text style={[styles.marketLine, { color: theme.text }]}>
                {data.ai.description}
              </Text>
            )}

            <View style={styles.priceRow}>
              {data.ai?.condition && (
                <View style={{ flex: 1 }}>
                  <Text style={[styles.priceLabel, { color: theme.muted }]}>Condition</Text>
                  <Text style={[styles.priceValue, { color: theme.text }]}>
                    {data.ai.condition}
                  </Text>
                </View>
              )}
              {data.ai?.confidence != null && (
                <View style={{ flex: 1 }}>
                  <Text style={[styles.priceLabel, { color: theme.muted }]}>Confidence</Text>
                  <Text style={[styles.priceValue, { color: theme.text }]}>
                    {data.ai.confidence}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* IMAGE */}
        {data.image && (
          <View
            style={[
              styles.imageWrapper,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
            ]}
          >
            <Image
              source={{ uri: data.image }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}

        {/* FLIP SCORE */}
        <View style={styles.row}>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
            ]}
          >
            <Text style={[styles.cardLabel, { color: theme.gold }]}>
              FlipScore
            </Text>
            <Text style={[styles.flipScoreValue, { color: theme.text }]}>
              {flipScore}
            </Text>

            <View
              style={[
                styles.meterBackground,
                { backgroundColor: theme.secondary },
              ]}
            >
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${flipScore}%`,
                    backgroundColor:
                      flipScore >= 70
                        ? theme.success
                        : flipScore >= 40
                        ? theme.gold
                        : theme.danger,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* PRICING */}
        <View
          style={[
            styles.cardWide,
            { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
          ]}
        >
          <Text style={[styles.cardLabel, { color: theme.gold }]}>
            Pricing
          </Text>

          {/* FAIR PRICE */}
          <Text style={[styles.marketLine, { color: theme.text }]}>
            Fair Price: £
            {data.ai?.fair_price != null
              ? data.ai.fair_price.toFixed(2)
              : "—"}
          </Text>

          {/* BUY PRICE */}
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.priceLabel, { color: theme.muted }]}>
                Buy price
              </Text>
              <Text style={[styles.priceValue, { color: theme.text }]}>
                {buyPrice != null ? `£${buyPrice.toFixed(2)}` : "Tap to set"}
              </Text>
            </View>

            <Pressable
              style={[styles.priceButton, { backgroundColor: theme.gold }]}
              onPress={() => openCalculator("buy")}
            >
              <Text
                style={[styles.priceButtonText, { color: theme.black }]}
              >
                Set
              </Text>
            </Pressable>
          </View>

          {/* SELL PRICE */}
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.priceLabel, { color: theme.muted }]}>
                Sell price
              </Text>
              <Text style={[styles.priceValue, { color: theme.text }]}>
                {sellPrice != null ? `£${sellPrice.toFixed(2)}` : "Tap to set"}
              </Text>
            </View>

            <Pressable
              style={[styles.priceButton, { backgroundColor: theme.gold }]}
              onPress={() => openCalculator("sell")}
            >
              <Text
                style={[styles.priceButtonText, { color: theme.black }]}
              >
                Set
              </Text>
            </Pressable>
          </View>

          {/* PROFIT + ROI */}
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.priceLabel, { color: theme.muted }]}>
                Profit
              </Text>
              <Text
                style={[
                  styles.priceValue,
                  {
                    color:
                      profit != null && profit < 0
                        ? theme.danger
                        : theme.success,
                  },
                ]}
              >
                {profit != null ? `£${profit.toFixed(2)}` : "—"}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.priceLabel, { color: theme.muted }]}>
                ROI
              </Text>
              <Text style={[styles.priceValue, { color: theme.text }]}>
                {roi != null ? `${roi}%` : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* ACTION BUTTONS */}
        <View style={{ gap: 12, marginTop: 16 }}>
          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: theme.gold, borderColor: theme.goldSoftGlow },
            ]}
            onPress={() => router.push("/(tabs)/scan")}
          >
            <Text
              style={[styles.actionButtonText, { color: theme.black }]}
            >
              Scan Again
            </Text>
          </Pressable>
        </View>

        {/* SAVE */}
        <Pressable
          style={[
            styles.saveBox,
            { backgroundColor: theme.card, borderColor: theme.gold },
            saved && { opacity: 0.6 },
          ]}
          onPress={saveToHistory}
          disabled={saved}
        >
          <Text style={[styles.saveTitle, { color: theme.gold }]}>
            {saved ? "Saved ✓" : "Save to history"}
          </Text>
          <Text style={[styles.saveSubtitle, { color: theme.muted }]}>
            {saved
              ? "This flip is now in your History and Home dashboard"
              : "Keep this flip in your log for later"}
          </Text>
        </Pressable>
      </ScrollView>

      {/* CALCULATOR */}
      <Modal
        visible={calcVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCalcVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.calcContainer,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
            ]}
          >
            <Text style={[styles.calcTitle, { color: theme.gold }]}>
              {calcMode === "buy" ? "Set buy price" : "Set sell price"}
            </Text>

            <View
              style={[
                styles.calcDisplay,
                { backgroundColor: theme.secondary },
              ]}
            >
              <Text
                style={[styles.calcDisplayText, { color: theme.text }]}
              >
                £{calcValue || "0"}
              </Text>
            </View>

            <View style={styles.calcGrid}>
              {["7","8","9","4","5","6","1","2","3","0",".","DEL"].map(
                (key) => (
                  <Pressable
                    key={key}
                    style={[
                      styles.calcKey,
                      { backgroundColor: theme.secondary },
                    ]}
                    onPress={() => handleCalcKey(key)}
                  >
                    <Text
                      style={[styles.calcKeyText, { color: theme.text }]}
                    >
                      {key}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            <View style={styles.calcBottomRow}>
              <Pressable
                style={[
                  styles.calcActionButton,
                  { backgroundColor: theme.secondary },
                ]}
                onPress={() => handleCalcKey("CLR")}
              >
                <Text
                  style={[styles.calcActionText, { color: theme.text }]}
                >
                  Clear
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.calcActionButton,
                  { backgroundColor: theme.gold },
                ]}
                onPress={confirmCalc}
              >
                <Text
                  style={[styles.calcActionText, { color: theme.black }]}
                >
                  Confirm
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================================
   ⭐ STYLES
================================ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  header: { marginBottom: 16 },

  title: {
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 4,
  },

  imageWrapper: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
  },
  image: { width: "100%", height: "100%" },

  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },

  card: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  cardWide: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },

  cardLabel: {
    fontWeight: "800",
    marginBottom: 6,
  },
  flipScoreValue: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },

  meterBackground: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 4,
  },
  meterFill: {
    height: "100%",
    borderRadius: 999,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 10,
  },
  priceLabel: {
    fontSize: 13,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  priceButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  priceButtonText: {
    fontWeight: "800",
  },

  marketLine: {
    fontSize: 14,
    marginTop: 4,
  },

  actionButton: {
    paddingVertical: 12,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  actionButtonText: {
    fontWeight: "800",
    fontSize: 15,
  },

  saveBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  saveTitle: {
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 4,
  },
  saveSubtitle: {
    fontSize: 13,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  calcContainer: {
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
  },
  calcTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  calcDisplay: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  calcDisplayText: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "right",
  },
  calcGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  calcKey: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  calcKeyText: {
    fontSize: 18,
    fontWeight: "800",
  },
  calcBottomRow: {
    flexDirection: "row",
    gap: 10,
  },
  calcActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  calcActionText: {
    fontWeight: "800",
    fontSize: 16,
  },
});
