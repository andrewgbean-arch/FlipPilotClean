import React, { useState } from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";

import ValuationEngine from "@/components/ai/ValuationEngine";
import BreakdownModal from "@/components/core/BreakdownModal";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { fetchMOT } from "@/features/vehicles/api/mot";
import { calculateFlipScore, FlipScoreInput } from "@/utils/flipScoreEngine";
import { computeAiPrice } from "@/features/ai/priceengine";

import { useTheme } from "@/styles/useTheme";
import { Theme } from "@/styles/theme";
import { styles } from "@/styles/styles";

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

/* -------------------------------------------------------
   ROUTE
------------------------------------------------------- */

export default function EditFlipRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { vehicles, updateVehicle, loaded } = useVehicleHistory();
  const router = useRouter();
  const theme = useTheme();

  const vehicleId = Array.isArray(id) ? id[0] : id;
  const flip = vehicles.find((v) => v.id === vehicleId);

  if (!flip) {
    // Flips load from storage after the first render, so only call it missing once they have.
    if (!loaded) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.goldDeep} />
        </View>
      );
    }

    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text
          style={{
            color: theme.white,
            fontSize: 20,
            fontWeight: "700",
            marginBottom: 8,
          }}
        >
          Flip not found
        </Text>
        <Text style={{ color: theme.muted, textAlign: "center", marginBottom: 20 }}>
          It may have been deleted.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/vehicles/list")}
          style={{
            backgroundColor: theme.goldDeep,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: theme.radius.md,
          }}
        >
          <Text style={{ color: theme.black, fontWeight: "700" }}>
            Back to your flips
          </Text>
        </TouchableOpacity>
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
  /* -------------------------------------------------------
       STATE
    ------------------------------------------------------- */
  const [title, setTitle] = useState(flip.title ?? "");
  const [buyPrice, setBuyPrice] = useState(String(flip.buyPrice ?? ""));
  const [sellPrice, setSellPrice] = useState(String(flip.sellPrice ?? ""));
  const [aiPriceConfidence, setAiPriceConfidence] = useState(
    String(flip.aiPrice?.confidence ?? 0)
  );

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
  const [motInfo, setMotInfo] = useState(flip.mot ?? null);

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
  const confidenceN = parseAmount(aiPriceConfidence);
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
        aiPriceConfidence: confidenceN ?? undefined,
      })
    : flip.flipScore ?? 0;

  /* -------------------------------------------------------
       VALUATION ENGINE DATA
    ------------------------------------------------------- */
  const flipScore = liveScore;
  const marketHeat = demandN ?? 0;

  const listing = {
    id: flip.id,
    price: sellN || buyN || 0,
    mileage: mileageN ?? 0,
    year,
    condition,
    make,
    engineSize: engineN ?? 0,
  };

  /* -------------------------------------------------------
       VALIDATION
    ------------------------------------------------------- */
  // Prices are optional (an MOT-checked or unsold vehicle has none), but if typed
  // they must be numbers.
  const problem = !title.trim()
    ? "Add a title for this flip."
    : buyN === undefined
    ? "Buy price must be a number, for example 1800."
    : sellN === undefined
    ? "Sell price must be a number, for example 2600."
    : mileageN === undefined
    ? "Mileage must be a number, for example 82000."
    : keepersN === undefined
    ? "Keepers must be a number."
    : engineN === undefined
    ? "Engine size must be a number, for example 1242."
    : confidenceN === undefined || (confidenceN != null && confidenceN > 100)
    ? "AI price confidence must be a number from 0 to 100."
    : demandN === undefined || (demandN != null && demandN > 100)
    ? "Demand score must be a number from 0 to 100."
    : null;

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

    const data = await fetchMOT(lookupReg);
    setMotLoading(false);

    if (!data) {
      setMotError(
        "Couldn't look up that registration. Check the number and your connection, then try again."
      );
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
      ...flip.mot,
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
        flip.mot?.mileageHistory ??
        (mileageInt != null
          ? [{ date: new Date().toISOString(), mileage: mileageInt }]
          : []),
    };

    const aiPrice = computeAiPrice({
      ...flip,
      title,
      buyPrice: buyN ?? null,
      sellPrice: sellN ?? null,
      flipScore,
      rarity,
      sellSpeed,
      ai: { condition, description },
      market: { demandScore: demandN ?? 0 },
      images,
      mot: motPayload,
    });

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
      aiPrice: {
        recommendedSellPrice: aiPrice.recommendedSellPrice,
        riskLevel: aiPrice.riskLevel,
        confidence: confidenceN ?? 0,
        notes: aiPrice.notes,
      },
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
      aiPriceConfidence: confidenceN ?? 0,
    };
  };

  /* -------------------------------------------------------
       UI
    ------------------------------------------------------- */
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.heading, { color: theme.goldDeep }]}>
          Edit Flip
        </Text>
        <Text style={{ color: theme.muted, marginBottom: 10 }}>
          Added: {new Date(flip.timestamp).toLocaleDateString()}
        </Text>
        {dirty && (
          <Text style={{ color: theme.goldDeep, marginBottom: 10 }}>
            You have unsaved changes
          </Text>
        )}

        {/* IMAGE PICKER */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <ButtonSmall label="Pick Image" icon="image" onPress={pickImage} theme={theme} />
          <ButtonSmall label="Take Photo" icon="camera" onPress={takePhoto} theme={theme} />
        </View>

        {photoError && (
          <Text style={{ color: theme.danger, marginBottom: 20 }}>{photoError}</Text>
        )}

        {images.length > 0 && (
          <ScrollView horizontal style={{ marginBottom: 20 }}>
            {images.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: theme.radius.md,
                  marginRight: 10,
                }}
              />
            ))}
          </ScrollView>
        )}

        <Input
          label="Registration"
          value={registration}
          onChangeText={(t) => {
            setDirty(true);
            setRegistration(t.toUpperCase().trim());
          }}
          theme={theme}
        />

        <ButtonSmall
          label={motLoading ? "Looking up..." : "Refresh MOT data"}
          icon="refresh-cw"
          onPress={lookupMot}
          theme={theme}
        />

        {motError && (
          <Text style={{ color: theme.danger, marginBottom: 20 }}>{motError}</Text>
        )}

        {motInfo && <MotSummary mot={motInfo} theme={theme} />}

        <Input
          label="Make"
          value={make}
          onChangeText={(t) => {
            setDirty(true);
            syncTitle({ make: t });
            setMake(t);
          }}
          theme={theme}
        />

        <Input
          label="Model"
          value={model}
          onChangeText={(t) => {
            setDirty(true);
            syncTitle({ model: t });
            setModel(t);
          }}
          theme={theme}
        />

        <Input
          label="Mileage"
          value={mileage}
          onChangeText={(v) => {
            setDirty(true);
            setMileage(v);
          }}
          keyboardType="numeric"
          theme={theme}
        />

        <Input
          label="Colour"
          value={colour}
          onChangeText={(t) => {
            setDirty(true);
            setColour(t);
          }}
          theme={theme}
        />

        <Input
          label="Keepers"
          value={keepers}
          onChangeText={(v) => {
            setDirty(true);
            setKeepers(v);
          }}
          keyboardType="numeric"
          theme={theme}
        />

        <Input
          label="Engine Size (cc)"
          value={engineSize}
          onChangeText={(v) => {
            setDirty(true);
            setEngineSize(v);
          }}
          keyboardType="numeric"
          theme={theme}
        />

        <Input
          label="Title"
          value={title}
          onChangeText={(t) => {
            setDirty(true);
            setTitle(t);
          }}
          theme={theme}
        />

        <Input
          label="Buy Price (£)"
          value={buyPrice}
          onChangeText={(t) => {
            setDirty(true);
            setBuyPrice(t);
            setScoreEdited(true);
          }}
          keyboardType="numeric"
          theme={theme}
        />

        <Input
          label="Sell Price (£)"
          value={sellPrice}
          onChangeText={(t) => {
            setDirty(true);
            setSellPrice(t);
            setScoreEdited(true);
          }}
          keyboardType="numeric"
          theme={theme}
        />

        <Text style={{ color: theme.goldDeep, marginBottom: 10 }}>
          Profit Preview: £{Math.round(((sellN ?? 0) - (buyN ?? 0)) * 100) / 100}
        </Text>

        {/* 🔥 LIVE MARKET VALUATION PREVIEW */}
        <ValuationEngine
          key={listing.id}
          listing={listing}
          prediction={{ flipScore, marketHeat }}
        />

        <Tooltip
          label="AI Price Confidence (0–100)"
          hint="Higher confidence means AI believes the price estimate is accurate."
          value={aiPriceConfidence}
          onChangeText={(t) => {
            setDirty(true);
            setAiPriceConfidence(t);
            setScoreEdited(true);
          }}
          theme={theme}
        />

        <Dropdown
          label="Rarity"
          value={rarity}
          onSelect={(v) => {
            setDirty(true);
            setRarity(v as any);
            setScoreEdited(true);
          }}
          options={[
            { label: "Common", icon: "📦" },
            { label: "Uncommon", icon: "✨" },
            { label: "Rare", icon: "💎" },
            { label: "Ultra Rare", icon: "👑" },
          ]}
          theme={theme}
        />

        <Dropdown
          label="Sell Speed"
          value={sellSpeed}
          onSelect={(v) => {
            setDirty(true);
            setSellSpeed(v as any);
            setScoreEdited(true);
          }}
          options={[
            { label: "Slow", icon: "🐌" },
            { label: "Medium", icon: "🚶‍♂️" },
            { label: "Fast", icon: "⚡" },
          ]}
          theme={theme}
        />

        <Dropdown
          label="Condition"
          value={condition}
          onSelect={(v) => {
            setDirty(true);
            setCondition(v as any);
            setScoreEdited(true);
          }}
          options={[
            { label: "Poor", icon: "💔" },
            { label: "Fair", icon: "🛠️" },
            { label: "Good", icon: "👍" },
            { label: "Excellent", icon: "🌟" },
          ]}
          theme={theme}
        />

        <Input
          label="Demand Score (0–100)"
          value={demandScore}
          onChangeText={(t) => {
            setDirty(true);
            setDemandScore(t);
            setScoreEdited(true);
          }}
          keyboardType="numeric"
          theme={theme}
        />

        {/* FLIP SCORE */}
        <FlipScoreBar
          score={liveScore}
          theme={theme}
          onPress={() => setShowBreakdown(true)}
        />

        {problem && (
          <Text style={{ color: theme.danger, textAlign: "center", marginBottom: 10 }}>
            {problem}
          </Text>
        )}

        <TouchableOpacity
          disabled={!isValid}
          onPress={handleSave}
          style={[
            styles.button,
            {
              backgroundColor: isValid ? theme.goldDeep : theme.muted,
              borderRadius: theme.radius.md,
              opacity: isValid ? 1 : 0.6,
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.black }]}>
            Save Changes
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {showBreakdown && (
        <BreakdownModal
          theme={theme}
          breakdown={getBreakdown()}
          onClose={() => setShowBreakdown(false)}
        />
      )}
    </View>
  );
}

