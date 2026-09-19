import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { computeAiPrice } from "@/features/ai/priceengine";
import ValuationEngine from "@/components/ai/ValuationEngine";








import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { fetchMOT } from "@/features/vehicles/api/mot";
import { FlipScoreInput, calculateFlipScore } from "@/utils/flipScoreEngine";


import { useTheme } from "../../../src/styles/ThemeContext";

import { Theme } from "@/styles/theme";

// "1,800" or "£1,800" -> 1800. Blank -> null; anything that is not a plain number -> undefined.
function parseAmount(text: string): number | null | undefined {
  const cleaned = text.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  return /^\d*\.?\d+$/.test(cleaned) ? Number(cleaned) : undefined;
}

const normaliseReg = (text: string) => text.replace(/\s+/g, "").toUpperCase();

export default function CreateNewFlip() {
  const theme = useTheme();
  const router = useRouter();
  const { addVehicle } = useVehicleHistory();

  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */
  const [images, setImages] = useState<string[]>([]);
  const [registration, setRegistration] = useState("");

  const [motInfo, setMotInfo] = useState<any>(null);
  const [motLoading, setMotLoading] = useState(false);
  const [motError, setMotError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [aiPriceConfidence, setAiPriceConfidence] = useState("");

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
  const confidenceN = parseAmount(aiPriceConfidence);
  const demandN = parseAmount(demandScore);
  const yearN = parseAmount(year);
  const mileageN = parseAmount(mileage);
  const keepersN = parseAmount(keepers);

  const problem = !title.trim()
    ? "Add a title for this flip."
    : buyN === undefined
    ? "Buy price must be a number, for example 1800."
    : sellN === undefined
    ? "Sell price must be a number, for example 2600."
    : confidenceN === undefined || (confidenceN != null && confidenceN > 100)
    ? "AI price confidence must be a number from 0 to 100."
    : demandN === undefined || (demandN != null && demandN > 100)
    ? "Demand score must be a number from 0 to 100."
    : yearN === undefined
    ? "Year must be a number, for example 2014."
    : mileageN === undefined
    ? "Mileage must be a number, for example 82000."
    : keepersN === undefined
    ? "Previous keepers must be a number."
    : null;

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
          aiPriceConfidence: confidenceN ?? undefined,
        })
      : 0;

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

    setMake(data.make ?? "");
    setModel(data.model ?? "");
    setYear(data.year != null ? String(data.year) : "");
    setMileage(data.mileage != null ? String(data.mileage) : "");
    setColour(data.colour ?? "");

    // The lookup does not return previous keepers, so whatever was typed is kept.
    setMotInfo({
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

    const aiPrice = computeAiPrice({
      title,
      buyPrice: buyN ?? null,
      sellPrice: sellN ?? null,
      flipScore,
      rarity,
      sellSpeed,
      ai: { condition, description: null },
      market: { demandScore: demandN ?? 0 },
      favourite: false,
      images,
      mot: motPayload,
      id: "",
      timestamp: "",
      proTips: null,
    });

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
      aiPrice: {
        recommendedSellPrice: aiPrice.recommendedSellPrice,
        riskLevel: aiPrice.riskLevel,
        confidence: confidenceN ?? 0,
        notes: aiPrice.notes,
      },
    });

    // replace, so Back does not return to the filled-in form and save it twice.
    router.replace("/vehicles/list");
  };
    /* -------------------------------------------------------
     BREAKDOWN BUILDER (Fix for TS error)
  ------------------------------------------------------- */
  const getBreakdown = ({
    buyPrice,
    sellPrice,
    demandScore,
    rarity,
    condition,
    sellSpeed,
    aiPriceConfidence,
  }: {
    buyPrice: string;
    sellPrice: string;
    demandScore: string;
    rarity: string;
    condition: string;
    sellSpeed: string;
    aiPriceConfidence: string;
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
      aiPriceConfidence: parseAmount(aiPriceConfidence) ?? 0,
    };
  };


  /* -------------------------------------------------------
    /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */
