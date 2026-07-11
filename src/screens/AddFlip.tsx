import { useState } from "react";
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

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/context/ThemeContext";
import { Theme } from "@/styles/theme";
import { calculateFlipScore } from "@/features/vehicles/utils/flipScoreEngine";
import { computeAiPrice } from "@/features/ai/priceEngine";

export default function AddFlip() {
  const theme = useTheme();
  const router = useRouter();
  const { addVehicle } = useVehicleHistory();

  // ================================
  // FORM STATE
  // ================================
  const [title, setTitle] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [aiPriceConfidence, setAiPriceConfidence] = useState("");

  const [rarity, setRarity] = useState("Common");
  const [sellSpeed, setSellSpeed] = useState("Medium");
  const [condition, setCondition] = useState("Good");

  const [demandScore, setDemandScore] = useState("");

  // images (Phase 1)
  const [images, setImages] = useState<string[]>([]);

  // MOT (Phase 2)
  const [registration, setRegistration] = useState("");
  const [motInfo, setMotInfo] = useState<{
    reg?: string | null;
    motStatus?: string | null;
    motExpiry?: string | null;
    mileage?: number | null;
    advisories?: string[] | null;
    taxStatus?: string | null;
    make?: string | null;
    model?: string | null;
    year?: number | null;
  } | null>(null);

  const [liveScore, setLiveScore] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ================================
  // IMAGE PICKERS
  // ================================
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  // ================================
  // LIVE SCORE RECALCULATOR
  // ================================
  const recalcScore = () => {
    const score = calculateFlipScore({
      buyPrice: Number(buyPrice),
      sellPrice: Number(sellPrice),
      demandScore: Number(demandScore),
      rarity,
      condition,
      sellSpeed,
      aiPriceConfidence: Number(aiPriceConfidence),
    });

    setLiveScore(score);
  };

  // ================================
  // BREAKDOWN DATA
  // ================================
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

  // ================================
  // MOT LOOKUP (plug your backend here)
  // ================================
  const lookupMot = async () => {
    if (!registration.trim()) return;

    try {
      // 👉 replace this with your own backend endpoint that calls DVLA
      // e.g. const res = await fetch(`https://your-backend/mot?reg=${registration}`);
      // const data = await res.json();

      // temporary mock structure so UI + FlipRecord wiring works
      const data = {
        reg: registration.toUpperCase(),
        motStatus: "Valid",
        motExpiry: "2026-05-01",
        mileage: 82000,
        advisories: ["Slight play in front suspension arm", "Minor exhaust corrosion"],
        taxStatus: "Taxed",
        make: "Ford",
        model: "Fiesta",
        year: 2012,
      };

      setMotInfo({
        reg: data.reg,
        motStatus: data.motStatus,
        motExpiry: data.motExpiry,
        mileage: data.mileage,
        advisories: data.advisories,
        taxStatus: data.taxStatus,
        make: data.make,
        model: data.model,
        year: data.year,
      });

      if (data.year && data.make && data.model) {
        setTitle(`${data.year} ${data.make} ${data.model}`);
      }
    } catch (err) {
      console.log(err);
    }
  };

  // ================================
  // SUBMIT HANDLER
  // ================================
const handleSave = () => {
  const flipScore = liveScore;

  const aiPrice = computeAiPrice({
    title,
    buyPrice: Number(buyPrice),
    sellPrice: Number(sellPrice),
    flipScore,
    aiPriceConfidence: Number(aiPriceConfidence),
    rarity,
    sellSpeed,
    ai: { condition, description: null },
    market: { demandScore: Number(demandScore) },
    favourite: false,
    images,
    mot: motInfo ?? null,
    id: "",
    timestamp: "",
    proTips: null,
  });

  addVehicle({
    title,
    buyPrice: Number(buyPrice),
    sellPrice: Number(sellPrice),
    flipScore,
    aiPriceConfidence: Number(aiPriceConfidence),
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
    mot: motInfo ?? null,
    proTips: null,
    aiPrice, // ⭐ NEW FIELD
  });

  router.push("/(tabs)/vehicles");
};


  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 20 }}
      >
        <Text style={[styles.heading, { color: theme.goldDeep }]}>
          Add New Flip
        </Text>

        {/* IMAGE BUTTONS */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={pickImage}
            style={{
              backgroundColor: theme.card,
              padding: 10,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.goldSoftGlow,
            }}
          >
            <Text style={{ color: theme.white }}>Pick Image</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={takePhoto}
            style={{
              backgroundColor: theme.card,
              padding: 10,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.goldSoftGlow,
            }}
          >
            <Text style={{ color: theme.white }}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        {/* IMAGE PREVIEW */}
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

        {/* REG + MOT */}
        <Input
          label="Registration (optional)"
          value={registration}
          onChangeText={setRegistration}
          theme={theme}
        />

        <TouchableOpacity
          onPress={lookupMot}
          style={{
            backgroundColor: theme.card,
            padding: 10,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: theme.white, textAlign: "center" }}>
            Lookup MOT data
          </Text>
        </TouchableOpacity>

        {motInfo && (
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
            <Text style={{ color: theme.goldDeep, fontWeight: "600", marginBottom: 6 }}>
              MOT summary
            </Text>
            <Text style={{ color: theme.muted }}>
              Status: {motInfo.motStatus ?? "Unknown"}
            </Text>
            <Text style={{ color: theme.muted }}>
              Expiry: {motInfo.motExpiry ?? "N/A"}
            </Text>
            <Text style={{ color: theme.muted }}>
              Mileage: {motInfo.mileage ?? "N/A"}
            </Text>
            <Text style={{ color: theme.muted }}>
              Tax: {motInfo.taxStatus ?? "Unknown"}
            </Text>
          </View>
        )}

        {/* FORM INPUTS */}
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

        <Dropdown
          label="Rarity"
          theme={theme}
          value={rarity}
          onSelect={(v) => {
            setRarity(v);
            recalcScore();
          }}
          options={[
            { label: "Common", icon: "📦" },
            { label: "Uncommon", icon: "✨" },
            { label: "Rare", icon: "💎" },
            { label: "Ultra Rare", icon: "👑" },
          ]}
        />

        <Dropdown
          label="Sell Speed"
          theme={theme}
          value={sellSpeed}
          onSelect={(v) => {
            setSellSpeed(v);
            recalcScore();
          }}
          options={[
            { label: "Slow", icon: "🐌" },
            { label: "Medium", icon: "🚶‍♂️" },
            { label: "Fast", icon: "⚡" },
          ]}
        />

        <Dropdown
          label="Condition"
          theme={theme}
          value={condition}
          onSelect={(v) => {
            setCondition(v);
            recalcScore();
          }}
          options={[
            { label: "Poor", icon: "💔" },
            { label: "Fair", icon: "🛠️" },
            { label: "Good", icon: "👍" },
            { label: "Excellent", icon: "🌟" },
          ]}
        />

        <Input
          label="Demand Score (0–100)"
          value={demandScore}
          onChangeText={(t) => {
            setDemandScore(t);
            recalcScore();
          }}
          keyboardType="numeric"
          theme={theme}
        />

        {/* FLIPSCORE METER */}
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
          <Text
            style={{
              color: theme.white,
              fontSize: 18,
              fontWeight: "600",
              marginBottom: 10,
            }}
          >
            Flip Score: {liveScore}/100
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
                flex: Math.max(0, Math.min(100, liveScore)),
                backgroundColor:
                  liveScore > 75
                    ? theme.goldDeep
                    : liveScore > 50
                    ? "#FFD966"
                    : "#FF6666",
              }}
            />
            <View
              style={{
                flex: 100 - Math.max(0, Math.min(100, liveScore)),
              }}
            />
          </View>

          <TouchableOpacity
            onPress={() => setShowBreakdown(true)}
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

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.goldDeep, borderRadius: theme.radius.md },
          ]}
          onPress={handleSave}
        >
          <Text style={[styles.buttonText, { color: theme.black }]}>
            Save Flip
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
        <Text style={{ color: theme.goldDeep, marginBottom: 6 }}>
          {hint}
        </Text>
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

function BreakdownModal({
  theme,
  breakdown,
  onClose,
}: {
  theme: Theme;
  breakdown: {
    profit: number;
    profitMargin: number;
    demandScore: number;
    rarity: string;
    condition: string;
    sellSpeed: string;
    aiPriceConfidence: number;
  };
  onClose: () => void;
}) {
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
        <Text
          style={{
            color: theme.goldDeep,
            fontSize: 22,
            fontWeight: "700",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
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
