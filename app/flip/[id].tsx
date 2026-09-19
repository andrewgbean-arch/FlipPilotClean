import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  CheckCircle,
  Heart,
  MagnifyingGlassPlus,
  MapPin,
  Package,
  ShareNetwork,
  Sparkle,
  WarningCircle,
  X,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import type { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { useTheme } from "@/styles/ThemeContext";
import { shareFlip } from "@/utils/share/shareFlip";

// Scrims that sit over a photo; the theme has no translucent black.
const SCRIM = "rgba(0, 0, 0, 0.6)";
const LIGHTBOX = "rgba(0, 0, 0, 0.92)";
const LIGHTBOX_CLOSE = "rgba(255, 255, 255, 0.14)";

/* HELPERS */
const toNumber = (n: number | null | undefined) => {
  if (n == null) return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
};

// "£12.50", "-£3.00" for a negative, "-" when there is no value.
const formatMoney = (n: number | null | undefined) => {
  const v = toNumber(n);
  if (v == null) return "-";
  return `${v < 0 ? "-" : ""}£${Math.abs(v).toFixed(2)}`;
};

// Profit and loss always carry a sign: "+£12.50" / "-£3.00".
const formatSigned = (n: number | null | undefined) => {
  const v = toNumber(n);
  if (v == null) return "-";
  return `${v >= 0 ? "+" : "-"}£${Math.abs(v).toFixed(2)}`;
};

/* SMALL LOCAL COMPONENTS */
function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

// A card that holds rows and blocks; the rows inside are split by hairlines.
function Group({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      {children}
    </View>
  );
}

function DataRow({
  label,
  value,
  valueColor,
  strong,
  divider,
}: {
  label: string;
  value: string;
  valueColor?: string;
  strong?: boolean;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.dataRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <Text style={[styles.dataLabel, { color: theme.muted }]}>{label}</Text>
      <Text
        style={[
          styles.dataValue,
          strong && styles.dataValueStrong,
          { color: valueColor ?? theme.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// Free text inside a group, with an optional small heading above it.
function TextBlock({
  text,
  muted,
  label,
  divider,
}: {
  text: string;
  muted?: boolean;
  label?: string;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.textBlock, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}>
      {label ? <Text style={[styles.textBlockLabel, { color: theme.muted }]}>{label}</Text> : null}
      <Text style={[styles.textBlockText, { color: muted ? theme.muted : theme.text }]}>{text}</Text>
    </View>
  );
}

function Chip({ Icon, label }: { Icon: PhosphorIcon; label: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.chip, { backgroundColor: theme.background }]}>
      <Icon size={14} color={theme.muted} />
      <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Lowest-to-highest price track with a marker where the average sits.
function RangeBar({ position }: { position: number | null }) {
  const theme = useTheme();

  return (
    <View style={styles.rangeWrap}>
      <View style={[styles.rangeTrack, { backgroundColor: theme.background }]} />
      {position != null ? (
        <View
          style={[
            styles.rangeMarker,
            {
              left: `${position * 100}%`,
              backgroundColor: theme.text,
              borderColor: theme.card,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

export default function FlipDetails() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { vehicles: flips, toggleFavourite, loaded, loadError } = useVehicleHistory();

  const params = useLocalSearchParams();
  const { id } = params as { id?: string };

  const flip: FlipRecord | undefined = flips.find((f) => f.id === id);

  const [saving, setSaving] = useState(false);
  const savedAnim = useRef(new Animated.Value(0)).current;
  const [savedVisible, setSavedVisible] = useState(false);

  const [imageModalVisible, setImageModalVisible] = useState(false);

  const heroFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroFade, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
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
    // Saved flips are read from storage after launch; don't call one missing
    // before that has finished.
    if (!loaded) {
      return (
        <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.muted} />
          <Text style={[styles.stateBody, { color: theme.muted }]}>Loading your saved flip</Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <View
          style={[styles.stateIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
        >
          {loadError ? (
            <WarningCircle size={30} color={theme.warning} />
          ) : (
            <Package size={30} color={theme.muted} />
          )}
        </View>
        <Text style={[styles.stateTitle, { color: theme.text }]} accessibilityRole="header">
          {loadError ? "Couldn't load your flips" : "Flip not found"}
        </Text>
        <Text style={[styles.stateBody, { color: theme.muted }]}>
          {loadError ?? "It may have been deleted from your history."}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to History"
          style={({ pressed }) => [
            styles.primaryButton,
            styles.stateButton,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={() => router.replace("/history")}
        >
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Back to History</Text>
        </Pressable>
      </View>
    );
  }

  /* ============================
     DESTRUCTURE FLIP RECORD
  ============================ */
  const {
    title,
    ai,
    pricing,
    flipScore,
    flipPotential,
    sellSpeed,
    rarity,
    insights,
    images,
  } = flip;

  const photo = images?.[0] ? images[0] : null;

  const origin = ai?.origin ?? null;
  const description = ai?.description ?? null;
  const fullDescription = ai?.fullDescription ?? null;
  const condition = ai?.condition ?? null;
  const conditionScore = ai?.conditionScore ?? null;

  // Buy/sell/profit live at the top level and are what edits update (a cleared
  // price is null). `pricing` is the original scan estimate, used only when the
  // record has no top-level prices at all.
  const ownPrices =
    flip.buyPrice != null || flip.sellPrice != null || flip.profit != null;
  const buyPrice = (ownPrices ? flip.buyPrice : pricing?.recommendedBuyPrice) ?? null;
  const sellPrice = (ownPrices ? flip.sellPrice : pricing?.recommendedSellPrice) ?? null;
  const profit = (ownPrices ? flip.profit : pricing?.predictedProfit) ?? null;

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

  /* DISPLAY VALUES */
  const profitValue = toNumber(profit);
  const profitColor =
    profitValue == null ? theme.muted : profitValue >= 0 ? theme.success : theme.danger;
  const profitLabel =
    profitValue == null
      ? "Profit not available"
      : `${profitValue >= 0 ? "Profit" : "Loss"} of £${Math.abs(profitValue).toFixed(2)}`;

  const roiText =
    effectiveRoi == null ? "-" : `${effectiveRoi > 0 ? "+" : ""}${effectiveRoi}%`;
  const roiColor =
    effectiveRoi == null
      ? theme.muted
      : effectiveRoi < 0
      ? theme.danger
      : effectiveRoi >= 30
      ? theme.success
      : theme.text;

  const scoreValue = toNumber(flipScore);
  const scorePercent = scoreValue == null ? 0 : Math.min(100, Math.max(0, scoreValue));
  const scoreRows = (
    [
      ["Potential", flipPotential],
      ["Sell speed", sellSpeed],
      ["Rarity", rarity],
    ] as [string, string | null | undefined][]
  ).filter((row): row is [string, string] => !!row[1]);
  const showScore = flipScore != null || scoreRows.length > 0;

  const showSmartPricing =
    smartPrice != null ||
    buyPrice != null ||
    sellPrice != null ||
    profit != null ||
    aiPriceConfidence != null;

  // Where the average sits between the lowest and highest price.
  const lowestValue = toNumber(lowest);
  const highestValue = toNumber(highest);
  const averageValue = toNumber(average);
  const averagePosition =
    lowestValue != null &&
    highestValue != null &&
    averageValue != null &&
    highestValue > lowestValue
      ? Math.min(1, Math.max(0, (averageValue - lowestValue) / (highestValue - lowestValue)))
      : null;
  const hasRange = lowest != null || highest != null || average != null;

  const marketRows: { label: string; value: string }[] = [];
  if (googlePriceMin != null || googlePriceMax != null) {
    marketRows.push({
      label: "Google price range",
      value: `${formatMoney(googlePriceMin)} – ${formatMoney(googlePriceMax)}`,
    });
  }
  if (soldCount != null) {
    marketRows.push({ label: "Sold count", value: String(soldCount) });
  }
  if (demandScore != null) {
    marketRows.push({ label: "Demand score", value: `${demandScore}%` });
  }
  if (aiPriceMin != null && aiPriceMax != null) {
    marketRows.push({
      label: "AI price range",
      value: `${formatMoney(aiPriceMin)} – ${formatMoney(aiPriceMax)}`,
    });
  }

  // The flip is already stored in History; this only confirms that to the user.
  const onConfirmSaved = () => {
    if (saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showSavedToast();
    setTimeout(() => setSaving(false), 400);
  };

  // Opens the share sheet with a text summary of the flip. Null
  // confidence/origin/ROI are left out of the shared text rather than printed
  // as "0%" / "Unknown".
  const shareSummary = () => {
    shareFlip({
      title,
      buyPrice: buyPrice ?? 0,
      sellPrice: sellPrice ?? 0,
      roi: effectiveRoi,
      profit: profit ?? 0,
      confidence,
      origin,
      description: description ?? "",
      image: images?.[0] ?? null,
      flipScore,
    });
  };

  const savedOn = flip.timestamp ? new Date(flip.timestamp) : null;
  const prettyDate =
    savedOn && !Number.isNaN(savedOn.getTime())
      ? `Saved ${savedOn.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : "Date not recorded";

  // Back to wherever the flip was opened from (Home or History); fall back to
  // History only when there is nothing to go back to.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/history");
  };

  /* ============================
     RENDER
  ============================ */
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <Animated.View style={{ opacity: heroFade }}>
          <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
            <View style={styles.heroRow}>
              {photo ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View photo full size"
                  style={({ pressed }) => [styles.heroThumb, pressed && styles.pressed]}
                  onPress={() => setImageModalVisible(true)}
                >
                  <Image source={{ uri: photo }} style={styles.heroImage} resizeMode="cover" />
                  <View style={[styles.zoomBadge, { backgroundColor: SCRIM }]}>
                    <MagnifyingGlassPlus size={14} color={theme.white} />
                  </View>
                </Pressable>
              ) : (
                <View
                  accessibilityLabel="No photo saved"
                  style={[styles.heroThumb, styles.heroPlaceholder, { backgroundColor: theme.background }]}
                >
                  <Package size={32} color={theme.muted} />
                </View>
              )}

              <View style={styles.heroText}>
                <Text
                  style={[styles.heroTitle, { color: theme.text }]}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
                <Text style={[styles.heroDate, { color: theme.muted }]}>{prettyDate}</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={flip.favourite ? "Remove from favourites" : "Save to favourites"}
                accessibilityState={{ selected: !!flip.favourite }}
                hitSlop={6}
                style={({ pressed }) => [styles.favouriteButton, pressed && styles.pressed]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  toggleFavourite(flip.id);
                }}
              >
                <Heart
                  size={26}
                  weight={flip.favourite ? "fill" : "regular"}
                  color={flip.favourite ? theme.gold : theme.muted}
                />
              </Pressable>
            </View>

            {origin || confidence != null ? (
              <View style={styles.chips}>
                {origin ? <Chip Icon={MapPin} label={`Origin: ${origin}`} /> : null}
                {confidence != null ? (
                  <Chip Icon={Sparkle} label={`Confidence: ${confidence.toFixed(0)}%`} />
                ) : null}
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* PROFIT SUMMARY */}
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <View style={styles.summaryTop}>
            <View accessible accessibilityLabel={profitLabel} style={styles.summaryMain}>
              <Text style={[styles.smallLabel, { color: theme.muted }]}>Profit</Text>
              <Text
                style={[styles.profitFigure, { color: profitColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatSigned(profit)}
              </Text>
            </View>

            <View
              accessible
              accessibilityLabel={
                effectiveRoi != null
                  ? `Return on investment ${effectiveRoi} percent`
                  : "Return on investment not available"
              }
              style={styles.summaryRoi}
            >
              <Text style={[styles.smallLabel, { color: theme.muted }]}>ROI</Text>
              <Text style={[styles.roiFigure, { color: roiColor }]}>{roiText}</Text>
            </View>
          </View>

          <DataRow label="Buy" value={formatMoney(buyPrice)} divider />
          <DataRow label="Sell" value={formatMoney(sellPrice)} divider />
        </View>

        {/* FLIP SCORE */}
        {showScore ? (
          <>
            <SectionTitle>Flip score</SectionTitle>
            <Group>
              {flipScore != null ? (
                <View
                  accessible
                  accessibilityLabel={`Flip score ${flipScore} out of 100`}
                  style={styles.scoreBlock}
                >
                  <View style={styles.scoreHeader}>
                    <Text style={[styles.scoreNumber, { color: theme.text }]}>
                      {String(flipScore)}
                    </Text>
                    <Text style={[styles.scoreMax, { color: theme.muted }]}>/ 100</Text>
                  </View>
                  <View style={[styles.scoreTrack, { backgroundColor: theme.background }]}>
                    <View
                      style={[
                        styles.scoreFill,
                        {
                          width: `${scorePercent}%`,
                          // The same bands as the scan result screen.
                          backgroundColor:
                            scorePercent >= 70
                              ? theme.success
                              : scorePercent >= 40
                              ? theme.warning
                              : theme.danger,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : null}

              {scoreRows.map(([label, value], i) => (
                <DataRow
                  key={label}
                  label={label}
                  value={String(value)}
                  divider={i > 0 || flipScore != null}
                />
              ))}
            </Group>
          </>
        ) : null}

        {/* AI INSIGHTS */}
        {insights ? (
          <>
            <SectionTitle>AI insights</SectionTitle>
            <Group>
              <TextBlock text={insights} />
            </Group>
          </>
        ) : null}

        {/* SMART PRICING */}
        {showSmartPricing ? (
          <>
            <SectionTitle>Smart pricing</SectionTitle>
            <Group>
              <DataRow label="Recommended buy" value={formatMoney(buyPrice)} />
              <DataRow label="Recommended sell" value={formatMoney(sellPrice)} divider />
              <DataRow
                label="Predicted profit"
                value={formatSigned(profit)}
                valueColor={profitColor}
                divider
              />
              {smartPrice != null ? (
                <DataRow label="Smart price" value={formatMoney(smartPrice)} strong divider />
              ) : null}
              {aiPriceConfidence != null ? (
                <DataRow label="AI confidence" value={`${aiPriceConfidence}%`} divider />
              ) : null}
            </Group>
          </>
        ) : null}

        {/* MARKET */}
        <SectionTitle>Market</SectionTitle>
        <Group>
          {hasRange ? (
            <View
              accessible
              accessibilityLabel={`Market prices. Lowest ${formatMoney(lowest)}, average ${formatMoney(
                average
              )}, highest ${formatMoney(highest)}`}
              style={styles.rangeBlock}
            >
              <RangeBar position={averagePosition} />
              <View style={styles.rangeLabels}>
                <View style={styles.rangeColStart}>
                  <Text style={[styles.rangeLabel, { color: theme.muted }]}>Lowest</Text>
                  <Text style={[styles.rangeValue, { color: theme.text }]}>
                    {formatMoney(lowest)}
                  </Text>
                </View>
                <View style={styles.rangeColMid}>
                  <Text style={[styles.rangeLabel, { color: theme.muted }]}>Average</Text>
                  <Text style={[styles.rangeValue, { color: theme.text }]}>
                    {formatMoney(average)}
                  </Text>
                </View>
                <View style={styles.rangeColEnd}>
                  <Text style={[styles.rangeLabel, { color: theme.muted }]}>Highest</Text>
                  <Text style={[styles.rangeValue, { color: theme.text }]}>
                    {formatMoney(highest)}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {marketRows.map((row, i) => (
            <DataRow
              key={row.label}
              label={row.label}
              value={row.value}
              divider={hasRange || i > 0}
            />
          ))}

          {!hasRange && marketRows.length === 0 ? (
            <TextBlock text="No market data was saved with this flip." muted />
          ) : null}
        </Group>

        {/* DESCRIPTION */}
        <SectionTitle>Description</SectionTitle>
        <Group>
          <TextBlock text={description || "No description saved"} muted={!description} />
          {fullDescription ? <TextBlock label="Details" text={fullDescription} divider /> : null}
        </Group>

        {/* CONDITION */}
        <SectionTitle>Condition</SectionTitle>
        <Group>
          <TextBlock text={condition || "No condition recorded"} muted={!condition} />
          {conditionScore != null ? (
            <DataRow label="Condition score" value={`${conditionScore}%`} divider />
          ) : null}
        </Group>

        {/* SHARE CARD */}
        <SectionTitle>Share card</SectionTitle>
        <View style={[styles.shareCard, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.shareImage} resizeMode="cover" />
          ) : null}

          <Text style={[styles.shareTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.shareProfit, { color: profitColor }]}>{formatSigned(profit)}</Text>
          <Text style={[styles.shareMeta, { color: theme.muted }]}>Profit · ROI {roiText}</Text>
          {origin ? (
            <Text style={[styles.shareMeta, { color: theme.muted }]}>Origin: {origin}</Text>
          ) : null}
          <Text style={[styles.shareLogo, { color: theme.gold }]}>FlipPilot</Text>
        </View>
      </ScrollView>

      {/* ACTIONS */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.hairline,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.hairline, backgroundColor: theme.card },
              pressed && styles.pressed,
            ]}
            onPress={goBack}
          >
            <ArrowLeft size={18} color={theme.text} />
            <Text style={[styles.secondaryLabel, { color: theme.text }]} numberOfLines={1}>
              Back
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Saved to history"
            accessibilityHint="Confirms this flip is already saved"
            accessibilityState={{ disabled: saving }}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.hairline, backgroundColor: theme.card },
              pressed && styles.pressed,
            ]}
            onPress={onConfirmSaved}
          >
            <CheckCircle size={18} color={theme.success} weight="fill" />
            <Text style={[styles.secondaryLabel, { color: theme.text }]} numberOfLines={1}>
              Saved
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share flip summary"
            style={({ pressed }) => [
              styles.primaryButton,
              styles.shareButton,
              { backgroundColor: theme.gold },
              pressed && styles.pressed,
            ]}
            onPress={shareSummary}
          >
            <ShareNetwork size={18} color={theme.black} weight="bold" />
            <Text style={[styles.primaryLabel, { color: theme.black }]} numberOfLines={1}>
              Share
            </Text>
          </Pressable>
        </View>

        {/* TOAST: sits just above the action bar */}
        {savedVisible ? (
          <Animated.View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[
              styles.toast,
              {
                backgroundColor: theme.cardElevated,
                borderColor: theme.hairline,
                opacity: savedAnim,
                transform: [
                  {
                    translateY: savedAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <CheckCircle size={20} color={theme.success} weight="fill" />
            <Text style={[styles.toastText, { color: theme.text }]}>
              Already saved in your history
            </Text>
          </Animated.View>
        ) : null}
      </View>

      {/* IMAGE MODAL */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          style={styles.lightbox}
          onPress={() => setImageModalVisible(false)}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={styles.lightboxImage} resizeMode="contain" />
          ) : null}

          <View style={[styles.lightboxClose, { top: insets.top + 12 }]}>
            <X size={22} color={theme.white} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  /* LOADING / NOT FOUND */
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  stateButton: {
    alignSelf: "center",
    paddingHorizontal: 28,
    marginTop: 24,
  },

  /* HERO */
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroThumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  favouriteButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },
  heroDate: {
    fontSize: 13,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },

  /* PROFIT SUMMARY */
  summaryCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    padding: 16,
  },
  summaryMain: {
    flex: 1,
  },
  summaryRoi: {
    alignItems: "flex-end",
  },
  smallLabel: {
    fontSize: 13,
  },
  profitFigure: {
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 42,
    fontVariant: ["tabular-nums"],
  },
  roiFigure: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
  },

  /* SECTIONS */
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 12,
  },
  group: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  dataRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  dataLabel: {
    fontSize: 15,
  },
  dataValue: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  dataValueStrong: {
    fontSize: 18,
    fontWeight: "700",
  },
  textBlock: {
    padding: 16,
  },
  textBlockLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  textBlockText: {
    fontSize: 16,
    lineHeight: 23,
  },

  /* FLIP SCORE */
  scoreBlock: {
    padding: 16,
  },
  scoreHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 42,
    fontVariant: ["tabular-nums"],
  },
  scoreMax: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  scoreTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 10,
  },
  scoreFill: {
    height: "100%",
    borderRadius: 4,
  },

  /* MARKET RANGE */
  rangeBlock: {
    padding: 16,
  },
  rangeWrap: {
    height: 16,
    justifyContent: "center",
  },
  rangeTrack: {
    height: 6,
    borderRadius: 3,
  },
  rangeMarker: {
    position: "absolute",
    top: 0,
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    borderWidth: 3,
  },
  rangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  rangeColStart: {
    alignItems: "flex-start",
  },
  rangeColMid: {
    alignItems: "center",
  },
  rangeColEnd: {
    alignItems: "flex-end",
  },
  rangeLabel: {
    fontSize: 13,
  },
  rangeValue: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },

  /* SHARE CARD */
  shareCard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  shareImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 14,
  },
  shareTitle: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    textAlign: "center",
  },
  shareProfit: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  shareMeta: {
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  shareLogo: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 16,
  },

  /* ACTIONS */
  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  primaryButton: {
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  shareButton: {
    flex: 1.5,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },

  /* TOAST */
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: "100%",
    marginBottom: 12,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    pointerEvents: "none",
  },
  toastText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "600",
  },

  /* IMAGE MODAL */
  lightbox: {
    flex: 1,
    backgroundColor: LIGHTBOX,
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: {
    width: "100%",
    height: "80%",
  },
  lightboxClose: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LIGHTBOX_CLOSE,
    alignItems: "center",
    justifyContent: "center",
  },

  pressed: {
    opacity: 0.75,
  },
});
