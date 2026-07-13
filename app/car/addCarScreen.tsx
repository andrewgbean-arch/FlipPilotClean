import React, { useState } from "react";
import { ScrollView, View, TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";

import ThemedText from "@/src/styles/theme/ThemedText";
import ThemedView from "@/src/styles/theme/ThemedView";
import { useTheme } from "@/src/context/ThemeContext";

import { CarCondition, CarRecord } from "@/src/car/carTypes";
import { addCar } from "@/src/car/carStorage";
import { estimateMarketValue } from "@/src/car/carValuationService";
import { generateAiSummary } from "@/src/car/carAiService";

export default function AddCarScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [reg, setReg] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [condition, setCondition] = useState<CarCondition>("good");
  const [notes, setNotes] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!make || !model || !year || !mileage || !reg || !purchasePrice) {
      console.log("Missing required fields");
      return;
    }

    setIsSaving(true);

    const numericYear = Number(year);
    const numericMileage = Number(mileage);
    const numericPurchasePrice = Number(purchasePrice);

    const valuation = estimateMarketValue({
      make,
      model,
      year: numericYear,
      mileage: numericMileage,
      purchasePrice: numericPurchasePrice,
      condition,
    });

    const aiSummary = await generateAiSummary({
      make,
      model,
      year: numericYear,
      mileage: numericMileage,
      purchasePrice: numericPurchasePrice,
      valuation,
      mot: {
        make,
        model,
        year: numericYear,
        expiry: "",
        mileageHistory: [],
        advisories: [],
        failures: [],
        lastChecked: new Date().toISOString(),
      },
    });

    const newCar: CarRecord = {
      id: Date.now().toString(),
      make,
      model,
      year: numericYear,
      mileage: numericMileage,
      reg,
      purchasePrice: numericPurchasePrice,
      condition,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
      mot: undefined,
      valuation,
      aiSummary,
      analytics: undefined,
      imageUri: undefined,
      salePrice: undefined,
      expectedSalePrice: undefined,
    };

    await addCar(newCar);
    setIsSaving(false);
    router.back();
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <ThemedText
          style={{
            fontSize: 26,
            fontWeight: "900",
            color: theme.accent,
            marginBottom: 16,
          }}
        >
          Add New Flip
        </ThemedText>

        {/* Basic fields */}
        <View style={{ marginBottom: 16 }}>
          <ThemedText style={{ color: theme.text }}>Make</ThemedText>
          <TextInput
            value={make}
            onChangeText={setMake}
            style={{
              borderWidth: 1,
              borderColor: theme.goldDeep,
              borderRadius: 8,
              padding: 10,
              color: theme.text,
              marginTop: 4,
            }}
          />

          <ThemedText style={{ color: theme.text, marginTop: 12 }}>Model</ThemedText>
          <TextInput
            value={model}
            onChangeText={setModel}
            style={{
              borderWidth: 1,
              borderColor: theme.goldDeep,
              borderRadius: 8,
              padding: 10,
              color: theme.text,
              marginTop: 4,
            }}
          />

          <ThemedText style={{ color: theme.text, marginTop: 12 }}>Year</ThemedText>
          <TextInput
            value={year}
            onChangeText={setYear}
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: theme.goldDeep,
              borderRadius: 8,
              padding: 10,
              color: theme.text,
              marginTop: 4,
            }}
          />

          <ThemedText style={{ color: theme.text, marginTop: 12 }}>Mileage</ThemedText>
          <TextInput
            value={mileage}
            onChangeText={setMileage}
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: theme.goldDeep,
              borderRadius: 8,
              padding: 10,
              color: theme.text,
              marginTop: 4,
            }}
          />

          <ThemedText style={{ color: theme.text, marginTop: 12 }}>Registration</ThemedText>
          <TextInput
            value={reg}
            onChangeText={setReg}
            autoCapitalize="characters"
            style={{
              borderWidth: 1,
              borderColor: theme.goldDeep,
              borderRadius: 8,
              padding: 10,
              color: theme.text,
              marginTop: 4,
            }}
          />

          <ThemedText style={{ color: theme.text, marginTop: 12 }}>Purchase Price (£)</ThemedText>
          <TextInput
            value={purchasePrice}
            onChangeText={setPurchasePrice}
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: theme.goldDeep,
              borderRadius: 8,
              padding: 10,
              color: theme.text,
              marginTop: 4,
            }}
          />
        </View>

        {/* Notes */}
        <View style={{ marginBottom: 16 }}>
          <ThemedText style={{ color: theme.text }}>Notes</ThemedText>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{
              borderWidth: 1,
              borderColor: theme.goldDeep,
              borderRadius: 8,
              padding: 10,
              color: theme.text,
              marginTop: 4,
              minHeight: 80,
            }}
          />
        </View>

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 12,
            backgroundColor: theme.accent,
            borderWidth: 2,
            borderColor: theme.goldDeep,
          }}
        >
          <ThemedText
            style={{
              color: theme.black,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            {isSaving ? "Saving..." : "Save Flip"}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}
