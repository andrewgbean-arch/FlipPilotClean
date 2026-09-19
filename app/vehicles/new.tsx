import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { TextInputProps } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  ChartLineUp,
  ImageSquare,
  MagnifyingGlass,
  Sparkle,
  WarningCircle,
  X,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useAIValuation } from "@/features/vehicles/hooks/useAIValuation";
import { useMarketScan } from "@/features/vehicles/hooks/useMarketScan";
import { autoFormatReg, getMotStatusColor } from "@/features/vehicles/ui/SupernovaUI";
import { fetchMOT } from "@/features/vehicles/api/mot";
import { formatDate } from "@/features/vehicles/utils/motDates";
import { formatMiles, formatMoney } from "@/features/vehicles/utils/vehicleStats";

// "1,800" or "£1,800" -> 1800. Blank -> null; anything that is not a plain number -> undefined.
function parseAmount(text: string): number | null | undefined {
  const cleaned = text.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  return /^\d*\.?\d+$/.test(cleaned) ? Number(cleaned) : undefined;
}

const normaliseReg = (text: string) => text.replace(/\s+/g, "").toUpperCase();

// "£1,800", or a dash when there is nothing to show.
const money = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? formatMoney(n) : "—";

// "+£800" or "-£200". A profit of exactly zero carries no sign.
const signedMoney = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}${formatMoney(Math.abs(n))}`;
const signedPercent = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toFixed(1)}%`;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// The label shown for an MOT expiry date.
function motStatusLabel(expiry: string | null | undefined): string {
  if (!expiry) return "No data";

  const today = new Date();
  const exp = new Date(expiry);

  if (exp < today) return "Expired";
  if ((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) < 30) return "Due soon";

  return "Valid";
}

// The focus callback a TextInput hands out, passed up so the screen can scroll the field into view.
type FocusHandler = NonNullable<TextInputProps["onFocus"]>;

type ProblemField = "title" | "buy" | "sell" | "mileage" | "year" | "engine";

/* ------------------------------------------------------------------
   Small building blocks
------------------------------------------------------------------ */

// A titled group of fields: an 18/700 heading over a hairline card.
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      {hint ? <Text style={[styles.sectionHint, { color: theme.muted }]}>{hint}</Text> : null}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        {children}
      </View>
    </View>
  );
}

// A label over a 48pt input, with the error (if any) directly underneath.
// "invalid" only outlines the box, for fields whose message is shown under their row.
function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  multiline,
  prefix,
  error,
  invalid,
  onFocus,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  multiline?: boolean;
  prefix?: string;
  error?: string | null;
  invalid?: boolean;
  onFocus?: FocusHandler;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error || invalid ? theme.danger : focused ? theme.gold : theme.hairline;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>

      <View
        style={[
          styles.inputBox,
          multiline ? styles.inputBoxMulti : styles.inputBoxSingle,
          { backgroundColor: theme.background, borderColor },
        ]}
      >
        {prefix ? <Text style={[styles.prefix, { color: theme.muted }]}>{prefix}</Text> : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          multiline={multiline}
          accessibilityLabel={prefix === "£" ? `${label} in pounds` : label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            multiline ? styles.inputMulti : styles.inputSingle,
            keyboardType === "numeric" && styles.tabular,
            { color: theme.text },
          ]}
        />
      </View>

      {error ? (
        <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// A full-width outlined button with an icon; shows a spinner and its busy label while loading.
function ActionButton({
  label,
  loadingLabel,
  Icon,
  loading = false,
  onPress,
}: {
  label: string;
  loadingLabel?: string;
  Icon: PhosphorIcon;
  loading?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : label}
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: theme.background, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.muted} />
      ) : (
        <Icon size={20} color={theme.text} />
      )}
      <Text style={[styles.actionLabel, { color: theme.text }]}>
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}

// A label on the left and a value on the right, used inside a grouped block.
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

