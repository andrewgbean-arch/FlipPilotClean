import React, { useState, useEffect } from "react";

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
import { calculateFlipScore, FlipScoreInput } from "@/utils/flipScoreEngine";
import { computeAiPrice } from "@/features/ai/priceengine";

import { useTheme } from "@/styles/useTheme";
import { Theme } from "@/styles/theme";
import { styles } from "@/styles/styles";
import { BASE_URL } from "@/utils/api";

/* -------------------------------------------------------
   ROUTE
------------------------------------------------------- */

export default function EditFlipRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { vehicles, updateVehicle } = useVehicleHistory();
  const router = useRouter();
  const theme = useTheme();

  const vehicleId = Array.isArray(id) ? id[0] : id;
  const flip = vehicles.find((v) => v.id === vehicleId);

  if (!flip) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme.goldDeep} />
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
  const [keepers, setKeepers] = useState(flip.mot?.keepers ?? 0);
  const [mileage, setMileage] = useState(flip.mot?.mileage ?? 0);

  const [engineSize, setEngineSize] = useState(flip.engineSize ?? 0);

  const [images, setImages] = useState<string[]>(flip.images ?? []);
  const [liveScore, setLiveScore] = useState(flip.flipScore ?? 0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [dirty, setDirty] = useState(false);

  /* -------------------------------------------------------
       AUTO TITLE (YEAR + MAKE + MODEL)
    ------------------------------------------------------- */
  useEffect(() => {
    if (year && make && model) {
      setTitle(`${year} ${make} ${model}`);
    }
  }, [year, make, model]);

  /* -------------------------------------------------------
       VALUATION ENGINE DATA
    ------------------------------------------------------- */
  const flipScore = liveScore;
  const marketHeat = Number(demandScore);

  const listing = {
    id: flip.id,
    price: Number(sellPrice) || Number(buyPrice) || 0,
    mileage,
    year,
    condition,
    make,
    engineSize,
  };

  /* -------------------------------------------------------
       VALIDATION
    ------------------------------------------------------- */
  const isValid =
    Number(buyPrice) > 0 &&
    Number(sellPrice) > 0;

  /* -------------------------------------------------------
       IMAGE PICKER
    ------------------------------------------------------- */
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled) {
      setDirty(true);
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setDirty(true);
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

    try {
      const res = await fetch(`${BASE_URL}/vehicle?reg=${encodeURIComponent(registration.trim())}`);
      const data = await res.json();

      if (!data.ok || !data.vehicle) return;

      const mot = {
        make: data.vehicle.make,
        model: data.vehicle.model,
        year: data.vehicle.year,
        mileage: data.vehicle.mileage,
        colour: data.vehicle.colour,
        keepers: null,
        motStatus: data.motAvailable ? "Valid" : "Unknown",
        motExpiry: data.vehicle.motExpiry,
        expiryDate: data.vehicle.motExpiry,
        taxStatus: data.vehicle.taxStatus,
        advisories: data.vehicle.advisories?.map((a: any) => a.text ?? String(a)) ?? [],
      };

      setDirty(true);

      setMake(mot.make ?? "");
      setModel(mot.model ?? "");
      setYear(mot.year ?? "");
      setMileage(mot.mileage ?? 0);
      setColour(mot.colour ?? "");
      setKeepers(mot.keepers ?? 0);

      setMotInfo({
        reg: registration.toUpperCase(),
        motStatus: mot.motStatus ?? mot.status ?? "Unknown",
        motExpiry: mot.motExpiry ?? mot.expiryDate ?? "",
        mileage: mot.mileage ?? 0,
        advisories: mot.advisories ?? [],
        taxStatus: mot.taxStatus ?? "Unknown",
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
    }
  };

  /* -------------------------------------------------------
       SAVE
    ------------------------------------------------------- */
  const handleSave = () => {
    const flipScore = liveScore;

    const motPayload = {
      ...flip.mot,
      reg: motInfo?.reg ?? registration.toUpperCase(),
      make: motInfo?.make ?? make,
      model: motInfo?.model ?? model,
      colour: motInfo?.colour ?? colour,
      keepers: motInfo?.keepers ?? keepers,
      year: Number(motInfo?.year ?? year) || null,
      mileage: Number(motInfo?.mileage ?? mileage ?? 0),
      motExpiry: motInfo?.motExpiry ?? flip.mot?.motExpiry ?? null,
      expiryDate: motInfo?.motExpiry ?? flip.mot?.expiryDate ?? null,
      advisories: motInfo?.advisories ?? flip.mot?.advisories ?? [],
      failures: flip.mot?.failures ?? [],
      mileageHistory: flip.mot?.mileageHistory ?? [
        {
          date: new Date().toISOString(),
          mileage: Number(motInfo?.mileage ?? mileage ?? 0),
        },
      ],
    };

    const aiPrice = computeAiPrice({
      ...flip,
      title,
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      flipScore,
      rarity,
      sellSpeed,
      ai: { condition, description },
      market: { demandScore: Number(demandScore) },
      images,
      mot: motPayload,
    });

    updateVehicle(flip.id, {
      title,
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      flipScore,
      rarity,
      sellSpeed,
      ai: { condition, description },
      market: { demandScore: Number(demandScore) },
      images,
      mot: motPayload,
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
       BREAKDOWN BUILDER
    ------------------------------------------------------- */
  const getBreakdown = () => ({
    profit: Number(sellPrice) - Number(buyPrice),
    profitMargin:
      Number(buyPrice) > 0
        ? ((Number(sellPrice) - Number(buyPrice)) / Number(buyPrice)) * 100
        : 0,
    demandScore: Number(demandScore),
    rarity,
    condition,
    sellSpeed,
    aiPriceConfidence: Number(aiPriceConfidence),
  });

  /* -------------------------------------------------------
       UI
    ------------------------------------------------------- */
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 20 }}
      >
        <Text style={[styles.heading, { color: theme.goldDeep }]}>
          Edit Flip
        </Text>
        <Text style={{ color: theme.muted, marginBottom: 10 }}>
          Last updated: {new Date(flip.timestamp).toLocaleDateString()}
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
          label="Refresh MOT data"
          icon="refresh-cw"
          onPress={lookupMot}
          theme={theme}
        />

        {motInfo && <MotSummary mot={motInfo} theme={theme} />}

        <Input
          label="Make"
          value={make}
          onChangeText={(t) => {
            setDirty(true);
            setMake(t);
          }}
          theme={theme}
        />

        <Input
          label="Model"
          value={model}
          onChangeText={(t) => {
            setDirty(true);
            setModel(t);
          }}
          theme={theme}
        />

        <Input
          label="Mileage"
          value={String(mileage)}
          onChangeText={(v) => {
            setDirty(true);
            setMileage(Math.round(Number(v)));
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
          value={String(keepers)}
          onChangeText={(v) => {
            setDirty(true);
            setKeepers(Number(v));
          }}
          keyboardType="numeric"
          theme={theme}
        />

        <Input
          label="Engine Size (cc)"
          value={String(engineSize)}
          onChangeText={(v) => {
            setDirty(true);
            setEngineSize(Number(v));
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
            recalcScore();
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
            recalcScore();
          }}
          keyboardType="numeric"
          theme={theme}
        />

        <Text style={{ color: theme.goldDeep, marginBottom: 10 }}>
          Profit Preview: £{Number(sellPrice || 0) - Number(buyPrice || 0)}
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
            recalcScore();
          }}
          theme={theme}
        />

        <Dropdown
          label="Rarity"
          value={rarity}
          onSelect={(v) => {
            setDirty(true);
            setRarity(v as any);
            recalcScore();
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
            recalcScore();
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
            recalcScore();
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
            recalcScore();
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
