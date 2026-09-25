import React, { useRef, useState } from "react";
import GoldFoil from "@/components/ui/GoldFoil";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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
  ImageSquare,
  Info,
  MagnifyingGlass,
  WarningCircle,
  X,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { fetchMOT } from "@/features/vehicles/api/mot";
import { sameReg } from "@/utils/motSnapshot";
import { keepPhoto } from "@/utils/keptPhotos";
import { formatDate } from "@/features/vehicles/utils/motDates";
import { formatMoney } from "@/features/vehicles/utils/vehicleStats";
import { FlipScoreInput, calculateFlipScore } from "@/utils/flipScoreEngine";
import { useTheme } from "@/styles/ThemeContext";

// "1,800" or "£1,800" -> 1800. Blank -> null; anything that is not a plain number -> undefined.
function parseAmount(text: string): number | null | undefined {
  const cleaned = text.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  return /^\d*\.?\d+$/.test(cleaned) ? Number(cleaned) : undefined;
}

const normaliseReg = (text: string) => text.replace(/\s+/g, "").toUpperCase();

// "+£800" or "-£200". A profit of exactly zero carries no sign.
const signedMoney = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}${formatMoney(Math.abs(n))}`;
const signedPercent = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toFixed(1)}%`;

// The focus callback a TextInput hands out, passed up so the screen can scroll the field into view.
type FocusHandler = NonNullable<TextInputProps["onFocus"]>;

type ProblemField =
  | "title"
  | "buy"
  | "sell"
  | "demand"
  | "year"
  | "mileage"
  | "keepers";

const RARITY_OPTIONS = ["Common", "Uncommon", "Rare", "Ultra Rare"];
const SELL_SPEED_OPTIONS = ["Slow", "Medium", "Fast"];
const CONDITION_OPTIONS = ["Poor", "Fair", "Good", "Excellent"];

