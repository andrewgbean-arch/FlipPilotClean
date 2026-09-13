import React, { useState } from "react";
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
import { FlipScoreInput, calculateFlipScore } from "@/utils/flipScoreEngine";


import { BASE_URL } from "@/utils/api";
import { useTheme } from "../../../src/styles/ThemeContext";

import { Theme } from "@/styles/theme";

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
  const [year, setYear] = useState<number | string>("");
  const [mileage, setMileage] = useState<number>(0);
  const [colour, setColour] = useState("");
  const [keepers, setKeepers] = useState<number>(0);

  const [liveScore, setLiveScore] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
const [price, setPrice] = useState("");
const [engineSize, setEngineSize] = useState("");
const [flipScore, setFlipScore] = useState(50);
const [marketHeat, setMarketHeat] = useState(50);

  /* -------------------------------------------------------
     IMAGE PICKER
  ------------------------------------------------------- */
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  /* -------------------------------------------------------
     FLIPSCORE RECALC
  ------------------------------------------------------- */
  const recalcScore = () => {
    const score = calculateFlipScore({
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      demandScore: Number(demandScore),
      rarity,
      condition,
      sellSpeed,
    });
    setLiveScore(score);
  };

  /* -------------------------------------------------------
     MOT LOOKUP
  ------------------------------------------------------- */
  const lookupMot = async () => {
    if (!registration.trim()) return;
    setMotLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/mot?reg=${registration.trim()}`);
      const data = await res.json();
      const mot = data.mot?.[0];

      if (!mot) return;

      setMake(mot.make ?? "");
      setModel(mot.model ?? "");
      setYear(mot.year ?? "");
      setMileage(mot.mileage ?? 0);
      setColour(mot.colour ?? "");
      setKeepers(mot.keepers ?? 0);

      setMotInfo({
        reg: registration.toUpperCase(),
        motExpiry: mot.expiry ?? "",
        mileage: mot.mileage ?? 0,
        advisories: mot.advisories ?? [],
        make: mot.make ?? "",
        model: mot.model ?? "",
        year: mot.year ?? "",
        colour: mot.colour ?? "",
        keepers: mot.keepers ?? 0,
      });

      if (mot.year && mot.make && mot.model) {
        setTitle(`${mot.year} ${mot.make} ${mot.model}`);
      }
    } catch (err) {
      console.log("❌ MOT ERROR:", err);
    } finally {
      setMotLoading(false);
    }
  };

  /* -------------------------------------------------------
     SAVE FLIP
  ------------------------------------------------------- */
  const handleSave = () => {
    const flipScore = liveScore;

    const motPayload = motInfo
      ? {
          reg: motInfo.reg,
          make: motInfo.make,
          model: motInfo.model,
          year: Number(motInfo.year),
          colour: motInfo.colour,
          keepers: motInfo.keepers,
          mileage: Number(motInfo.mileage),
          motExpiry: motInfo.motExpiry,
          expiryDate: motInfo.motExpiry,
          advisories: motInfo.advisories ?? [],
          failures: [],
          mileageHistory: [
            {
              date: new Date().toISOString(),
              mileage: Number(motInfo.mileage),
            },
          ],
        }
      : {
          reg: registration ? registration.toUpperCase() : null,
          make,
          model,
          year: typeof year === "string" ? Number(year) || null : year,
          colour,
          keepers,
          mileage,
          motExpiry: null,
          expiryDate: null,
          advisories: [],
          failures: [],
          mileageHistory: mileage
            ? [{ date: new Date().toISOString(), mileage }]
            : [],
        };

    const aiPrice = computeAiPrice({
      title,
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      flipScore,
      rarity,
      sellSpeed,
      ai: { condition, description: null },
      market: { demandScore: Number(demandScore) },
      favourite: false,
      images,
      mot: motPayload,
      id: "",
      timestamp: "",
      proTips: null,
    });

    addVehicle({
      title,
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      flipScore,
      rarity,
      sellSpeed,
      ai: {
        condition,
        description: null,
      },
      market: {
        demandScore: Number(demandScore),
      },
      favourite: false,
      images,
      mot: motPayload,
      proTips: null,
      aiPrice: {
        recommendedSellPrice: aiPrice.recommendedSellPrice,
        riskLevel: aiPrice.riskLevel,
        confidence: Number(aiPriceConfidence),
        notes: aiPrice.notes,
      },
    });
    

    router.push("/vehicles/list");
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
    const profit = Number(sellPrice) - Number(buyPrice);
    const profitMargin =
      Number(buyPrice) > 0
        ? ((Number(sellPrice) - Number(buyPrice)) / Number(buyPrice)) * 100
        : 0;

    return {
      profit,
      profitMargin,
      demandScore: Number(demandScore),
      rarity,
      condition,
      sellSpeed,
      aiPriceConfidence: Number(aiPriceConfidence),
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
    >
      <Text style={[styles.heading, { color: theme.goldDeep }]}>
        Add New Flip
      </Text>

      {/* IMAGES */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        <GoldButton label="Pick Image" onPress={pickImage} theme={theme} />
        <GoldButton label="Take Photo" onPress={takePhoto} theme={theme} />
      </View>

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

      <GoldButton label="Lookup MOT data" onPress={lookupMot} theme={theme} />

      {motInfo && (
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
        />
      )}

      {/* 🔥 LIVE MARKET VALUATION PREVIEW */}
      <ValuationEngine
        key={"new"}
        listing={{
          price,
          mileage,
          year,
          condition,
          make,
          engineSize,
        }}
        prediction={{
          flipScore,
          marketHeat,
        }}
      />

      {/* PRICES */}
      <Input
        label="Title"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          recalcScore();
        }}
        theme={theme}
      />

      <Input
        label="Buy Price (£)"
        value={buyPrice}
        onChangeText={(t) => {
          setBuyPrice(t);
          recalcScore();
        }}
        keyboardType="numeric"
        theme={theme}
      />

      <Input
        label="Sell Price (£)"
        value={sellPrice}
        onChangeText={(t) => {
          setSellPrice(t);
          recalcScore();
        }}
        keyboardType="numeric"
        theme={theme}
      />

      <Tooltip
        label="AI Price Confidence (0–100)"
        hint="Higher confidence means AI believes the price estimate is accurate."
        value={aiPriceConfidence}
        onChangeText={(t) => {
          setAiPriceConfidence(t);
          recalcScore();
        }}
        theme={theme}
      />
        {/* DROPDOWNS */}
        <Dropdown label="Rarity" value={rarity} onSelect={(v) => { setRarity(v as any); recalcScore(); }} theme={theme}
          options={[
            { label: "Common", icon: "📦" },
            { label: "Uncommon", icon: "✨" },
            { label: "Rare", icon: "💎" },
            { label: "Ultra Rare", icon: "👑" },
          ]}
        />

        <Dropdown label="Sell Speed" value={sellSpeed} onSelect={(v) => { setSellSpeed(v as any); recalcScore(); }} theme={theme}
          options={[
            { label: "Slow", icon: "🐌" },
            { label: "Medium", icon: "🚶‍♂️" },
            { label: "Fast", icon: "⚡" },
          ]}
        />

        <Dropdown label="Condition" value={condition} onSelect={(v) => { setCondition(v as any); recalcScore(); }} theme={theme}
          options={[
            { label: "Poor", icon: "💔" },
            { label: "Fair", icon: "🛠️" },
            { label: "Good", icon: "👍" },
            { label: "Excellent", icon: "🌟" },
          ]}
        />

        <Input label="Demand Score (0–100)" value={demandScore} onChangeText={(t) => { setDemandScore(t); recalcScore(); }} keyboardType="numeric" theme={theme} />

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
      <Input label="Year" value={String(year)} onChangeText={setYear} keyboardType="numeric" theme={theme} />
      <Input label="Mileage" value={String(mileage)} onChangeText={(t) => setMileage(Number(t))} keyboardType="numeric" theme={theme} />
      <Input label="Previous Keepers" value={String(keepers)} onChangeText={(t) => setKeepers(Number(t))} keyboardType="numeric" theme={theme} />

      <Text style={{ color: theme.goldDeep, fontWeight: "600", marginBottom: 6, marginTop: 10 }}>
        MOT Summary
      </Text>

      <Text style={{ color: theme.muted }}>Expiry: {motInfo.motExpiry ?? "N/A"}</Text>
      <Text style={{ color: theme.muted }}>Mileage: {motInfo.mileage ?? "N/A"}</Text>
      <Text style={{ color: theme.muted }}>Make: {motInfo.make ?? "N/A"}</Text>
      <Text style={{ color: theme.muted }}>Model: {motInfo.model ?? "N/A"}</Text>
      <Text style={{ color: theme.muted }}>Year: {motInfo.year ?? "N/A"}</Text>
      <Text style={{ color: theme.muted }}>Colour: {motInfo.colour ?? "N/A"}</Text>
      <Text style={{ color: theme.muted }}>Keepers: {motInfo.keepers ?? "N/A"}</Text>
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

{/* ⭐ THIS WAS THE MISSING LINE ⭐ */}
<BreakItem
  label="AI Confidence"
  value={`${breakdown.aiPriceConfidence}/100`}
  theme={theme}
/>
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
