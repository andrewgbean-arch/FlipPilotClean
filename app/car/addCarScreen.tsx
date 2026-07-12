import React, { useState } from "react";
import { View, TextInput, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { CarCondition, CarRecord } from "./carTypes";
import { addCar } from "./carStorage";
import ThemedText from "@/styles/theme/ThemedText";
import ThemedView from "@/styles/theme/ThemedView";
import { useTheme } from "@/context/ThemeContext";
import { v4 as uuid } from "uuid";

export default function AddCarScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [reg, setReg] = useState(""); // ⭐ NEW REQUIRED FIELD
  const [purchasePrice, setPurchasePrice] = useState("");
  const [expectedSalePrice, setExpectedSalePrice] = useState("");
  const [condition, setCondition] = useState<CarCondition>("good");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);

  const onSave = async () => {
    const car: CarRecord = {
      id: uuid(),
      make,
      model,
      year: Number(year),
      mileage: Number(mileage),
      reg, // ⭐ REQUIRED
      purchasePrice: Number(purchasePrice),
      expectedSalePrice: expectedSalePrice ? Number(expectedSalePrice) : undefined,
      condition,
      notes,
      imageUri,

      mot: {
        expiry: undefined,
        mileageHistory: [],
        advisories: [],
        failures: [],
        lastChecked: undefined, // ⭐ FIXED (was lastUpdated)
      },

      valuation: {
        estimatedValue: undefined,
        confidence: undefined,
        status: undefined,
        lastUpdated: undefined,
      },

      aiSummary: {
        summary: undefined,
        riskLevel: undefined,
        recommendedSalePrice: undefined,
        demandScore: undefined,
        lastUpdated: undefined,
      },

      analytics: {
        roi: undefined,
        profit: undefined,
        flipScore: undefined,
        updatedAt: undefined,
      },

      createdAt: new Date().toISOString(),
    };

    await addCar(car);
    router.back();
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <ThemedText style={{ fontSize: 22, fontWeight: "900", color: theme.accent, marginBottom: 16 }}>
          Add Car
        </ThemedText>

        {[
          { label: "Make", value: make, setter: setMake },
          { label: "Model", value: model, setter: setModel },
          { label: "Year", value: year, setter: setYear, keyboardType: "numeric" as const },
          { label: "Mileage", value: mileage, setter: setMileage, keyboardType: "numeric" as const },
          { label: "Registration", value: reg, setter: setReg }, // ⭐ NEW INPUT FIELD
          { label: "Purchase Price", value: purchasePrice, setter: setPurchasePrice, keyboardType: "numeric" as const },
          { label: "Expected Sale Price", value: expectedSalePrice, setter: setExpectedSalePrice, keyboardType: "numeric" as const },
        ].map((field, idx) => (
          <View key={idx} style={{ marginBottom: 12 }}>
            <ThemedText style={{ fontSize: 14, color: theme.text, marginBottom: 4 }}>
              {field.label}
            </ThemedText>
            <TextInput
              value={field.value}
              onChangeText={field.setter}
              keyboardType={field.keyboardType ?? "default"}
              style={{
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.goldDeep,
                color: theme.text,
                backgroundColor: theme.card,
              }}
            />
          </View>
        ))}

        <View style={{ marginBottom: 12 }}>
          <ThemedText style={{ fontSize: 14, color: theme.text, marginBottom: 4 }}>
            Condition
          </ThemedText>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["poor", "fair", "good", "excellent"] as CarCondition[]).map(c => (
              <Pressable
                key={c}
                onPress={() => setCondition(c)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: condition === c ? theme.goldDeep : theme.text,
                  backgroundColor: condition === c ? theme.goldDeep + "33" : theme.card,
                }}
              >
                <ThemedText style={{ color: theme.text }}>{c}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <ThemedText style={{ fontSize: 14, color: theme.text, marginBottom: 4 }}>
            Notes
          </ThemedText>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.goldDeep,
              color: theme.text,
              backgroundColor: theme.card,
              minHeight: 80,
            }}
          />
        </View>

        <Pressable
          onPress={onSave}
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: theme.accent,
            borderWidth: 3,
            borderColor: theme.goldDeep,
          }}
        >
          <ThemedText style={{ fontSize: 18, fontWeight: "900", color: theme.black, textAlign: "center" }}>
            Save Car
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}
