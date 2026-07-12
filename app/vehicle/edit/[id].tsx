import { useState } from "react";
import { ScrollView, TextInput, View, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import ThemedText from "@/components/ThemedText";
import ThemedView from "@/components/ThemedView";
import AnimatedPressable from "@/components/AnimatedPressable";
import { useTheme } from "@/context/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

// ⭐ AI
import { useAIValuation } from "@/features/vehicles/hooks/useAIValuation";

// ⭐ MARKET SCAN
import { useMarketScan } from "@/features/vehicles/hooks/useMarketScan";

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const { vehicles, updateVehicle } = useVehicleHistory();

  const { fetchAIValuation } = useAIValuation();
  const { fetchMarketScan } = useMarketScan();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) return <ThemedText>Vehicle not found.</ThemedText>;

  const [title, setTitle] = useState(vehicle.title);
  const [buyPrice, setBuyPrice] = useState(String(vehicle.buyPrice || ""));
  const [sellPrice, setSellPrice] = useState(String(vehicle.sellPrice || ""));
  const [notes, setNotes] = useState(vehicle.notes || "");
  const [images, setImages] = useState<string[]>(vehicle.images || []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((img) => img !== uri));
  };

  const saveChanges = () => {
    updateVehicle(vehicle.id, {
      title,
      buyPrice: buyPrice ? Number(buyPrice) : null,
      sellPrice: sellPrice ? Number(sellPrice) : null,
      notes: notes || null,
      images: images.length > 0 ? images : null,
    });

    router.push(`/vehicle/${vehicle.id}`);
  };

  return (
    <ScrollView style={{ padding: 20 }}>
      <ThemedText style={{ fontSize: 28, fontWeight: "bold", marginBottom: 20 }}>
        Edit Vehicle
      </ThemedText>

      {/* TITLE */}
      <ThemedText style={{ fontSize: 18 }}>Title</ThemedText>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Ford Fiesta 2014..."
        style={{
          backgroundColor: theme.card,
          padding: 12,
          borderRadius: 12,
          marginBottom: 16,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          color: theme.text,
        }}
      />

      {/* BUY PRICE */}
      <ThemedText style={{ fontSize: 18 }}>Buy Price (£)</ThemedText>
      <TextInput
        value={buyPrice}
        onChangeText={setBuyPrice}
        keyboardType="numeric"
        placeholder="1800"
        style={{
          backgroundColor: theme.card,
          padding: 12,
          borderRadius: 12,
          marginBottom: 16,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          color: theme.text,
        }}
      />

      {/* SELL PRICE */}
      <ThemedText style={{ fontSize: 18 }}>Sell Price (£)</ThemedText>
      <TextInput
        value={sellPrice}
        onChangeText={setSellPrice}
        keyboardType="numeric"
        placeholder="2600"
        style={{
          backgroundColor: theme.card,
          padding: 12,
          borderRadius: 12,
          marginBottom: 16,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          color: theme.text,
        }}
      />

      {/* NOTES */}
      <ThemedText style={{ fontSize: 18 }}>Notes</ThemedText>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Clean runner, ideal first car..."
        style={{
          backgroundColor: theme.card,
          padding: 12,
          borderRadius: 12,
          marginBottom: 16,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          color: theme.text,
          minHeight: 100,
        }}
      />

      {/* IMAGES */}
      <ThemedText style={{ fontSize: 18, marginBottom: 8 }}>Images</ThemedText>

      <AnimatedPressable
        onPress={pickImage}
        style={{
          padding: 12,
          backgroundColor: theme.accent,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <ThemedText style={{ color: theme.black }}>📸 Add Image</ThemedText>
      </AnimatedPressable>

      {images.map((uri, idx) => (
        <View key={idx} style={{ marginBottom: 12 }}>
          <Image
            source={{ uri }}
            style={{
              width: "100%",
              height: 180,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: theme.goldDeep,
              marginBottom: 8,
            }}
          />
          <AnimatedPressable
            onPress={() => removeImage(uri)}
            style={{
              padding: 10,
              backgroundColor: theme.danger,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <ThemedText style={{ color: theme.white }}>🗑️ Remove</ThemedText>
          </AnimatedPressable>
        </View>
      ))}

      {/* ⭐ AI VALUATION BUTTON */}
      <AnimatedPressable
        onPress={async () => {
          const ai = await fetchAIValuation(vehicle);

          if (ai) {
            updateVehicle(vehicle.id, {
              aiPrice: {
                recommendedSellPrice: ai.recommendedSellPrice,
                riskLevel: ai.riskLevel,
              },
              aiPriceMin: ai.aiPriceMin,
              aiPriceMax: ai.aiPriceMax,
              aiPriceConfidence: ai.confidence,
              insights: ai.insights,
            });
          }
        }}
        style={{
          padding: 14,
          backgroundColor: theme.accent,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <ThemedText style={{ color: theme.black }}>🤖 Run AI Valuation</ThemedText>
      </AnimatedPressable>

      {/* ⭐ MARKET SCAN BUTTON */}
      <AnimatedPressable
        onPress={async () => {
          const market = await fetchMarketScan({
            title,
            buyPrice: buyPrice ? Number(buyPrice) : null,
            sellPrice: sellPrice ? Number(sellPrice) : null,
            notes,
            images,
          });

          if (market) {
            updateVehicle(vehicle.id, {
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
          }
        }}
        style={{
          padding: 14,
          backgroundColor: theme.accent,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <ThemedText style={{ color: theme.black }}>📈 Run Market Scan</ThemedText>
      </AnimatedPressable>

      {/* SAVE BUTTON */}
      <AnimatedPressable
        onPress={saveChanges}
        style={{
          padding: 16,
          backgroundColor: theme.goldDeep,
          borderRadius: 16,
          marginTop: 20,
          alignItems: "center",
        }}
      >
        <ThemedText style={{ color: theme.black, fontSize: 18 }}>
          Save Changes
        </ThemedText>
      </AnimatedPressable>
    </ScrollView>
  );
}
