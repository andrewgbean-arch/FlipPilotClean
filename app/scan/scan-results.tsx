import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";

import { useFlipHistory } from "../../src/context/FlipHistoryContext";
import { usePro, useTheme } from "../../src/context/ThemeContext";
import { ThemedText } from "../../src/styles/theme/ThemedText";
import ThemedView from "../../src/styles/theme/ThemedView";





export default function ScanResultsScreen() {
  const params = useLocalSearchParams();
  const { addToHistory } = useFlipHistory();
  const theme = useTheme();
  const { isPro } = usePro();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        setBuyPrice(parsed.pricing?.recommendedBuyPrice ?? null);
        setSellPrice(parsed.pricing?.recommendedSellPrice ?? null);
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
    if (!data?.flipScore && profit == null) return data?.flipScore ?? 0;
    let base = data?.flipScore ?? 50;

    if (profit != null) {
      if (profit > 20) base += 20;
      else if (profit > 10) base += 10;
      else if (profit < 0) base -= 15;
    }

    if (roi != null) {
      if (roi > 100) base += 10;
      else if (roi > 50) base += 5;
    }

    return Math.max(0, Math.min(100, Math.round(base)));
  }, [data?.flipScore, profit, roi]);

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
    if (!data) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    addToHistory({
      ...data,
      pricing: {
        recommendedBuyPrice:
          buyPrice ?? data.pricing?.recommendedBuyPrice ?? null,
        recommendedSellPrice:
          sellPrice ?? data.pricing?.recommendedSellPrice ?? null,
        predictedProfit: profit ?? data.pricing?.predictedProfit ?? null,
      },
      flipScore: flipScore ?? data.flipScore ?? 0,
    });
  };

  if (loading || !data) {
    return (
      <ThemedView style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.gold} />
        <ThemedText style={{ marginTop: 16, color: theme.gold, fontWeight: "700" }}>
          Loading scan…
        </ThemedText>
      </ThemedView>
    );
  }

  const title = data.title ?? data.ai?.title ?? "Unknown Item";
  const conditionScore = data.ai?.conditionScore ?? 0;

  const aiMin = data.aiPriceMin ?? data.market?.aiPriceMin;
  const aiMax = data.aiPriceMax ?? data.market?.aiPriceMax;
  const aiConf = data.aiPriceConfidence ?? data.market?.aiPriceConfidence;

  // ⭐ PREMIUM METER LOGIC
  const meterGood = isPro ? theme.gold : theme.success;
  const meterMid = isPro ? theme.goldDeep : theme.gold;
  const meterBad = theme.danger;

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* TITLE */}
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.muted }]}>
            {data.ai?.category ?? "Uncategorised"}
          </ThemedText>

          {aiMin && (
            <View
              style={[
                styles.aiBadge,
                { backgroundColor: theme.secondary, borderColor: theme.gold },
              ]}
            >
              <ThemedText style={[styles.aiBadgeText, { color: theme.gold }]}>
                AI‑powered estimate
              </ThemedText>
            </View>
          )}
        </View>

        {/* IMAGE */}
        {data.image && (
          <View
            style={[
              styles.imageWrapper,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
            ]}
          >
            <Image source={{ uri: data.image }} style={styles.image} resizeMode="contain" />
          </View>
        )}

        {/* SCORE + CONDITION */}
        <View style={styles.row}>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
            ]}
          >
            <ThemedText style={[styles.cardLabel, { color: theme.gold }]}>
              FlipScore
            </ThemedText>
            <ThemedText style={[styles.flipScoreValue, { color: theme.text }]}>
              {flipScore}
            </ThemedText>

            <View style={[styles.meterBackground, { backgroundColor: theme.secondary }]}>
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${flipScore}%`,
                    backgroundColor:
                      flipScore >= 70 ? meterGood : flipScore >= 40 ? meterMid : meterBad,
                  },
                ]}
              />
            </View>

            <ThemedText style={[styles.meterHint, { color: theme.muted }]}>
              {data.flipPotential ?? "Medium potential"}
            </ThemedText>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
            ]}
          >
            <ThemedText style={[styles.cardLabel, { color: theme.gold }]}>
              Condition
            </ThemedText>
            <ThemedText style={[styles.cardValue, { color: theme.text }]}>
              {data.ai?.condition ?? "Unknown"}
            </ThemedText>

            <View style={[styles.meterBackground, { backgroundColor: theme.secondary }]}>
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${conditionScore}%`,
                    backgroundColor:
                      conditionScore >= 70
                        ? meterGood
                        : conditionScore >= 40
                        ? meterMid
                        : meterBad,
                  },
                ]}
              />
            </View>

            <ThemedText style={[styles.meterHint, { color: theme.muted }]}>
              {conditionScore || "No score"}
            </ThemedText>
          </View>
        </View>

        {/* RARITY + SELL SPEED */}
        <View style={styles.row}>
          <View
            style={[
              styles.badgeCard,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
            ]}
          >
            <ThemedText style={[styles.badgeLabel, { color: theme.muted }]}>
              Rarity
            </ThemedText>
            <ThemedText style={[styles.badgeValue, { color: theme.gold }]}>
              {data.rarity ?? "Unknown"}
            </ThemedText>
          </View>

          <View
            style={[
              styles.badgeCard,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
            ]}
          >
            <ThemedText style={[styles.badgeLabel, { color: theme.muted }]}>
              Sell speed
            </ThemedText>
            <ThemedText style={[styles.badgeValue, { color: theme.gold }]}>
              {data.sellSpeed ?? "Unknown"}
            </ThemedText>
          </View>
        </View>

        {/* PRICING */}
        <View
          style={[
            styles.cardWide,
            { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
          ]}
        >
          <ThemedText style={[styles.cardLabel, { color: theme.gold }]}>
            Pricing
          </ThemedText>

          {aiMin && aiMax && (
            <ThemedText style={[styles.marketLine, { color: theme.text }]}>
              AI Estimate: £{aiMin.toFixed(2)} – £{aiMax.toFixed(2)}{" "}
              <ThemedText style={{ color: theme.muted }}>
                ({Math.round(aiConf * 100)}% confidence)
              </ThemedText>
            </ThemedText>
          )}

          {/* BUY PRICE */}
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.priceLabel, { color: theme.muted }]}>
                Buy price
              </ThemedText>
              <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                {buyPrice != null ? `£${buyPrice.toFixed(2)}` : "Tap to set"}
              </ThemedText>
            </View>

            <Pressable
              style={[styles.priceButton, { backgroundColor: theme.gold }]}
              onPress={() => openCalculator("buy")}
            >
              <ThemedText style={[styles.priceButtonText, { color: theme.black }]}>
                Set
              </ThemedText>
            </Pressable>
          </View>

          {/* SELL PRICE */}
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.priceLabel, { color: theme.muted }]}>
                Sell price
              </ThemedText>
              <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                {sellPrice != null ? `£${sellPrice.toFixed(2)}` : "Tap to set"}
              </ThemedText>
            </View>

            <Pressable
              style={[styles.priceButton, { backgroundColor: theme.gold }]}
              onPress={() => openCalculator("sell")}
            >
              <ThemedText style={[styles.priceButtonText, { color: theme.black }]}>
                Set
              </ThemedText>
            </Pressable>
          </View>

          {/* PROFIT + ROI */}
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.priceLabel, { color: theme.muted }]}>
                Profit
              </ThemedText>
              <ThemedText
                style={[
                  styles.priceValue,
                  { color: profit != null && profit < 0 ? theme.danger : theme.success },
                ]}
              >
                {profit != null ? `£${profit.toFixed(2)}` : "—"}
              </ThemedText>
            </View>

            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.priceLabel, { color: theme.muted }]}>
                ROI
              </ThemedText>
              <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                {roi != null ? `${roi}%` : "—"}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* MARKET SNAPSHOT */}
        <View
          style={[
            styles.cardWide,
            { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
          ]}
        >
          <ThemedText style={[styles.cardLabel, { color: theme.gold }]}>
            Market snapshot
          </ThemedText>

          <ThemedText style={[styles.marketLine, { color: theme.text }]}>
            Retail:{" "}
            {data.market?.googlePriceMin
              ? `£${data.market.googlePriceMin.toFixed(2)} – £${data.market.googlePriceMax.toFixed(2)}`
              : "No data"}
          </ThemedText>

          <ThemedText style={[styles.marketLine, { color: theme.text }]}>
            Used:{" "}
            {data.market?.lowest
              ? `£${data.market.lowest.toFixed(2)} – £${data.market.highest.toFixed(2)}`
              : "No data"}
          </ThemedText>
        </View>

        {/* INSIGHTS */}
        {data.insights && (
          <View
            style={[
              styles.cardWide,
              { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
            ]}
          >
            <ThemedText style={[styles.cardLabel, { color: theme.gold }]}>
              Insights
            </ThemedText>
            <ThemedText style={[styles.insightsText, { color: theme.text }]}>
              {data.insights}
            </ThemedText>
          </View>
        )}

        {/* ACTION BUTTONS */}
        <View style={{ gap: 12, marginTop: 16 }}>
          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: theme.secondary, borderColor: theme.goldSoftGlow },
            ]}
            onPress={() =>
              Linking.openURL(
                `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(title)}`
              )
            }
          >
            <ThemedText style={[styles.actionButtonText, { color: theme.text }]}>
              View on eBay
            </ThemedText>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: theme.secondary, borderColor: theme.goldSoftGlow },
            ]}
            onPress={() =>
              Share.share({
                message: `${title} — FlipPilot scan result`,
                url: data.image,
              })
            }
          >
            <ThemedText style={[styles.actionButtonText, { color: theme.text }]}>
              Share
            </ThemedText>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: theme.gold, borderColor: theme.goldSoftGlow },
            ]}
            onPress={() => router.push("/(tabs)/scan")}
          >
            <ThemedText style={[styles.actionButtonText, { color: theme.black }]}>
              Scan Again
            </ThemedText>
          </Pressable>
        </View>

        {/* SAVE */}
        <Pressable
          style={[
            styles.saveBox,
            { backgroundColor: theme.card, borderColor: theme.gold },
          ]}
          onPress={saveToHistory}
        >
          <ThemedText style={[styles.saveTitle, { color: theme.gold }]}>
            Save to history
          </ThemedText>
          <ThemedText style={[styles.saveSubtitle, { color: theme.muted }]}>
            Keep this flip in your log for later
          </ThemedText>
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
            <ThemedText style={[styles.calcTitle, { color: theme.gold }]}>
                          {calcMode === "buy" ? "Set buy price" : "Set sell price"}
            </ThemedText>

            {/* CALCULATOR DISPLAY */}
            <View
              style={[
                styles.calcDisplay,
                { backgroundColor: theme.secondary },
              ]}
            >
              <ThemedText
                style={[
                  styles.calcDisplayText,
                  { color: theme.text },
                ]}
              >
                £{calcValue || "0"}
              </ThemedText>
            </View>

            {/* CALCULATOR GRID */}
            <View style={styles.calcGrid}>
              {["7","8","9","4","5","6","1","2","3","0",".","DEL"].map((key) => (
                <Pressable
                  key={key}
                  style={[
                    styles.calcKey,
                    { backgroundColor: theme.secondary },
                  ]}
                  onPress={() => handleCalcKey(key)}
                >
                  <ThemedText
                    style={[
                      styles.calcKeyText,
                      { color: theme.text },
                    ]}
                  >
                    {key}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* CALCULATOR BOTTOM */}
            <View style={styles.calcBottomRow}>
              <Pressable
                style={[
                  styles.calcActionButton,
                  { backgroundColor: theme.secondary },
                ]}
                onPress={() => handleCalcKey("CLR")}
              >
                <ThemedText
                  style={[
                    styles.calcActionText,
                    { color: theme.text },
                  ]}
                >
                  Clear
                </ThemedText>
              </Pressable>

              <Pressable
                style={[
                  styles.calcActionButton,
                  { backgroundColor: theme.gold },
                ]}
                onPress={confirmCalc}
              >
                <ThemedText
                  style={[
                    styles.calcActionText,
                    { color: theme.black },
                  ]}
                >
                  Confirm
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}
 

/* ================================
   ⭐ STYLES (UNCHANGED STRUCTURE)
   — All colours now theme‑controlled
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

  aiBadge: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: "800",
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
  cardValue: {
    fontWeight: "700",
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
  meterHint: {
    fontSize: 12,
  },

  badgeCard: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
  },
  badgeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  badgeValue: {
    fontWeight: "800",
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

  insightsText: {
    fontSize: 14,
    lineHeight: 20,
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
