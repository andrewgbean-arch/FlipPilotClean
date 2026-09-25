import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calculator,
  Car,
  CaretRight,
  CheckCircle,
  ChartLineUp,
  ClockCounterClockwise,
  Diamond,
  Heart,
  Images,
  Info,
  Lightbulb,
  Lightning,
  MagnifyingGlassPlus,
  PencilSimple,
  Tag,
  ShieldCheck,
  Trash,
  WarningCircle,
  X,
  XCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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
import {
  formatDate,
  motDaysLeft,
  motExpiryOf,
  motExpiryPhrase,
} from "@/features/vehicles/utils/motDates";
import {
  formatMiles,
  formatMoney,
  realisedProfit,
} from "@/features/vehicles/utils/vehicleStats";
import { buildVehicleTimeline } from "@/features/vehicles/utils/vehicleUtils";
import { estimateVehiclePrice, type VehicleCondition, type VehiclePriceResult } from "@/utils/vehiclePrice";
import { useTheme } from "@/styles/ThemeContext";
import type { Theme } from "@/styles/theme";

const CONDITION_OPTIONS: { key: VehicleCondition; label: string }[] = [
  { key: "excellent", label: "Excellent" },
  { key: "good", label: "Good" },
  { key: "fair", label: "Fair" },
  { key: "poor", label: "Poor" },
];

// Scrims that sit over a photo or a screen; the theme has no translucent black.
const SCRIM = "rgba(0, 0, 0, 0.6)";
const LIGHTBOX = "rgba(0, 0, 0, 0.92)";
const LIGHTBOX_CLOSE = "rgba(255, 255, 255, 0.14)";

/* HELPERS */

// "+£1,200", "-£45.50", "£0" for nothing, "-" when there is no value.
const formatSigned = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "-";
  const rounded = Math.round(n * 100) / 100;
  if (rounded === 0) return formatMoney(0);
  return `${rounded > 0 ? "+" : "-"}${formatMoney(Math.abs(rounded))}`;
};

// The same bands as the scan result and flip screens.
const bandColour = (theme: Theme, percent: number) =>
  percent >= 70 ? theme.success : percent >= 40 ? theme.warning : theme.danger;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const pad = (n: number) => String(n).padStart(2, "0");

// Timeline dates are either a plain calendar day or a full timestamp; both
// read as "18 Sep 2026" (a timestamp on the phone's own calendar).
const eventDate = (value: string) => {
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(value.trim())) return formatDate(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return formatDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
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
  Icon,
  divider,
}: {
  label: string;
  value: string;
  valueColor?: string;
  strong?: boolean;
  Icon?: PhosphorIcon;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.dataRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      {Icon ? <Icon size={20} color={theme.muted} /> : null}
      <Text style={[styles.dataLabel, Icon && styles.dataLabelWithIcon, { color: theme.muted }]}>
        {label}
      </Text>
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

// A label with a value on the right and a filled bar underneath.
function MeterBlock({
  label,
  value,
  percent,
  divider,
}: {
  label: string;
  value: string;
  percent: number;
  divider?: boolean;
}) {
  const theme = useTheme();
  const safe = Math.max(0, Math.min(100, percent));

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.meterBlock, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <View style={styles.meterHeader}>
        <Text style={[styles.dataLabel, { color: theme.muted }]}>{label}</Text>
        <Text style={[styles.meterValue, { color: theme.text }]}>{value}</Text>
      </View>
      <View style={[styles.meterTrack, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.meterFill,
            { width: `${safe}%`, backgroundColor: bandColour(theme, safe) },
          ]}
        />
      </View>
    </View>
  );
}