export default function CreateNewFlip() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addVehicle } = useVehicleHistory();

  const scrollRef = useRef<ScrollView>(null);

  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */
  const [images, setImages] = useState<string[]>([]);
  const [registration, setRegistration] = useState("");

  const [motInfoRaw, setMotInfo] = useState<any>(null);
  // The lookup's details only count while the registration is still the one they were looked up for.
  const motInfo = motInfoRaw && sameReg(motInfoRaw.reg, registration) ? motInfoRaw : null;
  const [motLoading, setMotLoading] = useState(false);
  const [motError, setMotError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  const [rarity, setRarity] = useState<FlipScoreInput["rarity"]>("Common");
  const [sellSpeed, setSellSpeed] = useState<FlipScoreInput["sellSpeed"]>("Medium");
  const [condition, setCondition] = useState<FlipScoreInput["condition"]>("Good");
  const [demandScore, setDemandScore] = useState("");

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [colour, setColour] = useState("");
  const [keepers, setKeepers] = useState("");

  const [showBreakdown, setShowBreakdown] = useState(false);

  // Set once Save is pressed, so problems are not shown on a form nobody has touched yet.
  const [showProblem, setShowProblem] = useState(false);
  // Guards against a double tap creating the same flip twice.
  const saving = useRef(false);

  /* -------------------------------------------------------
     PARSED FORM VALUES (undefined = typed but not a number)
  ------------------------------------------------------- */
  const buyN = parseAmount(buyPrice);
  const sellN = parseAmount(sellPrice);
  const demandN = parseAmount(demandScore);
  const yearN = parseAmount(year);
  const mileageN = parseAmount(mileage);
  const keepersN = parseAmount(keepers);

  const problemInfo: { field: ProblemField; message: string } | null = !title.trim()
    ? { field: "title", message: "Add a title for this flip." }
    : buyN === undefined
    ? { field: "buy", message: "Buy price must be a number, for example 1800." }
    : sellN === undefined
    ? { field: "sell", message: "Sell price must be a number, for example 2600." }
    : demandN === undefined || (demandN != null && demandN > 100)
    ? { field: "demand", message: "Demand score must be a number from 0 to 100." }
    : yearN === undefined
    ? { field: "year", message: "Year must be a number, for example 2014." }
    : mileageN === undefined
    ? { field: "mileage", message: "Mileage must be a number, for example 82000." }
    : keepersN === undefined
    ? { field: "keepers", message: "Previous keepers must be a number." }
    : null;

  const problem = problemInfo?.message ?? null;

  // The message for one field, once Save has been pressed and that field is the first problem.
  const errorFor = (field: ProblemField) =>
    showProblem && problemInfo?.field === field ? problemInfo.message : null;

  /* -------------------------------------------------------
     FLIPSCORE (worked out from the current inputs, not a step behind)
  ------------------------------------------------------- */
  const liveScore =
    buyN != null && sellN != null
      ? calculateFlipScore({
          buyPrice: buyN,
          sellPrice: sellN,
          demandScore: demandN ?? 0,
          rarity,
          condition,
          sellSpeed,
        })
      : 0;

  /* -------------------------------------------------------
     LIVE PROFIT
  ------------------------------------------------------- */
  const profit = buyN != null && sellN != null ? sellN - buyN : null;
  const roi = profit != null && buyN != null && buyN > 0 ? (profit / buyN) * 100 : null;

  const signColor = (n: number | null) => {
    if (n == null) return theme.muted;
    const rounded = Math.round(n * 100) / 100;
    return rounded > 0 ? theme.success : rounded < 0 ? theme.danger : theme.text;
  };

  /* -------------------------------------------------------
     KEYBOARD
     The form shrinks when the keyboard opens (iOS), so bring the
     field being edited up to the top of what is left. Android
     scrolls a focused field into view on its own.
  ------------------------------------------------------- */
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

  /* -------------------------------------------------------
     IMAGE PICKER
  ------------------------------------------------------- */
  const pickImage = async () => {
    setPhotoError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (!result.canceled) {
        const kept = await keepPhoto(result.assets[0].uri, "vehicle-photo");
        setImages((prev) => [...prev, kept]);
      }
    } catch {
      setPhotoError("Couldn't open your photos. Check the app has access and try again.");
    }
  };

  const takePhoto = async () => {
    setPhotoError(null);
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) {
        const kept = await keepPhoto(result.assets[0].uri, "vehicle-photo");
        setImages((prev) => [...prev, kept]);
      }
    } catch {
      setPhotoError("Couldn't open the camera. Check the app has camera access and try again.");
    }
  };

  /* -------------------------------------------------------
     MOT LOOKUP
  ------------------------------------------------------- */
  const lookupMot = async () => {
    if (motLoading) return;

    // The DVLA and DVSA services want the plate without spaces.
    const lookupReg = normaliseReg(registration);
    if (!lookupReg) {
      setMotError("Enter a registration first.");
      return;
    }

    setMotLoading(true);
    setMotError(null);

    const { data, error } = await fetchMOT(lookupReg);
    setMotLoading(false);

    if (!data) {
      setMotError(error);
      return;
    }

    setMake(data.make ?? "");
    setModel(data.model ?? "");
    setYear(data.year != null ? String(data.year) : "");
    setMileage(data.mileage != null ? String(data.mileage) : "");
    setColour(data.colour ?? "");

    // The lookup does not return previous keepers, so whatever was typed is kept.
    setMotInfo({
      reg: lookupReg,
      motExpiry: data.motExpiry ?? "",
      advisories: data.advisories ?? [],
      failures: data.failures ?? [],
    });

    if (data.year && data.make && data.model) {
      setTitle(`${data.year} ${data.make} ${data.model}`);
    }
  };

  /* -------------------------------------------------------
     SAVE FLIP
  ------------------------------------------------------- */
  const handleSave = () => {
    if (saving.current) return;

    if (problem) {
      setShowProblem(true);
      return;
    }

    saving.current = true;

    const flipScore = liveScore;
    const mileageInt = mileageN != null ? Math.round(mileageN) : null;

    // Built from what is in the form, so edits made after a lookup are kept;
    // the lookup only supplies expiry, advisories and failures.
    const motPayload = {
      reg: normaliseReg(registration) || null,
      make: make.trim() || null,
      model: model.trim() || null,
      year: yearN != null ? Math.round(yearN) : null,
      colour: colour.trim() || null,
      keepers: keepersN != null ? Math.round(keepersN) : null,
      mileage: mileageInt,
      motExpiry: motInfo?.motExpiry || null,
      expiryDate: motInfo?.motExpiry || null,
      advisories: motInfo?.advisories ?? [],
      failures: motInfo?.failures ?? [],
      mileageHistory:
        mileageInt != null
          ? [{ date: new Date().toISOString(), mileage: mileageInt }]
          : [],
    };

    addVehicle({
      title: title.trim(),
      buyPrice: buyN ?? null,
      sellPrice: sellN ?? null,
      flipScore,
      rarity,
      sellSpeed,
      ai: {
        condition,
        description: null,
      },
      market: {
        demandScore: demandN ?? 0,
      },
      favourite: false,
      images,
      mot: motPayload,
      proTips: null,
    });

    // replace, so Back does not return to the filled-in form and save it twice.
    router.replace("/vehicles/list");
  };

  /* -------------------------------------------------------
     BREAKDOWN BUILDER
  ------------------------------------------------------- */
  const getBreakdown = ({
    buyPrice,
    sellPrice,
    demandScore,
    rarity,
    condition,
    sellSpeed,
  }: {
    buyPrice: string;
    sellPrice: string;
    demandScore: string;
    rarity: string;
    condition: string;
    sellSpeed: string;
  }) => {
    const buy = parseAmount(buyPrice) ?? 0;
    const sell = parseAmount(sellPrice) ?? 0;
    const profit = sell - buy;
    const profitMargin = buy > 0 ? ((sell - buy) / buy) * 100 : 0;

    return {
      profit,
      profitMargin,
      demandScore: parseAmount(demandScore) ?? 0,
      rarity,
      condition,
      sellSpeed,
    };
  };

  const hasScore = buyN != null && sellN != null;
  const scoreColor =
    liveScore > 75 ? theme.success : liveScore > 50 ? theme.warning : theme.danger;
  const scoreBand = liveScore > 75 ? "Strong" : liveScore > 50 ? "Fair" : "Weak";
  const scorePercent = Math.max(0, Math.min(100, liveScore));

  const rowError = (fields: ProblemField[]) =>
    fields.map((f) => errorFor(f)).find(Boolean) ?? null;

  const specError = rowError(["year", "mileage", "keepers"]);
  const priceError = rowError(["buy", "sell"]);

  const breakdown = getBreakdown({
    buyPrice,
    sellPrice,
    demandScore,
    rarity,
    condition,
    sellSpeed,
  });

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */
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
          Add a flip
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Add a vehicle, your prices and how you expect it to sell.
        </Text>

        {/* PHOTOS */}
        <Section title="Photos">
          <View style={styles.row}>
            <View style={styles.col}>
              <ActionButton label="Pick photo" Icon={ImageSquare} onPress={pickImage} />
            </View>
            <View style={styles.col}>
              <ActionButton label="Take photo" Icon={Camera} onPress={takePhoto} />
            </View>
          </View>

          {photoError ? (
            <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
              {photoError}
            </Text>
          ) : null}

          {images.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.thumbRow}
            >
              {images.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  style={[styles.thumb, { borderColor: theme.hairline }]}
                  resizeMode="cover"
                  accessibilityLabel={`Photo ${i + 1} of ${images.length}`}
                />
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
                No photos yet. Pick one from your library or take one now.
              </Text>
            </View>
          )}
        </Section>

        {/* VEHICLE DETAILS */}
        <Section title="Vehicle details">
          <View style={styles.stack}>
            <FormInput
              label="Registration (optional)"
              value={registration}
              onChangeText={setRegistration}
              autoCapitalize="characters"
              autoCorrect={false}
              onFocus={revealField}
            />

            <ActionButton
              label="Look up MOT data"
              loadingLabel="Looking up..."
              Icon={MagnifyingGlass}
              loading={motLoading}
              onPress={lookupMot}
            />

            {motError ? (
              <Text style={[styles.error, { color: theme.danger }]} accessibilityLiveRegion="polite">
                {motError}
              </Text>
            ) : null}
          </View>

          <FormInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="2014 Ford Fiesta"
            autoCapitalize="words"
            error={errorFor("title")}
            onFocus={revealField}
          />

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

          {/* Year + Colour, Mileage + Previous keepers */}
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
                  label="Previous keepers"
                  value={keepers}
                  onChangeText={setKeepers}
                  placeholder="2"
                  keyboardType="numeric"
                  invalid={errorFor("keepers") != null}
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
        {motInfo ? (
          <Section title="MOT summary">
            <View
              style={[styles.factGroup, { backgroundColor: theme.background, borderColor: theme.hairline }]}
            >
              <FactRow
                label="Expiry"
                value={motInfo.motExpiry ? formatDate(motInfo.motExpiry) : "N/A"}
              />
              <FactRow label="Advisories" value={String(motInfo.advisories?.length ?? 0)} divider />
              <FactRow label="Failures" value={String(motInfo.failures?.length ?? 0)} divider />
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
                <View style={[styles.pill, { backgroundColor: theme.background }]}>
                  <Text
                    style={[styles.pillText, { color: signColor(roi) }]}
                    accessibilityLabel={`Return on investment ${signedPercent(roi)}`}
                  >
                    ROI {signedPercent(roi)}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={[styles.profitValue, { color: signColor(profit) }]}
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

            {profit == null ? (
              <Text style={[styles.hint, { color: theme.muted }]}>
                Enter a buy price and a sell price to see your profit.
              </Text>
            ) : null}
          </View>
        </Section>

        {/* HOW IT SHOULD SELL */}
        <Section title="How it should sell">
          <ChipGroup
            label="Rarity"
            value={rarity}
            options={RARITY_OPTIONS}
            onSelect={(v) => setRarity(v as FlipScoreInput["rarity"])}
          />

          <ChipGroup
            label="Sell speed"
            value={sellSpeed}
            options={SELL_SPEED_OPTIONS}
            onSelect={(v) => setSellSpeed(v as FlipScoreInput["sellSpeed"])}
          />

          <ChipGroup
            label="Condition"
            value={condition}
            options={CONDITION_OPTIONS}
            onSelect={(v) => setCondition(v as FlipScoreInput["condition"])}
          />

          <FormInput
            label="Demand score (0–100)"
            value={demandScore}
            onChangeText={setDemandScore}
            placeholder="0–100"
            keyboardType="numeric"
            error={errorFor("demand")}
            onFocus={revealField}
          />
        </Section>

        {/* FLIPSCORE */}
        <Section title="FlipScore">
          <View
            accessible
            accessibilityLabel={
              hasScore ? `FlipScore ${liveScore} out of 100, ${scoreBand}` : "FlipScore not available yet"
            }
            style={styles.scoreBlock}
          >
            <View style={styles.profitTop}>
              <View style={styles.scoreNumberRow}>
                <Text style={[styles.scoreValue, { color: theme.text }]}>
                  {hasScore ? liveScore : "—"}
                </Text>
                <Text style={[styles.scoreMax, { color: theme.muted }]}>/ 100</Text>
              </View>

              {hasScore ? (
                <Text style={[styles.scoreBand, { color: scoreColor }]}>{scoreBand}</Text>
              ) : null}
            </View>

            <View style={[styles.meterTrack, { backgroundColor: theme.background }]}>
              <View
                style={[
                  styles.meterFill,
                  { width: `${hasScore ? scorePercent : 0}%`, backgroundColor: scoreColor },
                ]}
              />
            </View>
          </View>

          {!hasScore ? (
            <Text style={[styles.hint, { color: theme.muted }]}>
              Enter a buy price and a sell price to see a score.
            </Text>
          ) : null}

          <ActionButton
            label="View score breakdown"
            Icon={Info}
            onPress={() => setShowBreakdown(true)}
          />
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
          accessibilityLabel="Save flip"
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold, overflow: "hidden" },
            pressed && styles.pressed,
          ]}
          onPress={handleSave}
        >
          <GoldFoil />
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Save flip</Text>
        </Pressable>
      </View>

      {/* SCORE BREAKDOWN */}
      <Modal
        visible={showBreakdown}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBreakdown(false)}
      >
        <View style={styles.modalBackdrop}>
          {/* Tapping outside the sheet closes it (onRequestClose only covers Android's back button). */}
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close breakdown"
            onPress={() => setShowBreakdown(false)}
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

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]} accessibilityRole="header">
                FlipScore breakdown
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close breakdown"
                hitSlop={8}
                style={({ pressed }) => [styles.sheetClose, pressed && styles.pressed]}
                onPress={() => setShowBreakdown(false)}
              >
                <X size={22} color={theme.muted} />
              </Pressable>
            </View>

            <View
              style={[styles.factGroup, { backgroundColor: theme.background, borderColor: theme.hairline }]}
            >
              <FactRow
                label="Profit"
                value={signedMoney(breakdown.profit)}
                valueColor={signColor(breakdown.profit)}
              />
              <FactRow label="Profit margin" value={signedPercent(breakdown.profitMargin)} divider />
              <FactRow label="Demand score" value={`${breakdown.demandScore}/100`} divider />
              <FactRow label="Rarity" value={breakdown.rarity} divider />
              <FactRow label="Condition" value={breakdown.condition} divider />
              <FactRow label="Sell speed" value={breakdown.sellSpeed} divider />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* -------------------------------------------------------
   REUSABLE COMPONENTS
