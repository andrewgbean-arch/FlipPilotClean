import React, { useState } from "react";

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowsClockwise,
  Camera,
  ClipboardText,
  ImageSquare,
  Info,
  Package,
  PencilSimple,
  WarningCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { fetchMOT } from "@/features/vehicles/api/mot";
import { sameReg } from "@/utils/motSnapshot";
import { calculateFlipScore, FlipScoreInput } from "@/utils/flipScoreEngine";

import { useTheme } from "@/styles/useTheme";
import { Theme } from "@/styles/theme";

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

// "1,800" or "£1,800" -> 1800. Blank -> null; anything that is not a plain number -> undefined.
function parseAmount(text: string): number | null | undefined {
  const cleaned = text.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  return /^\d*\.?\d+$/.test(cleaned) ? Number(cleaned) : undefined;
}

const normaliseReg = (text: string) => text.replace(/\s+/g, "").toUpperCase();

const autoTitle = (year: number | string, make: string, model: string) =>
  year && make && model ? `${year} ${make} ${model}` : "";

// An MOT stays valid through the end of its expiry day.
function motStatusFor(expiry: string | null | undefined) {
  if (!expiry) return "Unknown";
  const end = new Date(`${expiry.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(end.getTime())) return "Unknown";
  return end.getTime() >= Date.now() ? "Valid" : "Expired";
}

// "+£12.50" or "-£3.20". A profit of exactly zero carries no sign.
const signedMoney = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}£${Math.abs(n).toFixed(2)}`;
const signedPercent = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n).toFixed(1)}%`;
const withCommas = (n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// "2026-10-14" (or a full ISO string) -> "14 Oct 2026". Anything unreadable is shown as it came.
function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

const RARITY_OPTIONS = ["Common", "Uncommon", "Rare", "Ultra Rare"];
const SELL_SPEED_OPTIONS = ["Slow", "Medium", "Fast"];
const CONDITION_OPTIONS = ["Poor", "Fair", "Good", "Excellent"];

/* -------------------------------------------------------
   ROUTE
------------------------------------------------------- */

export default function EditFlipRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { vehicles, updateVehicle, loaded, loadError } = useVehicleHistory();
  const router = useRouter();
  const theme = useTheme();

  const vehicleId = Array.isArray(id) ? id[0] : id;
  const flip = vehicles.find((v) => v.id === vehicleId);

  if (!flip) {
    // Flips load from storage after the first render, so only call it missing once they have.
    if (!loaded) {
      return (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.muted} />
          <Text style={[styles.stateLoading, { color: theme.muted }]}>Loading your flip</Text>
        </View>
      );
    }

    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
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
          {loadError ?? "It may have been deleted."}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to your flips"
          onPress={() => router.replace("/vehicles/list")}
          style={({ pressed }) => [
            styles.stateButton,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Back to your flips</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <EditFlipForm
      flip={flip}
      updateVehicle={updateVehicle}
      router={router}
      theme={theme}
    />
  );
}

function EditFlipForm({
  flip,
  updateVehicle,
  router,
  theme,
}: {
  flip: FlipRecord;
  updateVehicle: (id: string, data: Partial<FlipRecord>) => void;
  router: ReturnType<typeof useRouter>;
  theme: Theme;
}) {
  const insets = useSafeAreaInsets();

  /* -------------------------------------------------------
       STATE
    ------------------------------------------------------- */
  const [title, setTitle] = useState(flip.title ?? "");
  const [buyPrice, setBuyPrice] = useState(String(flip.buyPrice ?? ""));
  const [sellPrice, setSellPrice] = useState(String(flip.sellPrice ?? ""));

  const [rarity, setRarity] = useState<FlipScoreInput["rarity"]>(
    (flip.rarity as any) ?? "Common"
  );
  const [sellSpeed, setSellSpeed] = useState<FlipScoreInput["sellSpeed"]>(
    (flip.sellSpeed as any) ?? "Medium"
  );
  const [condition, setCondition] = useState<FlipScoreInput["condition"]>(
    (flip.ai?.condition as any) ?? "Good"
  );

  const [description, setDescription] = useState(flip.ai?.description ?? "");
  const [demandScore, setDemandScore] = useState(
    String(flip.market?.demandScore ?? 0)
  );

  const [registration, setRegistration] = useState(flip.mot?.reg ?? "");
  const [motInfoRaw, setMotInfo] = useState(flip.mot ?? null);
  // The MOT details belong to one plate: once the registration is changed they no longer describe this car.
  const motInfo = motInfoRaw && sameReg(motInfoRaw.reg, registration) ? motInfoRaw : null;

  const [make, setMake] = useState(flip.mot?.make ?? "");
  const [model, setModel] = useState(flip.mot?.model ?? "");
  const [year, setYear] = useState<number | string>(flip.mot?.year ?? "");

  const [colour, setColour] = useState(flip.mot?.colour ?? "");
  const [keepers, setKeepers] = useState(String(flip.mot?.keepers ?? ""));
  const [mileage, setMileage] = useState(String(flip.mot?.mileage ?? ""));

  const [engineSize, setEngineSize] = useState(String(flip.engineSize ?? ""));

  const [images, setImages] = useState<string[]>(flip.images ?? []);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Until a score input is touched, the score shown is the one already saved with the flip.
  const [scoreEdited, setScoreEdited] = useState(false);

  const [motLoading, setMotLoading] = useState(false);
  const [motError, setMotError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  /* -------------------------------------------------------
       PARSED FORM VALUES (undefined = typed but not a number)
    ------------------------------------------------------- */
  const buyN = parseAmount(buyPrice);
  const sellN = parseAmount(sellPrice);
  const mileageN = parseAmount(mileage);
  const keepersN = parseAmount(keepers);
  const engineN = parseAmount(engineSize);
  const demandN = parseAmount(demandScore);

  /* -------------------------------------------------------
       AUTO TITLE (YEAR + MAKE + MODEL)
    ------------------------------------------------------- */
  // Keeps the title in step with year/make/model, but only while it is still the
  // auto-generated one, so a title the user wrote themselves is never overwritten.
  const syncTitle = (next: {
    year?: number | string;
    make?: string;
    model?: string;
  }) => {
    const before = autoTitle(year, make, model);
    const after = autoTitle(
      next.year ?? year,
      next.make ?? make,
      next.model ?? model
    );
    if (after && (!title.trim() || title === before)) setTitle(after);
  };

  /* -------------------------------------------------------
       FLIPSCORE (worked out from the current inputs, not a step behind)
    ------------------------------------------------------- */
  const liveScore = scoreEdited
    ? calculateFlipScore({
        buyPrice: buyN ?? 0,
        sellPrice: sellN ?? 0,
        demandScore: demandN ?? 0,
        rarity,
        condition,
        sellSpeed,
      })
    : flip.flipScore ?? 0;

  const flipScore = liveScore;

  /* -------------------------------------------------------
       VALIDATION
    ------------------------------------------------------- */
  // Prices are optional (an MOT-checked or unsold vehicle has none), but if typed
  // they must be numbers.
  const errors = {
    title: !title.trim() ? "Add a title for this flip." : null,
    buy: buyN === undefined ? "Buy price must be a number, for example 1800." : null,
    sell: sellN === undefined ? "Sell price must be a number, for example 2600." : null,
    mileage:
      mileageN === undefined ? "Mileage must be a number, for example 82000." : null,
    keepers: keepersN === undefined ? "Keepers must be a number." : null,
    engine:
      engineN === undefined ? "Engine size must be a number, for example 1242." : null,
    demand:
      demandN === undefined || (demandN != null && demandN > 100)
        ? "Demand score must be a number from 0 to 100."
        : null,
  };

  // The first problem in form order, shown beside Save.
  const problem =
    errors.title ??
    errors.buy ??
    errors.sell ??
    errors.mileage ??
    errors.keepers ??
    errors.engine ??
    errors.demand ??
    null;

  const isValid = problem === null;

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
        setDirty(true);
        setImages((prev) => [...prev, result.assets[0].uri]);
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
        setDirty(true);
        setImages((prev) => [...prev, result.assets[0].uri]);
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

    setDirty(true);

    setRegistration(lookupReg);
    setMake(data.make ?? "");
    setModel(data.model ?? "");
    setYear(data.year ?? "");
    setMileage(data.mileage != null ? String(data.mileage) : "");
    setColour(data.colour ?? "");
    // The lookup does not return previous keepers, so whatever was typed is kept.

    setMotInfo({
      ...flip.mot,
      reg: lookupReg,
      make: data.make ?? null,
      model: data.model ?? null,
      year: data.year ?? null,
      colour: data.colour ?? null,
      mileage: data.mileage ?? null,
      motStatus: motStatusFor(data.motExpiry),
      motExpiry: data.motExpiry ?? null,
      expiryDate: data.motExpiry ?? null,
      taxStatus: data.taxStatus ?? null,
      advisories: data.advisories ?? [],
      failures: data.failures ?? [],
    });

    syncTitle({
      year: data.year ?? "",
      make: data.make ?? "",
      model: data.model ?? "",
    });
  };

  /* -------------------------------------------------------
       SAVE
    ------------------------------------------------------- */
  const handleSave = () => {
    if (!isValid) return;

    const flipScore = liveScore;
    const mileageInt = mileageN != null ? Math.round(mileageN) : null;

    // Built from the form, so every field the user can edit is what gets saved.
    // motInfo only supplies what the form has no field for (expiry, tax, advisories).
    const motPayload = {
      // Anything else saved from the old plate's lookup is dropped if the plate was changed.
      ...(sameReg(flip.mot?.reg, registration) ? flip.mot : {}),
      reg: normaliseReg(registration) || null,
      make: make.trim() || null,
      model: model.trim() || null,
      colour: colour.trim() || null,
      keepers: keepersN != null ? Math.round(keepersN) : null,
      year: Number(year) || null,
      mileage: mileageInt,
      motStatus: motInfo?.motStatus ?? null,
      taxStatus: motInfo?.taxStatus ?? null,
      motExpiry: motInfo?.motExpiry ?? null,
      expiryDate: motInfo?.expiryDate ?? motInfo?.motExpiry ?? null,
      advisories: motInfo?.advisories ?? [],
      failures: motInfo?.failures ?? [],
      mileageHistory:
        (sameReg(flip.mot?.reg, registration) ? flip.mot?.mileageHistory : null) ??
        (mileageInt != null
          ? [{ date: new Date().toISOString(), mileage: mileageInt }]
          : []),
    };

    updateVehicle(flip.id, {
      title: title.trim(),
      buyPrice: buyN ?? null,
      sellPrice: sellN ?? null,
      engineSize: engineN ?? null,
      flipScore,
      rarity,
      sellSpeed,
      ai: { condition, description },
      market: { demandScore: demandN ?? 0 },
      images,
      mot: motPayload,
    });

    // Back to wherever the edit was opened from, not a second copy of the list.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/vehicles/details/${flip.id}`);
    }
  };

  /* -------------------------------------------------------
       BREAKDOWN BUILDER
    ------------------------------------------------------- */
  const getBreakdown = () => {
    const buy = buyN ?? 0;
    const sell = sellN ?? 0;

    return {
      profit: sell - buy,
      profitMargin: buy > 0 ? ((sell - buy) / buy) * 100 : 0,
      demandScore: demandN ?? 0,
      rarity,
      condition,
      sellSpeed,
    };
  };

  const profitPreview = Math.round(((sellN ?? 0) - (buyN ?? 0)) * 100) / 100;
  const previewColor =
    profitPreview > 0 ? theme.success : profitPreview < 0 ? theme.danger : theme.text;

  /* -------------------------------------------------------
       UI
    ------------------------------------------------------- */
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* TITLE */}
        <Text style={[styles.pageTitle, { color: theme.text }]} accessibilityRole="header">
          Edit flip
        </Text>
        <Text style={[styles.pageSub, { color: theme.muted }]}>
          Added {new Date(flip.timestamp).toLocaleDateString()}
        </Text>

        {dirty ? (
          <View
            style={[styles.notice, { backgroundColor: theme.card, borderColor: theme.hairline }]}
            accessibilityLiveRegion="polite"
          >
            <PencilSimple size={18} color={theme.muted} />
            <Text style={[styles.noticeText, { color: theme.text }]}>
              You have unsaved changes
            </Text>
          </View>
        ) : null}

        {/* VEHICLE */}
        <SectionTitle>Vehicle</SectionTitle>
        <Card>
          <View style={styles.stack}>
            <View>
              <Input
                label="Registration"
                value={registration}
                onChangeText={(t) => {
                  setDirty(true);
                  setRegistration(t.toUpperCase().trim());
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <FieldError text={motError} />
            </View>

            <View>
              <ActionButton
                label={motLoading ? "Looking up..." : "Refresh MOT data"}
                Icon={ArrowsClockwise}
                onPress={lookupMot}
                loading={motLoading}
              />
              <Text style={[styles.caption, { color: theme.muted }]}>
                Replaces the make, model, colour and mileage with the latest lookup.
              </Text>
            </View>

            <PairRow>
              <Input
                style={styles.col}
                label="Make"
                value={make}
                onChangeText={(t) => {
                  setDirty(true);
                  syncTitle({ make: t });
                  setMake(t);
                }}
              />
              <Input
                style={styles.col}
                label="Model"
                value={model}
                onChangeText={(t) => {
                  setDirty(true);
                  syncTitle({ model: t });
                  setModel(t);
                }}
              />
            </PairRow>

            <PairRow errors={[errors.mileage]}>
              <Input
                style={styles.col}
                label="Mileage"
                value={mileage}
                onChangeText={(v) => {
                  setDirty(true);
                  setMileage(v);
                }}
                keyboardType="numeric"
                invalid={!!errors.mileage}
              />
              <Input
                style={styles.col}
                label="Colour"
                value={colour}
                onChangeText={(t) => {
                  setDirty(true);
                  setColour(t);
                }}
              />
            </PairRow>

            <PairRow errors={[errors.keepers, errors.engine]}>
              <Input
                style={styles.col}
                label="Keepers"
                value={keepers}
                onChangeText={(v) => {
                  setDirty(true);
                  setKeepers(v);
                }}
                keyboardType="numeric"
                invalid={!!errors.keepers}
              />
              <Input
                style={styles.col}
                label="Engine size (cc)"
                value={engineSize}
                onChangeText={(v) => {
                  setDirty(true);
                  setEngineSize(v);
                }}
                keyboardType="numeric"
                invalid={!!errors.engine}
              />
            </PairRow>

            <View>
              <Input
                label="Title"
                value={title}
                onChangeText={(t) => {
                  setDirty(true);
                  setTitle(t);
                }}
                invalid={!!errors.title}
              />
              <FieldError text={errors.title} />
            </View>
          </View>
        </Card>

        {/* MOT */}
        <SectionTitle>MOT</SectionTitle>
        {motInfo ? (
          <MotSummary mot={motInfo} />
        ) : (
          <Card>
            <View style={styles.miniEmpty}>
              <View
                style={[
                  styles.miniEmptyIcon,
                  { backgroundColor: theme.background, borderColor: theme.hairline },
                ]}
              >
                <ClipboardText size={22} color={theme.muted} />
              </View>
              <Text style={[styles.miniEmptyTitle, { color: theme.text }]}>
                No MOT details yet
              </Text>
              <Text style={[styles.miniEmptyBody, { color: theme.muted }]}>
                Enter a registration above and tap Refresh MOT data to fetch the MOT and tax
                status.
              </Text>
            </View>
          </Card>
        )}

        {/* PRICING */}
        <SectionTitle>Pricing</SectionTitle>
        <Card>
          <View style={styles.stack}>
            <PairRow errors={[errors.buy, errors.sell]}>
              <Input
                style={styles.col}
                label="Buy price (£)"
                value={buyPrice}
                onChangeText={(t) => {
                  setDirty(true);
                  setBuyPrice(t);
                  setScoreEdited(true);
                }}
                keyboardType="numeric"
                invalid={!!errors.buy}
              />
              <Input
                style={styles.col}
                label="Sell price (£)"
                value={sellPrice}
                onChangeText={(t) => {
                  setDirty(true);
                  setSellPrice(t);
                  setScoreEdited(true);
                }}
                keyboardType="numeric"
                invalid={!!errors.sell}
              />
            </PairRow>

            <View
              accessible
              accessibilityLabel={`Profit preview, ${signedMoney(profitPreview)}`}
              style={[styles.previewRow, { borderTopColor: theme.hairline }]}
            >
              <Text style={[styles.previewLabel, { color: theme.muted }]}>Profit preview</Text>
              <Text
                style={[styles.previewValue, { color: previewColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {signedMoney(profitPreview)}
              </Text>
            </View>
          </View>
        </Card>

        {/* CONDITION AND SCORING */}
        <SectionTitle>Condition and scoring</SectionTitle>
        <Card>
          <View style={styles.stack}>
            <ChoiceGroup
              label="Rarity"
              value={rarity}
              onSelect={(v) => {
                setDirty(true);
                setRarity(v as FlipScoreInput["rarity"]);
                setScoreEdited(true);
              }}
              options={RARITY_OPTIONS}
            />

            <ChoiceGroup
              label="Sell speed"
              value={sellSpeed}
              onSelect={(v) => {
                setDirty(true);
                setSellSpeed(v as FlipScoreInput["sellSpeed"]);
                setScoreEdited(true);
              }}
              options={SELL_SPEED_OPTIONS}
            />

            <ChoiceGroup
              label="Condition"
              value={condition}
              onSelect={(v) => {
                setDirty(true);
                setCondition(v as FlipScoreInput["condition"]);
                setScoreEdited(true);
              }}
              options={CONDITION_OPTIONS}
            />

            <View>
              <Input
                label="Demand score (0–100)"
                value={demandScore}
                onChangeText={(t) => {
                  setDirty(true);
                  setDemandScore(t);
                  setScoreEdited(true);
                }}
                keyboardType="numeric"
                invalid={!!errors.demand}
              />
              <FieldError text={errors.demand} />
            </View>
          </View>
        </Card>

        <FlipScoreCard score={liveScore} onPress={() => setShowBreakdown(true)} />

        {/* PHOTOS */}
        <SectionTitle>Photos</SectionTitle>
        <Card>
          <View style={styles.stack}>
            <View>
              <View style={styles.pairRow}>
                <ActionButton
                  style={styles.col}
                  label="Pick image"
                  Icon={ImageSquare}
                  onPress={pickImage}
                />
                <ActionButton
                  style={styles.col}
                  label="Take photo"
                  Icon={Camera}
                  onPress={takePhoto}
                />
              </View>
              <FieldError text={photoError} />
            </View>

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
                    accessibilityLabel={`Photo ${i + 1} of ${images.length}`}
                    style={[styles.thumb, { backgroundColor: theme.background }]}
                  />
                ))}
              </ScrollView>
            ) : (
              <Text style={[styles.caption, { color: theme.muted, marginTop: 0 }]}>
                No photos yet.
              </Text>
            )}
          </View>
        </Card>
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
        {problem ? (
          <View style={styles.problemRow} accessibilityLiveRegion="polite">
            <WarningCircle size={16} weight="fill" color={theme.danger} />
            <Text style={[styles.problemText, { color: theme.danger }]}>{problem}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          accessibilityState={{ disabled: !isValid }}
          disabled={!isValid}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.gold, opacity: isValid ? 1 : 0.4 },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Save changes</Text>
        </Pressable>
      </View>

      {showBreakdown && (
        <BreakdownSheet breakdown={getBreakdown()} onClose={() => setShowBreakdown(false)} />
      )}
    </KeyboardAvoidingView>
  );
}