/* -------------------------------------------------------
   COMPONENTS
------------------------------------------------------- */

function ButtonSmall({
  label,
  onPress,
  theme,
  icon,
}: {
  label: string;
  onPress: () => void;
  theme: Theme;
  icon?: keyof typeof Feather.glyphMap;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: theme.card,
        padding: 12,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        marginBottom: 20,
      }}
    >
      {icon && <Feather name={icon} size={16} color={theme.goldDeep} />}
      <Text style={{ color: theme.white, textAlign: "center", fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

interface InputProps {
  label: string;
  theme: Theme;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "numeric";
}

function Input({ label, theme, ...props }: InputProps) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: theme.muted, marginBottom: 6 }}>{label}</Text>
      <TextInput
        {...props}
        style={{
          backgroundColor: theme.card,
          color: theme.white,
          padding: 12,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
        placeholderTextColor={theme.muted}
      />
    </View>
  );
}

function Dropdown({
  label,
  value,
  onSelect,
  options,
  theme,
}: {
  label: string;
  value: string;
  onSelect: (v: string) => void;
  options: { label: string; icon?: string }[];
  theme: Theme;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: theme.muted, marginBottom: 6 }}>{label}</Text>

      {options.map((opt) => (
        <TouchableOpacity
          key={opt.label}
          onPress={() => onSelect(opt.label)}
          style={{
            padding: 12,
            backgroundColor:
              value === opt.label ? theme.goldSoftGlow : theme.card,
            borderRadius: theme.radius.md,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 18 }}>{opt.icon}</Text>
          <Text style={{ color: theme.white, fontSize: 16 }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Tooltip({
  label,
  hint,
  value,
  onChangeText,
  theme,
}: {
  label: string;
  hint: string;
  value: string;
  onChangeText: (t: string) => void;
  theme: Theme;
}) {
  const [showHint, setShowHint] = useState(false);

  return (
    <View style={{ marginBottom: 20 }}>
      <TouchableOpacity onPress={() => setShowHint(!showHint)}>
        <Text style={{ color: theme.muted, marginBottom: 6 }}>
          {label} <Text style={{ color: theme.goldDeep }}>ⓘ</Text>
        </Text>
      </TouchableOpacity>

      {showHint && (
        <Text style={{ color: theme.goldDeep, marginBottom: 6 }}>{hint}</Text>
      )}

      <TextInput
        value={value}
        onChangeText={(t: string) => onChangeText(t)}
        keyboardType="numeric"
        style={{
          backgroundColor: theme.card,
          color: theme.white,
          padding: 12,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
        placeholderTextColor={theme.muted}
      />
    </View>
  );
}

function FlipScoreBar({
  score,
  theme,
  onPress,
}: {
  score: number;
  theme: Theme;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        marginTop: 10,
        marginBottom: 20,
        padding: 16,
        backgroundColor: theme.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        shadowColor: theme.goldDeep,
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Text
        style={{
          color: theme.white,
          fontSize: 18,
          fontWeight: "600",
          marginBottom: 10,
        }}
      >
        Flip Score: {score}/100
      </Text>

      <View
        style={{
          height: 12,
          backgroundColor: theme.muted,
          borderRadius: theme.radius.full,
          overflow: "hidden",
          flexDirection: "row",
        }}
      >
        <View
          style={{
            flex: Math.max(0, Math.min(100, score)),
            backgroundColor:
              score > 75
                ? theme.goldDeep
                : score > 50
                ? "#FFD966"
                : "#FF6666",
          }}
        />
        <View
          style={{
            flex: 100 - Math.max(0, Math.min(100, score)),
          }}
        />
      </View>

      <TouchableOpacity
        onPress={onPress}
        style={{
          marginTop: 12,
          paddingVertical: 10,
          backgroundColor: theme.card,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
      >
        <Text
          style={{
            color: theme.goldDeep,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          View Score Breakdown
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function MotSummary({
  mot,
  theme,
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
  theme: Theme;
}) {
  return (
    <View
      style={{
        marginBottom: 20,
        padding: 12,
        backgroundColor: theme.card,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
      }}
    >
      <Text style={{ color: theme.goldDeep, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 }}>
        MOT SUMMARY
      </Text>

      <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap" }}>
        {[
          { label: "Registration", value: mot.reg },
          { label: "Make", value: mot.make },
          { label: "Model", value: mot.model },
          { label: "Year", value: mot.year },
          { label: "Colour", value: mot.colour },
          { label: "Keepers", value: mot.keepers },
          { label: "Mileage", value: mot.mileage != null ? `${mot.mileage} mi` : null },
          { label: "MOT Status", value: mot.motStatus },
          { label: "Tax Status", value: mot.taxStatus },
          { label: "Expiry", value: mot.motExpiry },
        ].map((field) => (
          <View key={field.label} style={{ width: "50%", marginBottom: 12 }}>
            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>
              {field.label.toUpperCase()}
            </Text>
            <Text style={{ color: theme.white, fontSize: 15, fontWeight: "600", marginTop: 2 }}>
              {field.value ?? "—"}
            </Text>
          </View>
        ))}
      </View>

      {mot.advisories?.length ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: theme.goldDeep, fontWeight: "600" }}>
            Advisories:
          </Text>

          {mot.advisories.map((adv, idx) => (
            <Text key={idx} style={{ color: theme.muted }}>
              • {adv}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
