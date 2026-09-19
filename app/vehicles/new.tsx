import React, { useState, useRef } from "react";
import {
  ScrollView,
  TextInput,
  Image,
  Text,
  View,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { useTheme } from "../../src/styles/useTheme";

import { useVehicleHistory } from "../../src/features/vehicles/context/VehicleHistoryContext";
import { useAIValuation } from "../../src/features/vehicles/hooks/useAIValuation";
import { useMarketScan } from "../../src/features/vehicles/hooks/useMarketScan";

import {
  SuperCard,
  SuperInput,
  SuperButton,
  SuperGlowButton,
  SuperBadge,
  SuperDivider,
  autoFormatReg,
  getMotStatusColor,
} from "../../src/features/vehicles/ui/SupernovaUI";

import { fetchMOT } from "../../src/features/vehicles/api/mot";

// "1,800" or "£1,800" -> 1800. Blank -> null; anything that is not a plain number -> undefined.
function parseAmount(text: string): number | null | undefined {
  const cleaned = text.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  return /^\d*\.?\d+$/.test(cleaned) ? Number(cleaned) : undefined;
}

const normaliseReg = (text: string) => text.replace(/\s+/g, "").toUpperCase();

export default function NewVehicleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { addVehicle } = useVehicleHistory();

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
     ⭐ Parsed form values (undefined = typed but not a number)
  ============================================================ */
  const buyN = parseAmount(buyPrice);
  const sellN = parseAmount(sellPrice);
  const mileageN = parseAmount(mileage);
  const yearN = parseAmount(year);
  const engineN = parseAmount(engineSize);

  const problem = !title.trim()
    ? "Add a title for this vehicle."
    : buyN === undefined
    ? "Buy price must be a number, for example 1800."
    : sellN === undefined
    ? "Sell price must be a number, for example 2600."
    : mileageN === undefined
    ? "Mileage must be a number, for example 82000."
    : yearN === undefined
    ? "Year must be a number, for example 2014."
    : engineN === undefined
    ? "Engine size must be a number, for example 1.2."
    : null;

  /* ============================================================
     ⭐ Profit Calculation
  ============================================================ */
  const profit = buyN != null && sellN != null ? sellN - buyN : null;

  const profitColor =
    profit == null
      ? theme.muted
      : profit < 0
      ? theme.danger
      : profit < 500
      ? theme.accent
      : theme.goldDeep;

  /* ============================================================
     ⭐ Image Picker
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
     ⭐ Delete Image
  ============================================================ */
  const deleteImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  /* ============================================================
     ⭐ MOT Lookup (mock fields supported)
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
     ⭐ AI Valuation + Market Scan
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
     ⭐ Save Vehicle
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
     ⭐ UI
  ============================================================ */
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      
      {/* ⭐ Slim Header */}
      <View
        style={{
          paddingTop: 20,
          paddingBottom: 12,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: theme.card,
        }}
      >
        <Text
          style={{
            fontSize: 26,
            fontWeight: "800",
            color: theme.text,
          }}
        >
          New Vehicle
        </Text>

        <Text
          style={{
            color: theme.muted,
            fontSize: 13,
            marginTop: 2,
          }}
        >
          Manual Entry • Motors Module
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 200,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ⭐ Vehicle Details */}
        <SuperCard theme={theme} title="Vehicle Details">
          
          <SuperInput
            label="Vehicle Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Ford Fiesta 2014..."
            theme={theme}
          />

          <SuperInput
            label="Registration"
            value={reg}
            onChangeText={(t) => setReg(autoFormatReg(t))}
            placeholder="AB12 CDE"
            theme={theme}
          />

          <SuperButton
            label={motLoading ? "Looking up..." : "🔍 Lookup MOT"}
            onPress={lookupMOT}
            theme={theme}
          />

          {motError && (
            <Text style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>
              {motError}
            </Text>
          )}

          {/* ⭐ 2-WIDE: Make + Model */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <SuperInput
                label="Make"
                value={make}
                onChangeText={setMake}
                placeholder="Ford"
                theme={theme}
              />
            </View>

            <View style={{ flex: 1 }}>
              <SuperInput
                label="Model"
                value={model}
                onChangeText={setModel}
                placeholder="Fiesta"
                theme={theme}
              />
            </View>
          </View>

          {/* ⭐ 2-WIDE: Year + Colour */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <SuperInput
                label="Year"
                value={year}
                onChangeText={setYear}
                placeholder="2014"
                keyboardType="numeric"
                theme={theme}
              />
            </View>

            <View style={{ flex: 1 }}>
              <SuperInput
                label="Colour"
                value={colour}
                onChangeText={setColour}
                placeholder="Blue"
                theme={theme}
              />
            </View>
          </View>

          {/* ⭐ 2-WIDE: Mileage + Engine Size */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <SuperInput
                label="Mileage"
                value={mileage}
                onChangeText={setMileage}
                placeholder="82000"
                keyboardType="numeric"
                theme={theme}
              />
            </View>

            <View style={{ flex: 1 }}>
              <SuperInput
                label="Engine Size"
                value={engineSize}
                onChangeText={setEngineSize}
                placeholder="1.2"
                theme={theme}
              />
            </View>
          </View>
        </SuperCard>
        {/* ⭐ Pricing */}
        <SuperCard theme={theme} title="Pricing">
          
          {/* ⭐ 2-WIDE: Buy + Sell */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <SuperInput
                label="Buy Price (£)"
                value={buyPrice}
                onChangeText={setBuyPrice}
                placeholder="1800"
                keyboardType="numeric"
                theme={theme}
              />
            </View>

            <View style={{ flex: 1 }}>
              <SuperInput
                label="Sell Price (£)"
                value={sellPrice}
                onChangeText={setSellPrice}
                placeholder="2600"
                keyboardType="numeric"
                theme={theme}
              />
            </View>
          </View>

          {/* ⭐ Profit Bar */}
          <View style={{ marginTop: 10 }}>
            <Text
              style={{
                color: theme.text,
                fontSize: 14,
                marginBottom: 6,
              }}
            >
              Live Profit
            </Text>

            <View
              style={{
                height: 8,
                borderRadius: 999,
                backgroundColor: theme.card,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width:
                    profit == null
                      ? "0%"
                      : `${Math.max(0, Math.min(100, (profit / 2000) * 100))}%`,
                  height: "100%",
                  backgroundColor: profitColor,
                }}
              />
            </View>

            <Text
              style={{
                color: profitColor,
                fontSize: 14,
                marginTop: 4,
                fontWeight: "600",
              }}
            >
              {profit == null
                ? "Enter buy & sell to see profit"
                : `£${profit.toFixed(0)} profit`}
            </Text>
          </View>
        </SuperCard>

        {/* ⭐ Notes */}
        <SuperCard theme={theme} title="Notes">
          <SuperInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Clean runner, ideal first car..."
            multiline
            theme={theme}
          />
        </SuperCard>
        {/* ⭐ Images */}
        <SuperCard theme={theme} title="Images">
          <SuperButton
            label="📸 Add Image"
            onPress={pickImage}
            theme={theme}
          />

          {images.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 12 }}
            >
              {images.map((uri, idx) => (
                <View
                  key={idx}
                  style={{
                    marginRight: 12,
                    borderRadius: 14,
                    overflow: "hidden",
                    borderWidth: 2,
                    borderColor: theme.goldDeep,
                    position: "relative",
                  }}
                >
                  {/* ⭐ Delete Button */}
                  <TouchableOpacity
                    onPress={() => deleteImage(idx)}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      backgroundColor: theme.danger,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: theme.radius.md,
                      zIndex: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.white,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      X
                    </Text>
                  </TouchableOpacity>

                  <Image
                    source={{ uri }}
                    style={{
                      width: width * 0.6,
                      height: 180,
                    }}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              No images yet. Add at least one for better AI & market accuracy.
            </Text>
          )}
        </SuperCard>
        {/* ⭐ AI Tools */}
        <SuperCard theme={theme} title="AI Tools">
          <SuperButton
            label={aiLoading ? "Running..." : "🤖 Run AI Valuation"}
            onPress={runAIValuation}
            theme={theme}
          />

          {aiError && (
            <Text style={{ color: theme.danger, fontSize: 13, marginTop: 4 }}>
              {aiError}
            </Text>
          )}

          {aiData && (
            <View
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                backgroundColor: theme.cardElevated,
                borderWidth: 1,
                borderColor: theme.goldDeep,
              }}
            >
              <Text
                style={{
                  color: theme.text,
                  fontSize: 15,
                  fontWeight: "700",
                  marginBottom: 4,
                }}
              >
                AI Summary
              </Text>

              <Text style={{ color: theme.text, fontSize: 13 }}>
                Recommended Price:{" "}
                <Text style={{ fontWeight: "700" }}>
                  £{aiData.aiPrice?.recommendedSellPrice?.toFixed(0) ?? "—"}
                </Text>
              </Text>

              <Text style={{ color: theme.text, fontSize: 13 }}>
                Risk Level:{" "}
                <Text style={{ fontWeight: "700" }}>
                  {aiData.aiPrice?.riskLevel ?? "—"}
                </Text>
              </Text>

              <Text style={{ color: theme.text, fontSize: 13 }}>
                Confidence:{" "}
                <Text style={{ fontWeight: "700" }}>
                  {aiData.aiPriceConfidence != null
                    ? `${Math.round(aiData.aiPriceConfidence)}%`
                    : "—"}
                </Text>
              </Text>
            </View>
          )}
        </SuperCard>

        {/* ⭐ Market Tools */}
        <SuperCard theme={theme} title="Market Intelligence">
          <SuperButton
            label={marketLoading ? "Scanning..." : "📈 Run Market Scan"}
            onPress={runMarketScan}
            theme={theme}
          />

          {marketError && (
            <Text style={{ color: theme.danger, fontSize: 13, marginTop: 4 }}>
              {marketError}
            </Text>
          )}

          {marketData && (
            <View
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                backgroundColor: theme.cardElevated,
                borderWidth: 1,
                borderColor: theme.goldDeep,
              }}
            >
              <Text
                style={{
                  color: theme.text,
                  fontSize: 15,
                  fontWeight: "700",
                  marginBottom: 4,
                }}
              >
                Market Snapshot
              </Text>

              <Text style={{ color: theme.text, fontSize: 13 }}>
                Smart Price:{" "}
                <Text style={{ fontWeight: "700" }}>
                  £{marketData.market.smartPrice?.toFixed(0) ?? "—"}
                </Text>
              </Text>

              <Text style={{ color: theme.text, fontSize: 13 }}>
                Range:{" "}
                <Text style={{ fontWeight: "700" }}>
                  £{marketData.market.lowest?.toFixed(0) ?? "—"} – £
                  {marketData.market.highest?.toFixed(0) ?? "—"}
                </Text>
              </Text>

              <Text style={{ color: theme.text, fontSize: 13 }}>
                Average:{" "}
                <Text style={{ fontWeight: "700" }}>
                  £{marketData.market.average?.toFixed(0) ?? "—"}
                </Text>
              </Text>
            </View>
          )}
        </SuperCard>
    {/* ⭐ MOT Summary (BOTTOM) */}
{motData && (
  <SuperCard theme={theme} title="MOT Summary">
    {/* ⭐ MOT Status Badge */}
    <SuperBadge
      label={
        (() => {
          const expiry = motData.expiry;
          if (!expiry) return "NO DATA";

          const today = new Date();
          const exp = new Date(expiry);

          if (exp < today) return "EXPIRED";
          if ((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) < 30)
            return "DUE SOON";

          return "PASS";
        })()
      }
      theme={theme}
      color={getMotStatusColor(theme, motData.expiry)}
    />

    <SuperDivider theme={theme} />

    <Text style={{ color: theme.text, fontSize: 14 }}>
      Expiry:{" "}
      <Text style={{ fontWeight: "700" }}>
        {motData.expiry ?? "—"}
      </Text>
    </Text>

    <Text style={{ color: theme.text, fontSize: 14 }}>
      Mileage:{" "}
      <Text style={{ fontWeight: "700" }}>
        {motData.mileage ?? "—"}
      </Text>
    </Text>

    <Text style={{ color: theme.text, fontSize: 14 }}>
      Colour:{" "}
      <Text style={{ fontWeight: "700" }}>
        {motData.colour ?? "—"}
      </Text>
    </Text>

    <Text style={{ color: theme.text, fontSize: 14 }}>
      Year:{" "}
      <Text style={{ fontWeight: "700" }}>
        {motData.year ?? "—"}
      </Text>
    </Text>

    <Text style={{ color: theme.text, fontSize: 14 }}>
      Make/Model:{" "}
      <Text style={{ fontWeight: "700" }}>
        {motData.make} {motData.model}
      </Text>
    </Text>
  </SuperCard>
)}

</ScrollView>

{/* ⭐ Floating Save Button */}
<View
  style={{
    position: "absolute",
    bottom: 48,
    left: 20,
    right: 20,
  }}
>
  {showProblem && problem && (
    <Text
      style={{
        color: theme.danger,
        fontSize: 13,
        textAlign: "center",
        marginBottom: 8,
      }}
    >
      {problem}
    </Text>
  )}

  <SuperGlowButton
    label="Save Vehicle"
    onPress={saveVehicle}
    theme={theme}
  />
</View>
</View>
);
}

