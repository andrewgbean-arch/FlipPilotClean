import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

import type { FlipRecord } from "@/features/vehicles/models/FlipRecord";


import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { shareFlip } from "@/utils/share/shareFlip";

/* THEME */
const NAVY = "#0A1128";
const GOLD = "#FFD700";
const SLATE = "#1a2440";
const ELECTRIC_BLUE = "#1e90ff";
const RED = "#FF5252";
const GREEN = "#00E676";
const SILVER = "#AAB4C3";

/* HELPERS */
const formatMoney = (n: number | null | undefined) =>
  n == null ? "-" : "£" + Number(n).toFixed(2);

const getRoiColor = (roi: number | null | undefined) => {
  const value = roi ?? 0;
  if (value <= 0) return RED;
  if (value < 30) return SILVER;
  return GREEN;
};

export default function FlipDetails() {
  const insets = useSafeAreaInsets();
 const { vehicles: flips } = useVehicleHistory();

  const params = useLocalSearchParams();
  const { id } = params as { id?: string };

  const flip: FlipRecord | undefined = flips.find((f) => f.id === id);

  const [saving, setSaving] = useState(false);
  const savedAnim = useRef(new Animated.Value(0)).current;
  const [savedVisible, setSavedVisible] = useState(false);

  const [imageModalVisible, setImageModalVisible] = useState(false);

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(heroTranslate, {
        toValue: 0,
        useNativeDriver: true,
        speed: 1,
        bounciness: 12,
      }),
    ]).start();
  }, []);

  const showSavedToast = () => {
    setSavedVisible(true);
    savedAnim.setValue(0);

    Animated.spring(savedAnim, {
      toValue: 1,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(savedAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => setSavedVisible(false));
      }, 1400);
    });
  };

  if (!flip) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: "white", fontSize: 18, marginBottom: 12 }}>
          Flip not found
        </Text>
        <Pressable onPress={() => router.replace("/history")}>
          <Text style={{ color: GOLD, fontSize: 16 }}>Back to History</Text>
        </Pressable>
      </View>
    );
  }

  /* ============================
     DESTRUCTURE FLIP RECORD
  ============================ */
  const {
    title,
    favourite,
    ai,
    pricing,
    flipScore,
    flipPotential,
    sellSpeed,
    rarity,
    insights,
    images,
  } = flip;

  const origin = ai?.origin ?? null;
  const description = ai?.description ?? null;
  const fullDescription = ai?.fullDescription ?? null;
  const condition = ai?.condition ?? null;
  const conditionScore = ai?.conditionScore ?? null;

  const buyPrice = pricing?.recommendedBuyPrice ?? null;
  const sellPrice = pricing?.recommendedSellPrice ?? null;
  const profit = pricing?.predictedProfit ?? null;

  const roi = profit && buyPrice ? Math.round((profit / buyPrice) * 100) : null;
  const confidence = ai?.conditionScore ?? null;

  /* MARKET */
  const market = flip.market ?? null;

  const googlePriceMin = market?.googlePriceMin ?? null;
  const googlePriceMax = market?.googlePriceMax ?? null;

  const lowest = market?.lowest ?? null;
  const highest = market?.highest ?? null;
  const average = market?.average ?? null;

  const smartPrice = market?.smartPrice ?? null;
  const soldCount = market?.soldCount ?? null;
  const demandScore = market?.demandScore ?? null;

  const aiPriceMin = market?.aiPriceMin ?? flip.aiPriceMin ?? null;
  const aiPriceMax = market?.aiPriceMax ?? flip.aiPriceMax ?? null;
  const aiPriceConfidence =
    market?.aiPriceConfidence ?? flip.aiPriceConfidence ?? null;

  const effectiveRoi =
    roi != null
      ? roi
      : buyPrice && profit != null
      ? Math.round((profit / buyPrice) * 100)
      : null;

  const roiColor = getRoiColor(effectiveRoi);

  const onFakeSave = () => {
    if (saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showSavedToast();
    setTimeout(() => setSaving(false), 400);
  };

  const shareText = () => {
    shareFlip({
      title,
      buyPrice: buyPrice ?? 0,
      sellPrice: sellPrice ?? 0,
      roi: effectiveRoi ?? 0,
      profit: profit ?? 0,
      confidence: confidence ?? 0,
      origin: origin ?? "Unknown",
      description: description ?? "",
      image: images?.[0] ?? null,
    });
  };

  const prettyDate = "Date not recorded";

  /* ============================
     RENDER
  ============================ */
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <Animated.View
          style={{
            opacity: heroFade,
            transform: [{ translateY: heroTranslate }],
            paddingTop: insets.top + 10,
          }}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroImageWrapper}>
              <Pressable
                style={styles.noImageBox}
                disabled={!images?.[0]}
                onPress={() => setImageModalVisible(true)}
              >
                {images?.[0] ? (
                  <Image
                    source={{ uri: images[0] }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.noImageText}>No Image</Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.heroTitle}>{title}</Text>

            <View style={styles.badgeRow}>
              {origin && <Text style={styles.badge}>Origin: {origin}</Text>}
              {confidence != null && (
                <Text style={styles.badgeBlue}>
                  Confidence: {confidence.toFixed(0)}%
                </Text>
              )}
              {/* barcode removed */}
            </View>

            <Text style={styles.dateText}>{prettyDate}</Text>
          </View>
        </Animated.View>

        {/* PROFIT SUMMARY */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profit Summary</Text>

          <View style={styles.row}>
            <Text style={styles.cardLabel}>Buy</Text>
            <Text style={styles.cardValue}>{formatMoney(buyPrice)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.cardLabel}>Sell</Text>
            <Text style={styles.cardValue}>{formatMoney(sellPrice)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.cardLabel}>Profit</Text>
            <Text
              style={[
                styles.cardValue,
                { color: (profit ?? 0) >= 0 ? GREEN : RED },
              ]}
            >
              {formatMoney(profit)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.cardLabel}>ROI</Text>
            <Text style={[styles.cardValue, { color: roiColor }]}>
              {effectiveRoi != null ? `${effectiveRoi}%` : "-"}
            </Text>
          </View>
        </View>

        {/* FLIP SCORE */}
        {(flipScore != null || flipPotential || sellSpeed || rarity) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Flip Score</Text>

            <View style={styles.flipScoreRow}>
              <View style={styles.flipScoreCircle}>
                <Text style={styles.flipScoreNumber}>
                  {flipScore != null ? flipScore : "?"}
                </Text>
                <Text style={styles.flipScoreMax}>/100</Text>
              </View>

              <View style={styles.flipScoreMeta}>
                {flipPotential && (
                  <Text style={styles.flipScoreTag}>
                    Potential: {flipPotential}
                  </Text>
                )}
                {sellSpeed && (
                  <Text style={styles.flipScoreTag}>
                    Sell Speed: {sellSpeed}
                  </Text>
                )}
                {rarity && (
                  <Text style={styles.flipScoreTag}>Rarity: {rarity}</Text>
                )}
                {insights && (
                  <Text style={styles.flipScoreInsight}>{insights}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* MARKET TREND */}
        {(lowest != null || highest != null || average != null) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Market Trend</Text>

            <View style={styles.trendLine}>
              <View style={styles.trendTrack} />

              <View style={[styles.trendDot, { left: "10%" }]} />
              <View style={[styles.trendDot, { left: "50%" }]} />
              <View style={[styles.trendDot, { left: "90%" }]} />
            </View>

            <View style={styles.trendLabelsRow}>
              <View style={styles.trendLabelBlock}>
                <Text style={styles.trendLabelTitle}>Lowest</Text>
                <Text style={styles.trendLabelValue}>
                  {formatMoney(lowest)}
                </Text>
              </View>
              <View style={styles.trendLabelBlock}>
                <Text style={styles.trendLabelTitle}>Average</Text>
                <Text style={styles.trendLabelValue}>
                  {formatMoney(average)}
                </Text>
              </View>
              <View style={styles.trendLabelBlock}>
                <Text style={styles.trendLabelTitle}>Highest</Text>
                <Text style={styles.trendLabelValue}>
                  {formatMoney(highest)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* SMART PRICING */}
        {(smartPrice != null ||
          buyPrice != null ||
          sellPrice != null ||
          profit != null ||
          aiPriceConfidence != null) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Smart Pricing</Text>

            <View style={styles.row}>
              <Text style={styles.cardLabel}>Recommended Buy</Text>
              <Text style={styles.cardValue}>{formatMoney(buyPrice)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.cardLabel}>Recommended Sell</Text>
              <Text style={styles.cardValue}>{formatMoney(sellPrice)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.cardLabel}>Predicted Profit</Text>
              <Text style={styles.cardValue}>{formatMoney(profit)}</Text>
            </View>

            {smartPrice != null && (
              <Text style={styles.smartHighlight}>
                Smart Price: {formatMoney(smartPrice)}
              </Text>
            )}

            {aiPriceConfidence != null && (
              <Text style={styles.cardLine}>
                AI Confidence: {aiPriceConfidence}%
              </Text>
            )}
          </View>
        )}

        {/* AI INSIGHTS */}
        {insights && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>AI Insights</Text>
            <Text style={styles.cardLine}>{insights}</Text>
          </View>
        )}

        {/* DESCRIPTION */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Description</Text>
          <Text style={styles.cardLine}>
            {description || "No description saved"}
          </Text>

          {fullDescription ? (
            <>
              <Text style={styles.sectionHeader}>Details</Text>
              <Text style={styles.cardLine}>{fullDescription}</Text>
            </>
          ) : null}
        </View>

        {/* CONDITION */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Condition</Text>
          <Text style={styles.cardLine}>
            {condition || "No condition recorded"}
          </Text>
          {conditionScore != null && (
            <Text style={styles.cardLine}>
              Condition Score: {conditionScore}%
            </Text>
          )}
        </View>

        {/* MARKET INTELLIGENCE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Market Intelligence</Text>

          <Text style={styles.cardLine}>
            Google Price Range:{" "}
            {googlePriceMin != null || googlePriceMax != null
              ? `${formatMoney(googlePriceMin)} – ${formatMoney(
                  googlePriceMax
                )}`
              : "-"}
          </Text>

          <Text style={styles.cardLine}>
            Market Range:{" "}
            {lowest != null || highest != null
              ? `${formatMoney(lowest)} – ${formatMoney(highest)}`
              : "-"}
          </Text>

          <Text style={styles.cardLine}>
            Average Price: {formatMoney(average)}
          </Text>

          {smartPrice != null && (
            <Text style={styles.cardLine}>
              Smart Price: {formatMoney(smartPrice)}
            </Text>
          )}

          {soldCount != null && (
            <Text style={styles.cardLine}>Sold Count: {soldCount}</Text>
          )}

          {demandScore != null && (
            <Text style={styles.cardLine}>
              Demand Score: {demandScore}%
            </Text>
          )}

          {aiPriceMin != null && aiPriceMax != null && (
            <Text style={styles.cardLine}>
              AI Price Range: {formatMoney(aiPriceMin)} –{" "}
              {formatMoney(aiPriceMax)}
            </Text>
          )}

          {aiPriceConfidence != null && (
            <Text style={styles.cardLine}>
              AI Confidence: {aiPriceConfidence}%
            </Text>
          )}
        </View>

        {/* SHARE CARD */}
        <View style={styles.shareCard}>
          <View style={styles.shareInner}>
            <View style={styles.sharePlaceholder}>
              {images?.[0] ? (
                <Image
                  source={{ uri: images[0] }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ color: "#AFC6FF" }}>No Image</Text>
              )}
            </View>

            <Text style={styles.shareTitle}>{title}</Text>
            <Text style={styles.shareLine}>
              Profit: {formatMoney(profit)}
            </Text>
            <Text style={styles.shareLine}>
              ROI: {effectiveRoi != null ? `${effectiveRoi}%` : "-"}
            </Text>
            {origin && (
              <Text style={styles.shareLineSmall}>Origin: {origin}</Text>
            )}
            <Text style={styles.logo}>FlipPilot</Text>
          </View>
        </View>
      </ScrollView>

      {/* ACTION BAR */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable style={styles.actionButton} onPress={onFakeSave}>
          <Text style={styles.actionText}>
            {saving ? "Saving..." : "Saved Flip"}
          </Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={shareText}>
          <Text style={styles.actionText}>Share Text</Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: "#333" }]}
          onPress={() => router.replace("/history")}
        >
          <Text style={styles.actionText}>Back</Text>
        </Pressable>
      </View>

      {/* IMAGE MODAL */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.imageModalBackdrop}>
          <Pressable
            style={styles.imageModalBackdrop}
            onPress={() => setImageModalVisible(false)}
          >
            <View style={styles.imageModalContent}>
              {images?.[0] ? (
                <Image
                  source={{ uri: images[0] }}
                  style={styles.imageModalImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.noImageText}>No Image</Text>
              )}
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* TOAST */}
      {savedVisible && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: savedAnim,
              transform: [
                {
                  translateY: savedAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.toastText}>✓ Flip already saved</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },

  center: {
    justifyContent: "center",
    alignItems: "center",
  },

  /* HERO */
  heroCard: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    alignItems: "center",
  },
  heroImageWrapper: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0F172A",
  },
  noImageBox: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: { color: SILVER, fontSize: 18 },

  heroTitle: {
    color: GOLD,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 14,
  },

  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 10,
    gap: 8,
  },
  badge: {
    backgroundColor: "#111827",
    color: GOLD,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    fontWeight: "700",
    fontSize: 12,
    borderWidth: 1,
    borderColor: GOLD,
  },
  badgeBlue: {
    backgroundColor: ELECTRIC_BLUE,
    color: "white",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    fontWeight: "700",
    fontSize: 12,
  },
  dateText: {
    marginTop: 8,
    color: SILVER,
    fontSize: 12,
  },

  /* CARD */
  card: {
    backgroundColor: "#111827",
    padding: 18,
    borderRadius: 16,
    marginTop: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  cardTitle: {
    color: GOLD,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  cardLine: {
    color: SILVER,
    fontSize: 15,
    marginBottom: 6,
    textAlign: "center",
  },
  sectionHeader: {
    color: GOLD,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
    textAlign: "center",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cardLabel: {
    color: SILVER,
    fontSize: 15,
  },
  cardValue: {
    color: GOLD,
    fontSize: 15,
    fontWeight: "700",
  },

  /* SHARE CARD */
  shareCard: {
    marginTop: 30,
    alignSelf: "center",
    backgroundColor: "#111827",
    borderRadius: 24,
    overflow: "hidden",
    width: 300,
    height: 420,
    borderWidth: 1,
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  shareInner: {
    flex: 1,
    alignItems: "center",
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  sharePlaceholder: {
    width: 260,
    height: 220,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  shareTitle: {
    color: GOLD,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 12,
    textAlign: "center",
  },
  shareLine: {
    color: SILVER,
    fontSize: 15,
    marginTop: 4,
    textAlign: "center",
  },
  shareLineSmall: {
    color: SILVER,
    fontSize: 13,
    marginTop: 2,
    textAlign: "center",
  },
  logo: {
    color: GOLD,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },

  /* ACTION BAR */
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 16,
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: GOLD,
  },
  actionButton: {
    backgroundColor: GOLD,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: GOLD,
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  actionText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "700",
  },

  /* TOAST */
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 120,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: GOLD,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: GOLD,
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  toastText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },

  /* SMART PRICE */
  smartHighlight: {
    color: GOLD,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 10,
    textAlign: "center",
  },

  /* IMAGE MODAL */
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,17,40,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalContent: {
    width: "90%",
    height: "70%",
    borderRadius: 16,
    backgroundColor: "#000",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalImage: {
    width: "100%",
    height: "100%",
  },

  /* FLIP SCORE */
  flipScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  flipScoreCircle: {
    width: 90,
    height: 90,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: GOLD,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    backgroundColor: "#111827",
  },
  flipScoreNumber: {
    color: GOLD,
    fontSize: 26,
    fontWeight: "900",
  },
  flipScoreMax: {
    color: SILVER,
    fontSize: 12,
    marginTop: -2,
  },
  flipScoreMeta: {
    flex: 1,
  },
  flipScoreTag: {
    color: SILVER,
    fontSize: 13,
    marginBottom: 4,
  },
  flipScoreInsight: {
    color: SILVER,
    fontSize: 13,
    marginTop: 4,
  },

  /* MARKET TREND */
  trendLine: {
    height: 40,
    marginTop: 10,
    marginBottom: 12,
    justifyContent: "center",
  },
  trendTrack: {
    position: "absolute",
    left: "10%",
    right: "10%",
    height: 3,
    backgroundColor: "rgba(255,215,0,0.4)",
    borderRadius: 999,
  },
  trendDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: GOLD,
    marginTop: -6,
  },
  trendLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  trendLabelBlock: {
    flex: 1,
    alignItems: "center",
  },
  trendLabelTitle: {
    color: SILVER,
    fontSize: 12,
    marginBottom: 2,
  },
  trendLabelValue: {
    color: GOLD,
    fontSize: 14,
    fontWeight: "700",
  },
});