// An inset block (darker than the card) that holds a title and its fact rows.
function ResultBox({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.resultBox, { backgroundColor: theme.background, borderColor: theme.hairline }]}>
      <Text style={[styles.resultTitle, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function NewVehicleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addVehicle } = useVehicleHistory();

  const scrollRef = useRef<ScrollView>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [reg, setReg] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [colour, setColour] = useState("");
  const [mileage, setMileage] = useState("");
  const [engineSize, setEngineSize] = useState("");

  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const [motData, setMotData] = useState<any>(null);
  const [motLoading, setMotLoading] = useState(false);
  const [motError, setMotError] = useState<string | null>(null);

  const { fetchAIValuation, loading: aiLoading } = useAIValuation();
  const { fetchMarketScan, loading: marketLoading } = useMarketScan();

  const [aiData, setAiData] = useState<any>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);

  // Set once Save is pressed, so problems are not shown on a form nobody has touched yet.
  const [showProblem, setShowProblem] = useState(false);
  // Guards against a double tap creating the same vehicle twice.
  const saving = useRef(false);

  /* ============================================================
     Parsed form values (undefined = typed but not a number)
  ============================================================ */
  const buyN = parseAmount(buyPrice);
  const sellN = parseAmount(sellPrice);
  const mileageN = parseAmount(mileage);
  const yearN = parseAmount(year);
  const engineN = parseAmount(engineSize);

  const problemInfo: { field: ProblemField; message: string } | null = !title.trim()
    ? { field: "title", message: "Add a title for this vehicle." }
    : buyN === undefined
    ? { field: "buy", message: "Buy price must be a number, for example 1800." }
    : sellN === undefined
    ? { field: "sell", message: "Sell price must be a number, for example 2600." }
    : mileageN === undefined
    ? { field: "mileage", message: "Mileage must be a number, for example 82000." }
    : yearN === undefined
    ? { field: "year", message: "Year must be a number, for example 2014." }
    : engineN === undefined
    ? { field: "engine", message: "Engine size must be a number, for example 1.2." }
    : null;

  const problem = problemInfo?.message ?? null;

  // The message for one field, once Save has been pressed and that field is the first problem.
  const errorFor = (field: ProblemField) =>
    showProblem && problemInfo?.field === field ? problemInfo.message : null;

  /* ============================================================
     Profit Calculation
  ============================================================ */
  const profit = buyN != null && sellN != null ? sellN - buyN : null;
  const roi = profit != null && buyN != null && buyN > 0 ? (profit / buyN) * 100 : null;

  const signColor = (n: number | null) => {
    if (n == null) return theme.muted;
    const rounded = Math.round(n * 100) / 100;
    return rounded > 0 ? theme.success : rounded < 0 ? theme.danger : theme.text;
  };
  const profitColor = signColor(profit);

  const meterPercent =
    profit == null ? 0 : Math.max(0, Math.min(100, (profit / 2000) * 100));

  /* ============================================================
     Keyboard
     The form shrinks when the keyboard opens (iOS), so bring the
     field being edited up to the top of what is left. Android
     scrolls a focused field into view on its own.
  ============================================================ */
  const revealField: FocusHandler = (e) => {
    if (Platform.OS !== "ios") return;

    const field: any = e.currentTarget;
    const content = (scrollRef.current as any)?.getInnerViewRef?.();
    if (!field?.measureLayout || !content) return;

    setTimeout(() => {
      try {
        field.measureLayout(
          content,
          (_x: number, y: number) => {
            scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
          },
          () => {}
        );
      } catch {
        // If the field can't be measured it can still be scrolled to by hand.
      }
    }, 250);
  };

  /* ============================================================
     Image Picker
  ============================================================ */
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  /* ============================================================
     Delete Image
  ============================================================ */
  const deleteImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  /* ============================================================
     MOT Lookup (mock fields supported)
  ============================================================ */
  const lookupMOT = async () => {
    if (motLoading) return;

    // The DVLA and DVSA services want the plate without spaces.
    const lookupReg = normaliseReg(reg);
    if (!lookupReg) {
      setMotError("Enter a registration first.");
      return;
    }

    setReg(autoFormatReg(reg));
    setMotLoading(true);
    setMotError(null);

    const { data, error } = await fetchMOT(lookupReg);
    setMotLoading(false);

    if (!data) {
      setMotError(error);
      return;
    }

    setMotData(data);

    // Smart defaults
    setMake(data.make ?? "");
    setModel(data.model ?? "");
    setYear(data.year?.toString() ?? "");
    setColour(data.colour ?? "");
    setMileage(data.mileage?.toString() ?? "");

    // Auto title
    if (!title.trim()) {
      setTitle(`${data.make ?? ""} ${data.model ?? ""} ${data.year ?? ""}`.trim());
    }
  };

  /* ============================================================
     AI Valuation + Market Scan
  ============================================================ */
  const runAIValuation = async () => {
    if (aiLoading) return;
    if (!title.trim()) {
      setAiError("Add a title first so the AI knows what to value.");
      return;
    }
    setAiError(null);

    const ai = await fetchAIValuation({
      id: "temp",
      title,
      buyPrice: buyN ?? null,
      sellPrice: sellN ?? null,
      notes,
      images,
      barcode: "manual-entry",
      timestamp: Date.now().toString(),
    });

    if (!ai) {
      setAiError("Couldn't get an AI valuation right now. Try again in a moment.");
      return;
    }

    setAiData({
      aiPrice: {
        recommendedSellPrice: ai.recommendedSellPrice,
        riskLevel: ai.riskLevel,
      },
      aiPriceMin: ai.aiPriceMin,
      aiPriceMax: ai.aiPriceMax,
      aiPriceConfidence: ai.confidence,
      insights: ai.insights,
    });
  };

  const runMarketScan = async () => {
    if (marketLoading) return;
    if (!title.trim()) {
      setMarketError("Add a title first so we know what to search for.");
      return;
    }
    setMarketError(null);

    const market = await fetchMarketScan({
      title,
      buyPrice: buyN ?? null,
      sellPrice: sellN ?? null,
      notes,
      images,
    });

    if (!market) {
      setMarketError("Couldn't get market data right now. Try again in a moment.");
      return;
    }

    setMarketData({
      market: {
        googlePriceMin: market.googlePriceMin ?? null,
        googlePriceMax: market.googlePriceMax ?? null,
        lowest: market.lowest ?? null,
        highest: market.highest ?? null,
        average: market.average ?? null,
        smartPrice: market.smartPrice ?? null,
        soldCount: market.soldCount ?? null,
        demandScore: market.demandScore ?? null,
        aiPriceMin: market.aiPriceMin ?? null,
        aiPriceMax: market.aiPriceMax ?? null,
        aiPriceConfidence: market.aiPriceConfidence ?? null,
      },
    });
  };

  /* ============================================================
     Save Vehicle
  ============================================================ */
  const saveVehicle = () => {
    if (saving.current) return;

    if (problem) {
      setShowProblem(true);
      return;
    }

    saving.current = true;

    const mileageInt = mileageN != null ? Math.round(mileageN) : null;

    const newVehicle = addVehicle({
      title: title.trim(),
      mileage: mileageInt,
      engineSize: engineN ?? null,

      buyPrice: buyN ?? null,
      sellPrice: sellN ?? null,
      notes: notes || null,
      images: images.length > 0 ? images : null,

      favourite: false,
      barcode: "manual-entry",

      ...(aiData || {
        aiPrice: null,
        aiPriceMin: null,
        aiPriceMax: null,
        aiPriceConfidence: null,
        insights: null,
      }),

      ...(marketData || {
        market: null,
      }),

      // Form fields (reg/make/model/year/colour) take precedence over the
      // MOT lookup snapshot so manual edits made after a lookup aren't lost —
      // motData still supplies advisories/failures/motExpiry underneath.
      mot: {
        ...(motData || {}),
        reg: normaliseReg(reg) || null,
        make: make.trim() || null,
        model: model.trim() || null,
        year: yearN != null ? Math.round(yearN) : null,
        colour: colour.trim() || null,
        mileage: mileageInt,
      },
    });

    // replace, so Back does not return to the filled-in form and save it twice.
    router.replace(`/vehicles/details/${newVehicle.id}`);
  };

  /* ============================================================
     UI
  ============================================================ */
  const motColor = motData
    ? (() => {
        const c = getMotStatusColor(theme, motData.expiry ?? null);
        // Gold is kept for actions; a MOT that is due soon reads as a warning.
        return c === theme.accent ? theme.warning : c;
      })()
    : theme.muted;

  const motMakeModel = motData
    ? [motData.make, motData.model].filter(Boolean).join(" ") || "—"
    : "—";

  const rowError = (fields: ProblemField[]) =>
    fields.map((f) => errorFor(f)).find(Boolean) ?? null;

  const priceError = rowError(["buy", "sell"]);
  const specError = rowError(["year", "mileage", "engine"]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        {/* PAGE TITLE */}
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          New vehicle
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Fill it in by hand, or look up the registration to start you off.
        </Text>

        {/* VEHICLE DETAILS */}
        <Section title="Vehicle details">
          <FormInput
            label="Vehicle title"
            value={title}
            onChangeText={setTitle}
            placeholder="Ford Fiesta 2014"
            autoCapitalize="words"
            error={errorFor("title")}
            onFocus={revealField}
          />

          <View style={styles.stack}>
            <FormInput
              label="Registration"
              value={reg}
              onChangeText={(t) => setReg(autoFormatReg(t))}
              placeholder="AB12 CDE"
              autoCapitalize="characters"
              autoCorrect={false}
              onFocus={revealField}
            />

            <ActionButton
              label="Look up MOT"
              loadingLabel="Looking up..."
              Icon={MagnifyingGlass}
              loading={motLoading}
              onPress={lookupMOT}
            />

            {motError ? (
              <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
                {motError}
              </Text>
            ) : null}
          </View>

          {/* Make + Model */}
          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Make"
                value={make}
                onChangeText={setMake}
                placeholder="Ford"
                autoCapitalize="words"
                onFocus={revealField}
              />
            </View>

            <View style={styles.col}>
              <FormInput
                label="Model"
                value={model}
                onChangeText={setModel}
                placeholder="Fiesta"
                autoCapitalize="words"
                onFocus={revealField}
              />
            </View>
          </View>

          {/* Year + Colour, Mileage + Engine size */}
          <View style={styles.field}>
            <View style={styles.row}>
              <View style={styles.col}>
                <FormInput
                  label="Year"
                  value={year}
                  onChangeText={setYear}
                  placeholder="2014"
                  keyboardType="numeric"
                  invalid={errorFor("year") != null}
                  onFocus={revealField}
                />
              </View>

              <View style={styles.col}>
                <FormInput
                  label="Colour"
                  value={colour}
                  onChangeText={setColour}
                  placeholder="Blue"
                  autoCapitalize="words"
                  onFocus={revealField}
                />
              </View>
            </View>

            <View style={[styles.row, styles.rowGap]}>
              <View style={styles.col}>
                <FormInput
                  label="Mileage"
                  value={mileage}
                  onChangeText={setMileage}
                  placeholder="82000"
                  keyboardType="numeric"
                  invalid={errorFor("mileage") != null}
                  onFocus={revealField}
                />
              </View>

              <View style={styles.col}>
                <FormInput
                  label="Engine size"
                  value={engineSize}
                  onChangeText={setEngineSize}
                  placeholder="1.2"
                  invalid={errorFor("engine") != null}
                  onFocus={revealField}
                />
              </View>
            </View>

            {specError ? (
              <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
                {specError}
              </Text>
            ) : null}
          </View>
        </Section>

        {/* MOT SUMMARY */}
        {motData ? (
          <Section title="MOT summary">
            <View style={styles.statusRow}>
              <Text style={[styles.factLabel, { color: theme.muted }]}>Status</Text>
              <View style={[styles.statusPill, { backgroundColor: theme.background }]}>
                <Text style={[styles.statusText, { color: motColor }]}>
                  {motStatusLabel(motData.expiry)}
                </Text>
              </View>
            </View>

            <View
              style={[styles.factGroup, { backgroundColor: theme.background, borderColor: theme.hairline }]}
            >
              <FactRow label="Expiry" value={formatDate(motData.expiry)} />
              <FactRow
                label="Mileage"
                value={typeof motData.mileage === "number" ? formatMiles(motData.mileage) : "—"}
                divider
              />
              <FactRow label="Colour" value={motData.colour ?? "—"} divider />
              <FactRow label="Year" value={motData.year != null ? String(motData.year) : "—"} divider />
              <FactRow label="Make and model" value={motMakeModel} divider />
            </View>
          </Section>
        ) : null}

        {/* PRICING */}
        <Section title="Pricing">
          <View style={styles.field}>
            <View style={styles.row}>
              <View style={styles.col}>
                <FormInput
                  label="Buy price"
                  value={buyPrice}
                  onChangeText={setBuyPrice}
                  placeholder="1800"
                  keyboardType="numeric"
                  prefix="£"
                  invalid={errorFor("buy") != null}
                  onFocus={revealField}
                />
              </View>

              <View style={styles.col}>
                <FormInput
                  label="Sell price"
                  value={sellPrice}
                  onChangeText={setSellPrice}
                  placeholder="2600"
                  keyboardType="numeric"
                  prefix="£"
                  invalid={errorFor("sell") != null}
                  onFocus={revealField}
                />
              </View>
            </View>

            {priceError ? (
              <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
                {priceError}
              </Text>
            ) : null}
          </View>

          {/* LIVE PROFIT */}
          <View style={[styles.profitBox, { borderTopColor: theme.hairline }]}>
            <View style={styles.profitTop}>
              <Text style={[styles.label, { color: theme.muted }]}>Live profit</Text>

              {roi != null ? (
                <View style={[styles.roiPill, { backgroundColor: theme.background }]}>
                  <Text
                    style={[styles.roiText, { color: signColor(roi) }]}
                    accessibilityLabel={`Return on investment ${signedPercent(roi)}`}
                  >
                    ROI {signedPercent(roi)}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={[styles.profitValue, { color: profitColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              accessibilityLiveRegion="polite"
              accessibilityLabel={
                profit != null
                  ? `Estimated ${profit < 0 ? "loss" : "profit"} of ${formatMoney(Math.abs(profit))}`
                  : "Estimated profit not available yet"
              }
            >
              {profit != null ? signedMoney(profit) : "—"}
            </Text>

            <View style={[styles.meterTrack, { backgroundColor: theme.background }]}>
              <View
                style={[
                  styles.meterFill,
                  { width: `${meterPercent}%`, backgroundColor: theme.success },
                ]}
              />
            </View>

            {profit == null ? (
              <Text style={[styles.hint, { color: theme.muted }]}>
                Enter a buy price and a sell price to see your profit.
              </Text>
            ) : null}
          </View>
        </Section>

        {/* NOTES */}
        <Section title="Notes">
          <FormInput
            label="Anything worth remembering"
            value={notes}
            onChangeText={setNotes}
            placeholder="Clean runner, ideal first car..."
            multiline
            onFocus={revealField}
          />
        </Section>

        {/* PHOTOS */}
        <Section title="Photos">
          <ActionButton label="Add photo" Icon={Camera} onPress={pickImage} />

          {images.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.thumbRow}
            >
              {images.map((uri, idx) => (
                <View key={`${uri}-${idx}`} style={styles.thumbWrap}>
                  <Image
                    source={{ uri }}
                    style={[styles.thumb, { borderColor: theme.hairline }]}
                    resizeMode="cover"
                    accessibilityLabel={`Photo ${idx + 1} of ${images.length}`}
                  />

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${idx + 1}`}
                    hitSlop={8}
                    onPress={() => deleteImage(idx)}
                    style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                  >
                    <X size={14} weight="bold" color={theme.white} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyRow}>
              <View
                style={[styles.emptyIcon, { backgroundColor: theme.background, borderColor: theme.hairline }]}
              >
                <ImageSquare size={20} color={theme.muted} />
              </View>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                No photos yet. Photos you add are kept with this vehicle.
              </Text>
            </View>
          )}
        </Section>

        {/* PRICE CHECK */}
        <Section title="Price check" hint="Optional. Both checks search using the vehicle title.">
          <View style={styles.stack}>
            <ActionButton
              label="Run AI valuation"
              loadingLabel="Running..."
              Icon={Sparkle}
              loading={aiLoading}
              onPress={runAIValuation}
            />

            {aiError ? (
              <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
                {aiError}
              </Text>
            ) : null}

            {aiData ? (
              <ResultBox title="AI summary">
                <FactRow label="Recommended price" value={money(aiData.aiPrice?.recommendedSellPrice)} />
                <FactRow
                  label="Risk level"
                  value={aiData.aiPrice?.riskLevel ? capitalise(String(aiData.aiPrice.riskLevel)) : "—"}
                  divider
                />
                <FactRow
                  label="Confidence"
                  value={
                    aiData.aiPriceConfidence != null
                      ? `${Math.round(aiData.aiPriceConfidence)}%`
                      : "—"
                  }
                  divider
                />
              </ResultBox>
            ) : null}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <View style={styles.stack}>
            <ActionButton
              label="Run market scan"
              loadingLabel="Scanning..."
              Icon={ChartLineUp}
              loading={marketLoading}
              onPress={runMarketScan}
            />

            {marketError ? (
              <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
                {marketError}
              </Text>
            ) : null}

            {marketData ? (
              <ResultBox title="Market snapshot">
                <FactRow label="Smart price" value={money(marketData.market.smartPrice)} />
                <FactRow
                  label="Range"
                  value={`${money(marketData.market.lowest)} – ${money(marketData.market.highest)}`}
                  divider
                />
                <FactRow label="Average" value={money(marketData.market.average)} divider />
              </ResultBox>
            ) : null}
          </View>
        </Section>
      </ScrollView>

      {/* SAVE */}
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
        {showProblem && problem ? (
          <View style={styles.problemRow} accessibilityLiveRegion="polite">
            <WarningCircle size={16} color={theme.danger} />
            <Text style={[styles.problemText, { color: theme.danger }]}>{problem}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save vehicle"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={saveVehicle}
        >
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Save vehicle</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  /* PAGE TITLE */
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },

  /* SECTIONS */
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 24 },
  sectionHint: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  card: {
    alignSelf: "stretch",
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },

  /* FIELDS */
  field: { gap: 6, alignSelf: "stretch" },
  stack: { gap: 10, alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  rowGap: { marginTop: 10 },
  // Two equal columns. minWidth 0 lets a column shrink instead of pushing the card wider than the screen.
  col: { flex: 1, minWidth: 0 },
  label: { fontSize: 13, fontWeight: "600" },
  inputBox: {
    flexDirection: "row",
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputBoxSingle: { height: 48, alignItems: "center" },
  inputBoxMulti: { minHeight: 112, alignItems: "flex-start" },
  prefix: { fontSize: 16, marginRight: 6 },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontSize: 16,
  },
  inputSingle: { height: "100%" },
  inputMulti: {
    paddingVertical: 12,
    minHeight: 110,
    textAlignVertical: "top",
  },
  tabular: { fontVariant: ["tabular-nums"] },
  error: { fontSize: 13, lineHeight: 18 },
  hint: { fontSize: 13, lineHeight: 18 },

  /* BUTTONS */
  actionButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionLabel: { fontSize: 16, fontWeight: "600" },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.75 },

  /* MOT SUMMARY */
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontSize: 14, fontWeight: "700" },
  factGroup: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  factRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
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

  /* PROFIT */
  profitBox: { borderTopWidth: 1, paddingTop: 16, gap: 8 },
  profitTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  profitValue: { fontSize: 36, fontWeight: "700", fontVariant: ["tabular-nums"] },
  roiPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  roiText: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  meterTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 4 },

  /* PHOTOS */
  thumbRow: { gap: 12 },
  thumbWrap: { width: 112, height: 112 },
  thumb: { width: 112, height: 112, borderRadius: 12, borderWidth: 1 },
  removeButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { flex: 1, fontSize: 13, lineHeight: 18 },

  /* PRICE CHECK */
  divider: { height: 1 },
  resultBox: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  resultTitle: { fontSize: 16, fontWeight: "700", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },

  /* SAVE */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  problemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  problemText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