/* -------------------------------------------------------
   COMPONENTS
------------------------------------------------------- */

function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }, style]}>
      {children}
    </View>
  );
}

// A validation or lookup message, shown in red directly under its field.
function FieldError({ text }: { text: string | null }) {
  const theme = useTheme();
  if (!text) return null;

  return (
    <Text style={[styles.fieldError, { color: theme.danger }]} accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

// Two fields side by side. Their messages sit under the row, each in full width.
function PairRow({
  children,
  errors,
}: {
  children: React.ReactNode;
  errors?: (string | null)[];
}) {
  return (
    <View>
      <View style={styles.pairRow}>{children}</View>
      {errors?.map((message, i) => (
        <FieldError key={i} text={message} />
      ))}
    </View>
  );
}

// A secondary (outlined) button used for the lookup and photo actions.
function ActionButton({
  label,
  Icon,
  onPress,
  loading,
  style,
}: {
  label: string;
  Icon: PhosphorIcon;
  onPress: () => void;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!loading, disabled: !!loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        { backgroundColor: theme.background, borderColor: theme.hairline },
        style,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.text} />
      ) : (
        <Icon size={18} color={theme.text} />
      )}
      <Text style={[styles.secondaryLabel, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  // Outlines the field in red; the message itself is shown by FieldError.
  invalid?: boolean;
  style?: StyleProp<ViewStyle>;
}

// The bare text box, shared by Input and Tooltip.
function TextField({
  label,
  invalid,
  ...props
}: Omit<InputProps, "style"> & { label: string }) {
  const theme = useTheme();

  return (
    <TextInput
      {...props}
      accessibilityLabel={label}
      placeholderTextColor={theme.muted}
      selectionColor={theme.gold}
      style={[
        styles.input,
        {
          backgroundColor: theme.background,
          color: theme.text,
          borderColor: invalid ? theme.danger : theme.hairline,
        },
      ]}
    />
  );
}

function Input({ label, style, ...props }: InputProps) {
  const theme = useTheme();

  return (
    <View style={style}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <TextField label={label} {...props} />
    </View>
  );
}

// One choice out of a short list, shown as tappable options.
function ChoiceGroup({
  label,
  value,
  onSelect,
  options,
}: {
  label: string;
  value: string;
  onSelect: (v: string) => void;
  options: string[];
}) {
  const theme = useTheme();
  // Three options share one row; four sit two by two so every label fits a small phone.
  const basis = options.length === 3 ? "30%" : "45%";

  return (
    <View>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>

      <View style={styles.choiceWrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((opt) => {
          const active = value === opt;

          return (
            <Pressable
              key={opt}
              accessibilityRole="radio"
              accessibilityLabel={opt}
              accessibilityState={{ checked: active, selected: active }}
              onPress={() => onSelect(opt)}
              style={({ pressed }) => [
                styles.choice,
                {
                  flexBasis: basis,
                  backgroundColor: active ? theme.goldTint : theme.background,
                  borderColor: active ? theme.gold : theme.hairline,
                },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.choiceText, { color: active ? theme.gold : theme.text }]}
                numberOfLines={1}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// The FlipScore for the current inputs, with a way into the full breakdown.
function FlipScoreCard({ score, onPress }: { score: number; onPress: () => void }) {
  const theme = useTheme();

  const scoreColor = score >= 70 ? theme.success : score >= 40 ? theme.warning : theme.danger;
  const band = score >= 70 ? "Strong" : score >= 40 ? "Fair" : "Weak";
  const percent = Math.max(0, Math.min(100, Number(score) || 0));

  return (
    <Card style={styles.gapTop}>
      <View accessible accessibilityLabel={`FlipScore ${score} out of 100, ${band}`}>
        <View style={styles.scoreTop}>
          <Text style={[styles.scoreLabel, { color: theme.muted }]}>FlipScore</Text>
          <Text style={[styles.scoreBand, { color: scoreColor }]}>{band}</Text>
        </View>

        <View style={styles.scoreNumberRow}>
          <Text style={[styles.scoreValue, { color: theme.text }]}>{score}</Text>
          <Text style={[styles.scoreMax, { color: theme.muted }]}>/ 100</Text>
        </View>

        <View style={[styles.meterTrack, { backgroundColor: theme.background }]}>
          <View
            style={[styles.meterFill, { width: `${percent}%`, backgroundColor: scoreColor }]}
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View score breakdown"
        onPress={onPress}
        style={({ pressed }) => [
          styles.secondaryButton,
          styles.breakdownButton,
          { backgroundColor: theme.background, borderColor: theme.hairline },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>View score breakdown</Text>
      </Pressable>
    </Card>
  );
}

// A label on the left and a value on the right, used inside a grouped card.
function DataRow({
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
      style={[styles.dataRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <Text style={[styles.dataLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: valueColor ?? theme.text }]}>{value}</Text>
    </View>
  );
}

function MotSummary({
  mot,
}: {
  mot: {
    reg?: string | null;
    make?: string | null;
    model?: string | null;
    year?: string | number | null;
    colour?: string | null;
    keepers?: number | null;
    mileage?: number | null;
    motStatus?: string | null;
    taxStatus?: string | null;
    motExpiry?: string | null;
    advisories?: string[] | null;
  };
}) {
  const theme = useTheme();

  const statusColor =
    mot.motStatus === "Valid"
      ? theme.success
      : mot.motStatus === "Expired"
      ? theme.danger
      : theme.text;

  const rows: { label: string; value: string | null; color?: string }[] = [
    { label: "MOT status", value: mot.motStatus ?? null, color: statusColor },
    { label: "MOT expiry", value: formatDate(mot.motExpiry) },
    { label: "Tax status", value: mot.taxStatus ?? null },
    { label: "Mileage", value: mot.mileage != null ? `${withCommas(mot.mileage)} mi` : null },
    { label: "Registration", value: mot.reg ?? null },
    { label: "Make", value: mot.make ?? null },
    { label: "Model", value: mot.model ?? null },
    { label: "Year", value: mot.year != null ? String(mot.year) : null },
    { label: "Colour", value: mot.colour ?? null },
    { label: "Keepers", value: mot.keepers != null ? String(mot.keepers) : null },
  ];

  return (
    <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      {rows.map((row, i) => (
        <DataRow
          key={row.label}
          label={row.label}
          value={row.value || "—"}
          valueColor={row.value ? row.color : theme.muted}
          divider={i > 0}
        />
      ))}

      {mot.advisories?.length ? (
        <View style={[styles.advisoryBlock, { borderTopColor: theme.hairline }]}>
          <Text style={[styles.blockLabel, { color: theme.muted }]}>
            Advisories ({mot.advisories.length})
          </Text>

          {mot.advisories.map((adv, idx) => (
            <View key={idx} style={styles.advisoryRow}>
              <View style={[styles.bullet, { backgroundColor: theme.muted }]} />
              <Text style={[styles.advisoryText, { color: theme.text }]}>{adv}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// The score's inputs laid out as rows, in a sheet that slides up from the bottom.
function BreakdownSheet({
  breakdown,
  onClose,
}: {
  breakdown: {
    profit: number;
    profitMargin: number;
    demandScore: number;
    rarity: string;
    condition: string;
    sellSpeed: string;
  };
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const gainColor = (n: number) => (n > 0 ? theme.success : n < 0 ? theme.danger : theme.text);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tapping outside the sheet closes it (onRequestClose only covers Android's back button). */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close score breakdown"
          onPress={onClose}
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

          <Text style={[styles.sheetTitle, { color: theme.text }]} accessibilityRole="header">
            Score breakdown
          </Text>

          <View
            style={[
              styles.group,
              styles.sheetGroup,
              { backgroundColor: theme.background, borderColor: theme.hairline },
            ]}
          >
            <DataRow
              label="Profit"
              value={signedMoney(breakdown.profit)}
              valueColor={gainColor(breakdown.profit)}
            />
            <DataRow
              label="Margin"
              value={signedPercent(breakdown.profitMargin)}
              valueColor={gainColor(breakdown.profitMargin)}
              divider
            />
            <DataRow label="Demand score" value={`${breakdown.demandScore}/100`} divider />
            <DataRow label="Rarity" value={breakdown.rarity} divider />
            <DataRow label="Condition" value={breakdown.condition} divider />
            <DataRow label="Sell speed" value={breakdown.sellSpeed} divider />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [
              styles.secondaryButton,
              styles.sheetClose,
              { backgroundColor: theme.background, borderColor: theme.hairline },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.secondaryLabel, { color: theme.text }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------
   STYLES
------------------------------------------------------- */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
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
  pageTitle: { fontSize: 28, fontWeight: "700" },
  pageSub: { fontSize: 14, marginTop: 4 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  noticeText: { flexShrink: 1, fontSize: 14, fontWeight: "500" },

  /* SECTIONS AND CARDS */
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  gapTop: { marginTop: 12 },
  stack: { gap: 16 },

  /* FIELDS */
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontSize: 16,
  },
  pairRow: { flexDirection: "row", gap: 12 },
  col: { flex: 1, minWidth: 0 },
  fieldError: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  caption: { fontSize: 13, lineHeight: 18, marginTop: 8 },

  /* CHOICES */
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    flexGrow: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceText: { fontSize: 15, fontWeight: "600" },

  /* BUTTONS */
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryLabel: { fontSize: 15, fontWeight: "600" },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },

  /* PRICING */
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  previewLabel: { fontSize: 14 },
  previewValue: {
    flexShrink: 1,
    fontSize: 24,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  /* FLIP SCORE */
  scoreTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreLabel: { fontSize: 13 },
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
  breakdownButton: { marginTop: 16 },

  /* MOT SUMMARY */
  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  dataRow: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dataLabel: { fontSize: 14 },
  dataValue: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  advisoryBlock: {
    padding: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  blockLabel: { fontSize: 13, fontWeight: "600" },
  advisoryRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  advisoryText: { flex: 1, fontSize: 14, lineHeight: 21 },

  /* EMPTY MOT */
  miniEmpty: { alignItems: "center", paddingVertical: 8 },
  miniEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  miniEmptyTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  miniEmptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 4 },

  /* PHOTOS */
  thumbRow: { gap: 10 },
  thumb: { width: 80, height: 80, borderRadius: 12 },

  /* SAVE */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  problemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
  },
  problemText: { flex: 1, fontSize: 13, lineHeight: 18 },

  /* BREAKDOWN SHEET */
  backdrop: {
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
  sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  sheetGroup: { marginBottom: 16 },
  sheetClose: { marginTop: 0 },

  pressed: { opacity: 0.7 },
});