// One advisory, failure or tip: an icon and the text.
function ListRow({
  Icon,
  color,
  text,
  divider,
}: {
  Icon: PhosphorIcon;
  color: string;
  text: string;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.listRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}>
      <Icon size={20} color={color} />
      <Text style={[styles.listText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

// A tappable row with an icon, a title, a second line and a chevron.
function ActionRow({
  Icon,
  title,
  subtitle,
  onPress,
  divider,
}: {
  Icon: PhosphorIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        divider && { borderTopWidth: 1, borderTopColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <Icon size={22} color={theme.muted} />
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.actionSubtitle, { color: theme.muted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <CaretRight size={16} color={theme.muted} />
    </Pressable>
  );
}

// Loading and missing-vehicle screens: an icon in a circle and a calm line.
function StateView({
  loading,
  Icon,
  iconColor,
  title,
  body,
}: {
  loading?: boolean;
  Icon?: PhosphorIcon;
  iconColor?: string;
  title?: string;
  body: string;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.muted} />
      ) : Icon ? (
        <View style={[styles.stateIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <Icon size={30} color={iconColor ?? theme.muted} />
        </View>
      ) : null}
      {title ? (
        <Text style={[styles.stateTitle, { color: theme.text }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Text style={[styles.stateBody, { color: theme.muted }]}>{body}</Text>
    </View>
  );
}

/* ============================================================
   VEHICLE DETAILS SCREEN
============================================================ */
export default function VehicleDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { vehicles, deleteVehicle, toggleFavourite, updateVehicle, loaded, loadError } =
    useVehicleHistory();

  const vehicle = vehicles.find((v: FlipRecord) => v.id === id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [priceCondition, setPriceCondition] = useState<VehicleCondition>("good");
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceResult, setPriceResult] = useState<VehiclePriceResult | null>(null);

  if (!vehicle) {
    // Saved vehicles are read from storage after launch; don't call one
    // missing before that has finished.
    if (!loaded) {
      return <StateView loading body="Loading your vehicle" />;
    }

    return (
      <StateView
        Icon={loadError ? WarningCircle : Car}
        iconColor={loadError ? theme.warning : theme.muted}
        title={loadError ? "Couldn't load your vehicles" : "Vehicle not found"}
        body={loadError ?? "It may have been deleted from your list."}
      />
    );
  }

  const handleDelete = () => {
    setConfirmDelete(false);
    deleteVehicle(vehicle.id);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/vehicles/list");
    }
  };

  const openPriceEstimate = () => {
    setPriceResult(null);
    setPriceModalVisible(true);
  };

  const runPriceEstimate = async () => {
    if (!vehicle.mot?.make || !vehicle.mot?.model || !vehicle.mot?.year) {
      setPriceResult({
        ok: false,
        error: "missing-vehicle-data",
        message: "This vehicle needs a make, model and year saved (from an MOT lookup) before it can be priced.",
      });
      return;
    }

    setPriceLoading(true);
    const result = await estimateVehiclePrice({
      make: vehicle.mot.make,
      model: vehicle.mot.model,
      year: vehicle.mot.year,
      mileage: vehicle.mot.mileage ?? null,
      condition: priceCondition,
      motAdvisoryCount: vehicle.mot.advisories?.length ?? 0,
      motFailureCount: vehicle.mot.failures?.length ?? 0,
    });
    setPriceResult(result);
    setPriceLoading(false);
  };

  /* HERO */
  const images: string[] = vehicle.images ?? [];
  const photo = images[0] ?? null;
  const mot = vehicle.mot ?? null;
  const reg = mot?.reg?.trim() ? mot.reg.trim() : null;

  /* SOLD: nothing else in the app sets a sale date, so this is where it happens */
  const isSold = !!vehicle.sellDate;
  const soldOn = vehicle.sellDate ? eventDate(vehicle.sellDate) : null;
  // A sale is recorded against the sell price, so it has to be there first.
  const canMarkSold = isSold || vehicle.sellPrice != null;
  const toggleSold = () => {
    if (!canMarkSold) return;
    updateVehicle(vehicle.id, { sellDate: isSold ? null : new Date().toISOString() });
  };

  /* PROFIT: only once both prices are known */
  const profit = realisedProfit(vehicle);
  const buyPrice = vehicle.buyPrice ?? null;
  const sellPrice = vehicle.sellPrice ?? null;
  const profitColor = profit == null ? theme.muted : profit >= 0 ? theme.success : theme.danger;
  const profitLabel =
    profit == null
      ? "Profit not available"
      : `${profit >= 0 ? "Profit" : "Loss"} of ${formatMoney(Math.abs(profit))}`;
  const roi = profit != null && buyPrice != null && buyPrice > 0 ? (profit / buyPrice) * 100 : null;
  const roiText = roi == null ? "-" : `${roi > 0 ? "+" : ""}${roi.toFixed(1)}%`;
  const roiColor = roi == null ? theme.muted : roi < 0 ? theme.danger : theme.text;

  /* MOT EXPIRY: valid, due within 30 days, or expired */
  const motExpiry = motExpiryOf(vehicle);
  const expiryDays = motDaysLeft(vehicle);
  const isExpired = expiryDays != null && expiryDays < 0;
  const isExpiringSoon = expiryDays != null && expiryDays >= 0 && expiryDays <= 30;
  const motTone =
    expiryDays == null
      ? theme.muted
      : isExpired
      ? theme.danger
      : isExpiringSoon
      ? theme.warning
      : theme.success;
  const MotIcon: PhosphorIcon =
    expiryDays == null ? Info : isExpired ? XCircle : isExpiringSoon ? WarningCircle : CheckCircle;
  const motHeadline = capitalise(motExpiryPhrase(expiryDays));
  const advisories = mot?.advisories ?? [];
  const failures = mot?.failures ?? [];

  /* SCORES AND MARKET */
  const flipScore =
    typeof vehicle.flipScore === "number" && Number.isFinite(vehicle.flipScore)
      ? vehicle.flipScore
      : null;
  const flipPercent = flipScore == null ? 0 : Math.max(0, Math.min(100, flipScore));
  const demandScore = vehicle.market?.demandScore ?? null;
  const aiConfidence = vehicle.aiPriceConfidence ?? null;

  const market = vehicle.market ?? null;
  const marketRows: { label: string; value: string }[] = [];
  if (market?.lowest != null) marketRows.push({ label: "Lowest price", value: formatMoney(market.lowest) });
  if (market?.average != null) marketRows.push({ label: "Average price", value: formatMoney(market.average) });
  if (market?.highest != null) marketRows.push({ label: "Highest price", value: formatMoney(market.highest) });
  if (market?.smartPrice != null) marketRows.push({ label: "Smart price", value: formatMoney(market.smartPrice) });
  if (market?.googlePriceMin != null || market?.googlePriceMax != null) {
    marketRows.push({
      label: "Google price range",
      value: `${formatMoney(market?.googlePriceMin)} – ${formatMoney(market?.googlePriceMax)}`,
    });
  }
  if (market?.soldCount != null) marketRows.push({ label: "Live listings found", value: String(market.soldCount) });
  const showMarketConfidence = aiConfidence != null;
  const hasMarket = demandScore != null || marketRows.length > 0 || showMarketConfidence;

  const valuationRows: { label: string; value: string }[] = [];
  if (vehicle.valuation != null) valuationRows.push({ label: "Valuation", value: formatMoney(vehicle.valuation) });

  const timeline = buildVehicleTimeline(vehicle);
  const tips = vehicle.proTips ?? [];

  const openScreen = (path: string) => router.push(path);

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
        <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <View style={styles.heroRow}>
            {photo ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View photo full size"
                style={({ pressed }) => [styles.heroThumb, pressed && styles.pressed]}
                onPress={() => setViewerUri(photo)}
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
                <Car size={32} color={theme.muted} />
              </View>
            )}

            <View style={styles.heroText}>
              <Text style={[styles.heroTitle, { color: theme.text }]} accessibilityRole="header">
                {vehicle.title}
              </Text>
              {reg ? (
                <View
                  accessible
                  accessibilityLabel={`Registration ${reg}`}
                  style={[styles.regPill, { backgroundColor: theme.background, borderColor: theme.hairline }]}
                >
                  <Text style={[styles.regText, { color: theme.text }]}>{reg}</Text>
                </View>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={vehicle.favourite ? "Remove from favourites" : "Add to favourites"}
              accessibilityState={{ selected: !!vehicle.favourite }}
              style={({ pressed }) => [styles.favouriteButton, pressed && styles.pressed]}
              onPress={() => toggleFavourite(vehicle.id)}
            >
              <Heart
                size={24}
                weight={vehicle.favourite ? "fill" : "regular"}
                color={vehicle.favourite ? theme.gold : theme.muted}
              />
            </Pressable>
          </View>
        </View>

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
                roi != null
                  ? `Return on investment ${roi.toFixed(1)} percent`
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
          <DataRow
            label="Status"
            value={isSold ? (soldOn ? `Sold ${soldOn}` : "Sold") : "In stock"}
            valueColor={isSold ? theme.success : undefined}
            divider
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSold ? "Mark as unsold" : "Mark as sold"}
          accessibilityState={{ disabled: !canMarkSold }}
          disabled={!canMarkSold}
          onPress={toggleSold}
          style={({ pressed }) => [
            styles.soldButton,
            { borderColor: theme.hairline, backgroundColor: theme.card },
            !canMarkSold && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Tag size={18} color={theme.text} />
          <Text style={[styles.secondaryLabel, { color: theme.text }]} numberOfLines={1}>
            {isSold ? "Mark as unsold" : "Mark as sold"}
          </Text>
        </Pressable>
        {!canMarkSold ? (
          <Text style={[styles.note, { color: theme.muted }]}>
            Add the price it sold for in Edit flip, then mark it as sold.
          </Text>
        ) : null}

        {profit == null ? (
          <Text style={[styles.note, { color: theme.muted }]}>
            Add a buy and a sell price to see this vehicle's profit.
          </Text>
        ) : null}

        {/* MOT STATUS */}
        {mot ? (
          <>
            <SectionTitle>MOT and tax</SectionTitle>
            <Group>
              <View
                accessible
                accessibilityLabel={`MOT ${motExpiryPhrase(expiryDays)}`}
                style={styles.statusHeader}
              >
                <View style={[styles.statusIcon, { backgroundColor: theme.background }]}>
                  <MotIcon size={26} color={motTone} weight="fill" />
                </View>
                <View style={styles.statusText}>
                  <Text style={[styles.smallLabel, { color: theme.muted }]}>Current MOT</Text>
                  <Text style={[styles.statusHeadline, { color: motTone }]}>{motHeadline}</Text>
                </View>
              </View>

              <DataRow label="Expiry date" value={motExpiry ? formatDate(motExpiry) : "-"} divider />
              <DataRow label="MOT status" value={mot.motStatus ?? "Unknown"} divider />
              <DataRow label="Tax status" value={mot.taxStatus ?? "Unknown"} divider />
            </Group>
          </>
        ) : null}

        {/* ACTIONS */}
        <SectionTitle>Explore</SectionTitle>
        <Group>
          <ActionRow
            Icon={Images}
            title="Gallery"
            subtitle={images.length > 0 ? plural(images.length, "photo", "photos") : "View and manage photos"}
            onPress={() => openScreen(`/vehicles/gallery/${vehicle.id}`)}
          />
          <ActionRow
            Icon={ClockCounterClockwise}
            title="MOT timeline"
            subtitle="Past tests and mileage"
            onPress={() => openScreen(`/mot/${vehicle.id}`)}
            divider
          />
          <ActionRow
            Icon={ChartLineUp}
            title="Market scan"
            subtitle="Price range, demand and similar listings"
            onPress={() => openScreen(`/vehicles/market/${vehicle.id}`)}
            divider
          />
          <ActionRow
            Icon={Calculator}
            title="Price estimate"
            subtitle="Based on real comparable listings on eBay"
            onPress={openPriceEstimate}
            divider
          />
        </Group>

        {/* PHOTOS */}
        {images.length > 1 ? (
          <>
            <SectionTitle>Photos</SectionTitle>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoStrip}
              contentContainerStyle={styles.photoStripContent}
            >
              {images.map((uri, i) => (
                <Pressable
                  key={`${uri}-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={`View photo ${i + 1} of ${images.length}`}
                  style={({ pressed }) => [pressed && styles.pressed]}
                  onPress={() => setViewerUri(uri)}
                >
                  <Image
                    source={{ uri }}
                    style={[styles.photoThumb, { backgroundColor: theme.card, borderColor: theme.hairline }]}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* FLIP SCORE */}
        {flipScore != null ? (
          <>
            <SectionTitle>Flip score</SectionTitle>
            <Group>
              <View
                accessible
                accessibilityLabel={`Flip score ${flipScore} out of 100`}
                style={styles.scoreBlock}
              >
                <View style={styles.scoreHeader}>
                  <Text style={[styles.scoreNumber, { color: theme.text }]}>{String(flipScore)}</Text>
                  <Text style={[styles.scoreMax, { color: theme.muted }]}>/ 100</Text>
                </View>
                <View style={[styles.meterTrack, { backgroundColor: theme.background }]}>
                  <View
                    style={[
                      styles.meterFill,
                      { width: `${flipPercent}%`, backgroundColor: bandColour(theme, flipPercent) },
                    ]}
                  />
                </View>
              </View>
            </Group>
          </>
        ) : null}

        {/* VEHICLE */}
        {mot ? (
          <>
            <SectionTitle>Vehicle</SectionTitle>
            <Group>
              <DataRow label="Make" value={mot.make ?? "-"} />
              <DataRow label="Model" value={mot.model ?? "-"} divider />
              <DataRow label="Year" value={mot.year != null ? String(mot.year) : "-"} divider />
              <DataRow label="Registration" value={reg ?? "-"} divider />
              <DataRow label="Mileage" value={formatMiles(mot.mileage)} divider />
              {mot.colour ? <DataRow label="Colour" value={mot.colour} divider /> : null}
              {mot.keepers != null ? (
                <DataRow label="Keepers" value={String(mot.keepers)} divider />
              ) : null}
            </Group>
          </>
        ) : null}

        {/* ATTRIBUTES */}
        <SectionTitle>Attributes</SectionTitle>
        <Group>
          <DataRow Icon={Diamond} label="Rarity" value={vehicle.rarity ?? "Unknown"} />
          <DataRow
            Icon={ShieldCheck}
            label="Condition"
            value={vehicle.ai?.condition ?? "Unknown"}
            divider
          />
          <DataRow Icon={Lightning} label="Sell speed" value={vehicle.sellSpeed ?? "Unknown"} divider />
        </Group>

        {/* MARKET */}
        <SectionTitle>Market</SectionTitle>
        <Group>
          {demandScore != null ? (
            <MeterBlock label="Demand score" value={`${demandScore}/100`} percent={demandScore} />
          ) : null}
          {showMarketConfidence && aiConfidence != null ? (
            <MeterBlock
              label="AI confidence"
              value={`${aiConfidence}/100`}
              percent={aiConfidence}
              divider={demandScore != null}
            />
          ) : null}
          {marketRows.map((row, i) => (
            <DataRow
              key={row.label}
              label={row.label}
              value={row.value}
              divider={demandScore != null || showMarketConfidence || i > 0}
            />
          ))}
          {!hasMarket ? (
            <TextBlock text="No market data has been saved for this vehicle yet." muted />
          ) : null}
        </Group>

        {/* VALUATION */}
        {valuationRows.length > 0 ? (
          <>
            <SectionTitle>Valuation</SectionTitle>
            <Group>
              {valuationRows.map((row, i) => (
                <DataRow key={row.label} label={row.label} value={row.value} divider={i > 0} />
              ))}
            </Group>
          </>
        ) : null}

        {/* FAILURES */}
        {failures.length > 0 ? (
          <>
            <SectionTitle>{`Failures (${failures.length})`}</SectionTitle>
            <Group>
              {failures.map((text, i) => (
                <ListRow key={`f-${i}`} Icon={XCircle} color={theme.danger} text={text} divider={i > 0} />
              ))}
            </Group>
          </>
        ) : null}

        {/* ADVISORIES */}
        {advisories.length > 0 ? (
          <>
            <SectionTitle>{`Advisories (${advisories.length})`}</SectionTitle>
            <Group>
              {advisories.map((text, i) => (
                <ListRow
                  key={`a-${i}`}
                  Icon={WarningCircle}
                  color={theme.warning}
                  text={text}
                  divider={i > 0}
                />
              ))}
            </Group>
          </>
        ) : null}

        {/* TIMELINE */}
        {timeline.length > 0 ? (
          <>
            <SectionTitle>Timeline</SectionTitle>
            <Group>
              <View style={styles.timeline}>
                {timeline.map((event, i) => {
                  const when = eventDate(event.date);
                  const last = i === timeline.length - 1;

                  return (
                    <View
                      key={`${event.type}-${i}`}
                      accessible
                      accessibilityLabel={when ? `${when}: ${event.label}` : event.label}
                      style={styles.timelineRow}
                    >
                      <View style={styles.timelineRail}>
                        <View style={[styles.timelineDot, { backgroundColor: theme.muted }]} />
                        {!last ? (
                          <View style={[styles.timelineLine, { backgroundColor: theme.hairline }]} />
                        ) : null}
                      </View>
                      <View style={[styles.timelineText, !last && styles.timelineGap]}>
                        {when ? (
                          <Text style={[styles.timelineDate, { color: theme.muted }]}>{when}</Text>
                        ) : null}
                        <Text style={[styles.timelineLabel, { color: theme.text }]}>{event.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Group>
          </>
        ) : null}

        {/* AI PRO TIPS */}
        {tips.length > 0 ? (
          <>
            <SectionTitle>AI pro tips</SectionTitle>
            <Group>
              {tips.map((tip, i) => (
                <ListRow key={`t-${i}`} Icon={Lightbulb} color={theme.muted} text={tip} divider={i > 0} />
              ))}
            </Group>
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
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete flip"
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.hairline, backgroundColor: theme.card },
              pressed && styles.pressed,
            ]}
            onPress={() => setConfirmDelete(true)}
          >
            <Trash size={18} color={theme.danger} />
            <Text style={[styles.secondaryLabel, { color: theme.danger }]} numberOfLines={1}>
              Delete
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit flip"
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.gold },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push(`/vehicles/edit/${vehicle.id}`)}
          >
            <PencilSimple size={18} color={theme.black} weight="bold" />
            <Text style={[styles.primaryLabel, { color: theme.black }]} numberOfLines={1}>
              Edit flip
            </Text>
          </Pressable>
        </View>
      </View>

      {/* DELETE CONFIRMATION */}
      <Modal
        visible={confirmDelete}
        animationType="fade"
        transparent
        onRequestClose={() => setConfirmDelete(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]} accessibilityRole="header">
              Delete this flip?
            </Text>
            <Text style={[styles.modalText, { color: theme.muted }]}>
              {vehicle.title} will be removed from your flips. This can't be undone.
            </Text>

            <View style={styles.modalButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
                onPress={() => setConfirmDelete(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete flip"
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.danger },
                  pressed && styles.pressed,
                ]}
                onPress={handleDelete}
              >
                <Text style={[styles.modalButtonText, { color: theme.white }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* PRICE ESTIMATE */}
      <Modal
        visible={priceModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPriceModalVisible(false)}
      >
        <View style={styles.priceSheetBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close price estimate"
            onPress={() => setPriceModalVisible(false)}
          />
          <View
            style={[
              styles.priceSheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.hairline,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
              },
            ]}
          >
            <View style={[styles.priceSheetGrabber, { backgroundColor: theme.muted }]} />

            <View style={styles.priceSheetHeader}>
              <Text style={[styles.priceSheetTitle, { color: theme.text }]} accessibilityRole="header">
                Price estimate
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close price estimate"
                hitSlop={8}
                style={({ pressed }) => [styles.priceSheetClose, pressed && styles.pressed]}
                onPress={() => setPriceModalVisible(false)}
              >
                <X size={22} color={theme.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.priceSheetScroll}>
              <Text style={[styles.priceSheetLabel, { color: theme.muted }]}>Condition</Text>
              <View style={styles.priceConditionRow} accessibilityRole="radiogroup">
                {CONDITION_OPTIONS.map((o) => {
                  const selected = priceCondition === o.key;
                  return (
                    <Pressable
                      key={o.key}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setPriceCondition(o.key)}
                      style={({ pressed }) => [
                        styles.priceConditionChip,
                        selected
                          ? { backgroundColor: theme.goldTint, borderColor: theme.gold }
                          : { backgroundColor: theme.background, borderColor: theme.hairline },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={{ color: selected ? theme.gold : theme.text, fontWeight: "600" }}>
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Get price estimate"
                disabled={priceLoading}
                onPress={runPriceEstimate}
                style={({ pressed }) => [
                  styles.priceEstimateButton,
                  { backgroundColor: theme.gold },
                  priceLoading && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                {priceLoading ? (
                  <ActivityIndicator size="small" color={theme.black} />
                ) : (
                  <Text style={{ color: theme.black, fontWeight: "700", fontSize: 16 }}>
                    Get price estimate
                  </Text>
                )}
              </Pressable>

              {priceResult && !priceResult.ok ? (
                <Text style={[styles.priceSheetError, { color: theme.danger }]} accessibilityLiveRegion="polite">
                  {priceResult.message}
                </Text>
              ) : null}

              {priceResult && priceResult.ok ? (
                <View style={styles.priceResultBlock}>
                  <Text style={[styles.priceEstimateValue, { color: theme.text }]}>
                    {formatMoney(priceResult.estimatedValue)}
                  </Text>
                  <Text style={[styles.priceSheetLabel, { color: theme.muted }]}>
                    Likely range {formatMoney(priceResult.range.min)} – {formatMoney(priceResult.range.max)} ·{" "}
                    {priceResult.confidence} confidence
                  </Text>

                  {priceResult.notes.map((note, i) => (
                    <Text key={i} style={[styles.priceNote, { color: theme.muted }]}>
                      • {note}
                    </Text>
                  ))}

                  <Text style={[styles.priceSheetLabel, { color: theme.muted, marginTop: 16 }]}>
                    {plural(priceResult.comparableCount, "comparable listing", "comparable listings")} on
                    eBay right now
                  </Text>
                  {priceResult.comparables.map((c, i) => (
                    <Pressable
                      key={i}
                      accessibilityRole="link"
                      onPress={() => c.url && Linking.openURL(c.url)}
                      style={({ pressed }) => [
                        styles.comparableRow,
                        { borderTopColor: theme.hairline },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.comparableTitle, { color: theme.text }]} numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Text style={[styles.comparablePrice, { color: theme.muted }]}>
                        {formatMoney(c.price)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PHOTO VIEWER */}
      <Modal
        visible={viewerUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          style={styles.lightbox}
          onPress={() => setViewerUri(null)}
        >
          {viewerUri ? (
            <Image source={{ uri: viewerUri }} style={styles.lightboxImage} resizeMode="contain" />
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
    gap: 8,
    alignItems: "flex-start",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },
  regPill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  regText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  favouriteButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginRight: -8,
    marginTop: -8,
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
  smallLabel: {
    fontSize: 13,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
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

  /* ROWS */
  dataRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dataLabel: {
    fontSize: 15,
  },
  dataLabelWithIcon: {
    flex: 1,
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
  listRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
  actionRow: {
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  actionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  /* METERS */
  meterBlock: {
    padding: 16,
  },
  meterHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
  },
  meterValue: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  meterTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 10,
  },
  meterFill: {
    height: "100%",
    borderRadius: 4,
  },
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

  /* MOT STATUS */
  statusHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    flex: 1,
  },
  statusHeadline: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
    marginTop: 2,
  },

  /* PHOTOS */
  photoStrip: {
    marginHorizontal: -16,
  },
  photoStripContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  photoThumb: {
    width: 140,
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
  },

  /* TIMELINE */
  timeline: {
    padding: 16,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 14,
  },
  timelineRail: {
    width: 10,
    alignItems: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 4,
  },
  timelineText: {
    flex: 1,
  },
  timelineGap: {
    paddingBottom: 18,
  },
  timelineDate: {
    fontSize: 13,
  },
  timelineLabel: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    marginTop: 2,
  },

  soldButton: {
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  disabled: {
    opacity: 0.45,
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
    flex: 1.5,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },

  /* DELETE CONFIRMATION */
  overlay: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  modalText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },

  /* PRICE ESTIMATE SHEET */
  priceSheetBackdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: "flex-end",
  },
  priceSheet: {
    maxHeight: "85%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  priceSheetGrabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
    marginBottom: 14,
  },
  priceSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  priceSheetTitle: { fontSize: 18, fontWeight: "700" },
  priceSheetClose: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
  },
  priceSheetScroll: { flexGrow: 0 },
  priceSheetLabel: { fontSize: 13, marginBottom: 8 },
  priceConditionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  priceConditionChip: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  priceEstimateButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  priceSheetError: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  priceResultBlock: { marginTop: 20, paddingBottom: 8 },
  priceEstimateValue: { fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"] },
  priceNote: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  comparableRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  comparableTitle: { flex: 1, fontSize: 14 },
  comparablePrice: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },

  /* PHOTO VIEWER */
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