return (
  <View style={{ flex: 1, backgroundColor: theme.background }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 180, // ⭐ space for Save button
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.heading, { color: theme.goldDeep }]}>
        Add New Flip
      </Text>

      {/* IMAGES */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        <GoldButton label="Pick Image" onPress={pickImage} theme={theme} />
        <GoldButton label="Take Photo" onPress={takePhoto} theme={theme} />
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
                borderWidth: 2,
                borderColor: theme.goldSoftGlow,
              }}
            />
          ))}
        </ScrollView>
      )}

      {/* REG + MOT */}
      <Input
        label="Registration (optional)"
        value={registration}
        onChangeText={setRegistration}
        theme={theme}
      />

      <GoldButton
        label={motLoading ? "Looking up..." : "Lookup MOT data"}
        onPress={lookupMot}
        theme={theme}
      />

      {motError && (
        <Text style={{ color: theme.danger, marginTop: 10 }}>{motError}</Text>
      )}

      <MotSummary
        theme={theme}
        make={make}
        model={model}
        year={year}
        mileage={mileage}
        keepers={keepers}
        colour={colour}
        motInfo={motInfo}
        setMake={setMake}
        setModel={setModel}
        setYear={setYear}
        setMileage={setMileage}
        setKeepers={setKeepers}
        setColour={setColour}
      />

      {/* 🔥 LIVE MARKET VALUATION PREVIEW */}
      <ValuationEngine
        key={"new"}
        listing={{
          price: sellN ?? buyN ?? 0,
          mileage: mileageN ?? 0,
          year: yearN ?? 0,
          condition,
          make,
        }}
        prediction={{
          flipScore: liveScore,
          marketHeat: demandN ?? 50,
        }}
      />

      {/* PRICES */}
      <Input
        label="Title"
        value={title}
        onChangeText={setTitle}
        theme={theme}
      />

      <Input
        label="Buy Price (£)"
        value={buyPrice}
        onChangeText={setBuyPrice}
        keyboardType="numeric"
        theme={theme}
      />

      <Input
        label="Sell Price (£)"
        value={sellPrice}
        onChangeText={setSellPrice}
        keyboardType="numeric"
        theme={theme}
      />

      <Tooltip
        label="AI Price Confidence (0–100)"
        hint="Higher confidence means AI believes the price estimate is accurate."
        value={aiPriceConfidence}
        onChangeText={setAiPriceConfidence}
        theme={theme}
      />
        {/* DROPDOWNS */}
        <Dropdown label="Rarity" value={rarity} onSelect={(v) => setRarity(v as any)} theme={theme}
          options={[
            { label: "Common", icon: "📦" },
            { label: "Uncommon", icon: "✨" },
            { label: "Rare", icon: "💎" },
            { label: "Ultra Rare", icon: "👑" },
          ]}
        />

        <Dropdown label="Sell Speed" value={sellSpeed} onSelect={(v) => setSellSpeed(v as any)} theme={theme}
          options={[
            { label: "Slow", icon: "🐌" },
            { label: "Medium", icon: "🚶‍♂️" },
            { label: "Fast", icon: "⚡" },
          ]}
        />

        <Dropdown label="Condition" value={condition} onSelect={(v) => setCondition(v as any)} theme={theme}
          options={[
            { label: "Poor", icon: "💔" },
            { label: "Fair", icon: "🛠️" },
            { label: "Good", icon: "👍" },
            { label: "Excellent", icon: "🌟" },
          ]}
        />

        <Input label="Demand Score (0–100)" value={demandScore} onChangeText={setDemandScore} keyboardType="numeric" theme={theme} />

        {/* FLIPSCORE */}
        <FlipScorePanel score={liveScore} theme={theme} onBreakdown={() => setShowBreakdown(true)} />

        
</ScrollView>

{/* ⭐ FIXED SAVE BUTTON ⭐ */}
<View
  style={{
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  }}
>
  {showProblem && problem && (
    <Text
      style={{
        color: theme.danger,
        textAlign: "center",
        marginBottom: 8,
      }}
    >
      {problem}
    </Text>
  )}

  <TouchableOpacity
    onPress={handleSave}
    style={{
      backgroundColor: theme.goldDeep,
      paddingVertical: 14,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.goldDeep,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    }}
  >
    <Text
      style={{
        color: theme.black,
        fontSize: 18,
        fontWeight: "700",
      }}
    >
      Save Flip
    </Text>
  </TouchableOpacity>
</View>

{showBreakdown && (
  <BreakdownModal
    theme={theme}
    breakdown={getBreakdown({
      buyPrice,
      sellPrice,
      demandScore,
      rarity,
      condition,
      sellSpeed,
      aiPriceConfidence,
    })}
    onClose={() => setShowBreakdown(false)}
  />
)}
</View>
);
}


/* -------------------------------------------------------
   REUSABLE COMPONENTS
------------------------------------------------------- */