------------------------------------------------------- */

// A titled group of fields: an 18/700 heading over a hairline card.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        {children}
      </View>
    </View>
  );
}

// A label over a 48pt input, with the error (if any) directly underneath.
// "invalid" only outlines the box, for fields whose message is shown under their row.
// "hint" adds an info toggle beside the label that shows a line of explanation.
function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  prefix,
  hint,
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
  prefix?: string;
  hint?: string;
  error?: string | null;
  invalid?: boolean;
  onFocus?: FocusHandler;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const borderColor = error || invalid ? theme.danger : focused ? theme.gold : theme.hairline;

  return (
    <View style={styles.field}>
      {hint ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}. ${showHint ? "Hide" : "Show"} explanation`}
          hitSlop={{ top: 8, bottom: 8 }}
          onPress={() => setShowHint((prev) => !prev)}
          style={({ pressed }) => [styles.labelRow, pressed && styles.pressed]}
        >
          <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
          <Info size={16} color={theme.muted} />
        </Pressable>
      ) : (
        <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      )}

      {hint && showHint ? (
        <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text>
      ) : null}

      <View style={[styles.inputBox, { backgroundColor: theme.background, borderColor }]}>
        {prefix ? <Text style={[styles.prefix, { color: theme.muted }]}>{prefix}</Text> : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          accessibilityLabel={prefix === "£" ? `${label} in pounds` : label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
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

// A row of single-choice chips. The selected one is the only gold element in the group.
function ChipGroup({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>

      <View style={styles.chipRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = value === option;

          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={option}
              accessibilityState={{ checked: selected }}
              onPress={() => onSelect(option)}
              style={({ pressed }) => [
                styles.chip,
                selected
                  ? { backgroundColor: theme.goldTint, borderColor: theme.gold }
                  : { backgroundColor: theme.background, borderColor: theme.hairline },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selected
                    ? { color: theme.gold, fontWeight: "700" }
                    : { color: theme.text, fontWeight: "600" },
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// An outlined button with an icon; shows a spinner and its busy label while loading.
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
      <Text style={[styles.actionLabel, { color: theme.text }]} numberOfLines={1}>
        {loading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}

// A label on the left and a value on the right, used inside a grouped block.
function FactRow({
  label,
  value,
  valueColor,
  divider,
}: {
  label: string;
  value: string;
  valueColor?: string;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.factRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <Text style={[styles.factLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: valueColor ?? theme.text }]}>{value}</Text>
    </View>
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
  labelRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  inputBox: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  prefix: { fontSize: 16, marginRight: 6 },
  input: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    padding: 0,
    fontSize: 16,
  },
  tabular: { fontVariant: ["tabular-nums"] },
  error: { fontSize: 13, lineHeight: 18 },
  hint: { fontSize: 13, lineHeight: 18 },

  /* CHIPS */
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 15 },

  /* BUTTONS */
  actionButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionLabel: { flexShrink: 1, fontSize: 16, fontWeight: "600" },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.75 },

  /* PHOTOS */
  thumbRow: { gap: 12 },
  thumb: { width: 96, height: 96, borderRadius: 12, borderWidth: 1 },
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

  /* MOT SUMMARY AND ROWS OF FACTS */
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

  /* PROFIT, VALUATION AND SCORE */
  profitBox: { borderTopWidth: 1, paddingTop: 16, gap: 8 },
  profitTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  profitValue: { fontSize: 36, fontWeight: "700", fontVariant: ["tabular-nums"] },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  meterTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 5 },
  scoreBlock: { gap: 12 },
  scoreNumberRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  scoreValue: { fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"] },
  scoreMax: { fontSize: 16, fontVariant: ["tabular-nums"] },
  scoreBand: { fontSize: 14, fontWeight: "700" },

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

  /* BREAKDOWN SHEET */
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
    gap: 12,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
    marginBottom: 4,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  sheetClose: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
  },
});