function GoldButton({ label, onPress, theme }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: theme.card,
        padding: 10,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
      }}
    >
      <Text style={{ color: theme.white }}>{label}</Text>
    </TouchableOpacity>
  );
}

function MotSummary({
  theme,
  make,
  model,
  year,
  mileage,
  keepers,
  colour,
  motInfo,
  setMake,
  setModel,
  setYear,
  setMileage,
  setKeepers,
  setColour,
}: any) {
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
      <Input label="Make" value={make} onChangeText={setMake} theme={theme} />
      <Input label="Model" value={model} onChangeText={setModel} theme={theme} />
      <Input label="Year" value={year} onChangeText={setYear} keyboardType="numeric" theme={theme} />
      <Input label="Mileage" value={mileage} onChangeText={setMileage} keyboardType="numeric" theme={theme} />
      <Input label="Colour" value={colour} onChangeText={setColour} theme={theme} />
      <Input label="Previous Keepers" value={keepers} onChangeText={setKeepers} keyboardType="numeric" theme={theme} />

      {motInfo && (
        <>
          <Text style={{ color: theme.goldDeep, fontWeight: "600", marginBottom: 6, marginTop: 10 }}>
            MOT Summary
          </Text>

          <Text style={{ color: theme.muted }}>Expiry: {motInfo.motExpiry || "N/A"}</Text>
          <Text style={{ color: theme.muted }}>
            Advisories: {motInfo.advisories?.length ?? 0}
          </Text>
          <Text style={{ color: theme.muted }}>
            Failures: {motInfo.failures?.length ?? 0}
          </Text>
        </>
      )}
    </View>
  );
}

function FlipScorePanel({ score, theme, onBreakdown }: any) {
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
      }}
    >
      <Text style={{ color: theme.white, fontSize: 18, fontWeight: "600", marginBottom: 10 }}>
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
              score > 75 ? theme.goldDeep : score > 50 ? "#FFD966" : "#FF6666",
          }}
        />
        <View style={{ flex: 100 - Math.max(0, Math.min(100, score)) }} />
      </View>

      <TouchableOpacity
        onPress={onBreakdown}
        style={{
          marginTop: 12,
          paddingVertical: 10,
          backgroundColor: theme.card,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
      >
        <Text style={{ color: theme.goldDeep, textAlign: "center", fontSize: 16, fontWeight: "600" }}>
          View Score Breakdown
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function BreakdownModal({ theme, breakdown, onClose }: any) {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      <View
        style={{
          width: "100%",
          backgroundColor: theme.card,
          padding: 20,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
      >
        <Text style={{ color: theme.goldDeep, fontSize: 22, fontWeight: "700", marginBottom: 16, textAlign: "center" }}>
          FlipScore Breakdown
        </Text>

        <BreakItem label="Profit" value={`£${breakdown.profit}`} theme={theme} />
<BreakItem
  label="Profit Margin"
  value={`${breakdown.profitMargin.toFixed(1)}%`}
  theme={theme}
/>
<BreakItem
  label="Demand Score"
  value={`${breakdown.demandScore}/100`}
  theme={theme}
/>
<BreakItem label="Rarity" value={breakdown.rarity} theme={theme} />
<BreakItem label="Condition" value={breakdown.condition} theme={theme} />
<BreakItem label="Sell Speed" value={breakdown.sellSpeed} theme={theme} />

<BreakItem
  label="AI Confidence"
  value={`${breakdown.aiPriceConfidence}/100`}
  theme={theme}
/>

        <TouchableOpacity
          onPress={onClose}
          style={{
            marginTop: 20,
            paddingVertical: 12,
            backgroundColor: theme.goldDeep,
            borderRadius: theme.radius.md,
          }}
        >
          <Text
            style={{
              color: theme.black,
              textAlign: "center",
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Close
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BreakItem({
  label,
  value,
  theme,
}: {
  label: string;
  value: string | number;
  theme: Theme;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: theme.muted, fontSize: 14 }}>{label}</Text>
      <Text
        style={{
          color: theme.white,
          fontSize: 16,
          fontWeight: "600",
        }}
      >
        {value}
      </Text>
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
        onChangeText={onChangeText}
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

function Input({
  label,
  value,
  onChangeText,
  keyboardType,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "numeric";
  theme: Theme;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: theme.muted, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
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
  options: { label: string; icon: string }[];
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

const styles = StyleSheet.create({
  heading: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
  },
  button: {
    paddingVertical: 14,
    marginTop: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
