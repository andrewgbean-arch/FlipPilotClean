import React, { useEffect, useState } from "react";
import { ScrollView, View, Image, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import ThemedText from "@/styles/theme/ThemedText";
import ThemedView from "@/styles/theme/ThemedView";
import { useTheme } from "@/context/ThemeContext";

import { CarRecord } from "./carTypes";
import { getCarById, updateCar } from "./carStorage";
import { getCarProfit, getCarROI, getCarFlipScore } from "./carUtils";

// Services
import { fetchMotData } from "./carMotService";
import { estimateMarketValue } from "./carValuationService";
import { generateAiSummary } from "./carAiService";
import MotBadge from "./components/MotBadge";

export default function CarDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [car, setCar] = useState<CarRecord | undefined>(undefined);

  useEffect(() => {
    if (id) {
      getCarById(id).then(setCar);
    }
  }, [id]);

  if (!car) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ThemedText style={{ color: theme.text }}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  // ⭐ MOT ACTION (now uses car.reg)
  const refreshMot = async () => {
    if (!car.reg) {
      console.log("No registration number found.");
      return;
    }

    const mot = await fetchMotData(car.reg);
    if (!mot) return;

    await updateCar(car.id, { mot });
    setCar({ ...car, mot });
  };

  // ⭐ VALUATION ACTION
  const refreshValuation = async () => {
    const valuation = estimateMarketValue(car);
    await updateCar(car.id, { valuation });
    setCar({ ...car, valuation });
  };

  // ⭐ AI SUMMARY ACTION
  const refreshAiSummary = async () => {
    const aiSummary = await generateAiSummary(car);
    await updateCar(car.id, { aiSummary });
    setCar({ ...car, aiSummary });
  };

  const profit = getCarProfit(car);
  const roi = getCarROI(car);
  const flipScore = getCarFlipScore(car);

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        
        {/* Title */}
        <ThemedText
          style={{
            fontSize: 26,
            fontWeight: "900",
            color: theme.accent,
            marginBottom: 16,
          }}
        >
          {car.make} {car.model} ({car.year})
        </ThemedText>

        {/* Image */}
        {car.imageUri && (
          <Image
            source={{ uri: car.imageUri }}
            style={{
              width: "100%",
              height: 220,
              borderRadius: 16,
              marginBottom: 20,
            }}
            resizeMode="cover"
          />
        )}

        {/* Basic Info */}
        <View style={{ marginBottom: 20 }}>
          <ThemedText style={{ fontSize: 16, color: theme.text }}>
            Registration: {car.reg}
          </ThemedText>
          <ThemedText style={{ fontSize: 16, color: theme.text }}>
            Mileage: {car.mileage.toLocaleString()} miles
          </ThemedText>
          <ThemedText style={{ fontSize: 16, color: theme.text }}>
            Purchase Price: £{car.purchasePrice.toFixed(2)}
          </ThemedText>
          {car.expectedSalePrice && (
            <ThemedText style={{ fontSize: 16, color: theme.text }}>
              Expected Sale Price: £{car.expectedSalePrice.toFixed(2)}
            </ThemedText>
          )}
          {car.salePrice && (
            <ThemedText style={{ fontSize: 16, color: theme.text }}>
              Actual Sale Price: £{car.salePrice.toFixed(2)}
            </ThemedText>
          )}
          <ThemedText style={{ fontSize: 16, color: theme.text }}>
            Condition: {car.condition}
          </ThemedText>
        </View>

        {/* Analytics */}
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: theme.goldDeep,
            backgroundColor: theme.card,
            marginBottom: 20,
          }}
        >
          <ThemedText style={{ fontSize: 20, fontWeight: "900", color: theme.accent, marginBottom: 8 }}>
            📊 Flip Analytics
          </ThemedText>

          <ThemedText style={{ fontSize: 15, color: theme.text }}>
            Profit: £{profit.toFixed(2)}
          </ThemedText>

          <ThemedText style={{ fontSize: 15, color: theme.text }}>
            ROI: {roi.toFixed(1)}%
          </ThemedText>

          <ThemedText style={{ fontSize: 15, color: theme.text }}>
            FlipScore: {flipScore}/100
          </ThemedText>
        </View>

    {/* MOT Section */}
<View
  style={{
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.goldDeep,
    backgroundColor: theme.card,
    marginBottom: 20,
  }}
>
  <MotBadge expiry={car.mot?.expiry} />

  <ThemedText style={{ fontSize: 20, fontWeight: "900", color: theme.accent, marginBottom: 8 }}>
    🔧 MOT History
  </ThemedText>


          {car.mot?.expiry ? (
            <>
              <ThemedText style={{ color: theme.text }}>
                Expiry: {car.mot.expiry}
              </ThemedText>

              {car.mot.mileageHistory?.length ? (
                <View style={{ marginTop: 8 }}>
                  <ThemedText style={{ color: theme.text, marginBottom: 4 }}>
                    Mileage History:
                  </ThemedText>
                  {car.mot.mileageHistory.map((m, idx) => (
                    <ThemedText key={idx} style={{ color: theme.text }}>
                      {m.date}: {m.mileage.toLocaleString()} miles
                    </ThemedText>
                  ))}
                </View>
              ) : null}

              {car.mot.advisories?.length ? (
                <View style={{ marginTop: 8 }}>
                  <ThemedText style={{ color: theme.text, marginBottom: 4 }}>
                    Advisories:
                  </ThemedText>
                  {car.mot.advisories.map((a, idx) => (
                    <ThemedText key={idx} style={{ color: theme.text }}>
                      • {a}
                    </ThemedText>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <ThemedText style={{ color: theme.text }}>
              No MOT data yet.
            </ThemedText>
          )}

          <Pressable
            onPress={refreshMot}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              backgroundColor: theme.accent,
              borderWidth: 2,
              borderColor: theme.goldDeep,
            }}
          >
            <ThemedText style={{ color: theme.black, fontWeight: "900", textAlign: "center" }}>
              Refresh MOT Data
            </ThemedText>
          </Pressable>
        </View>

        {/* Valuation */}
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: theme.goldDeep,
            backgroundColor: theme.card,
            marginBottom: 20,
          }}
        >
          <ThemedText style={{ fontSize: 20, fontWeight: "900", color: theme.accent, marginBottom: 8 }}>
            💷 Market Valuation
          </ThemedText>

          {car.valuation?.estimatedValue ? (
            <>
              <ThemedText style={{ color: theme.text }}>
                Estimated Value: £{car.valuation.estimatedValue.toFixed(2)}
              </ThemedText>

              <ThemedText style={{ color: theme.text }}>
                Confidence: {(car.valuation.confidence ?? 0) * 100}%
              </ThemedText>

              <ThemedText style={{ color: theme.text }}>
                Status: {car.valuation.status}
              </ThemedText>
            </>
          ) : (
            <ThemedText style={{ color: theme.text }}>
              No valuation yet.
            </ThemedText>
          )}

          <Pressable
            onPress={refreshValuation}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              backgroundColor: theme.accent,
              borderWidth: 2,
              borderColor: theme.goldDeep,
            }}
          >
            <ThemedText style={{ color: theme.black, fontWeight: "900", textAlign: "center" }}>
              Refresh Valuation
            </ThemedText>
          </Pressable>
        </View>

        {/* AI Summary */}
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: theme.goldDeep,
            backgroundColor: theme.card,
            marginBottom: 20,
          }}
        >
          <ThemedText style={{ fontSize: 20, fontWeight: "900", color: theme.accent, marginBottom: 8 }}>
            🤖 AI Flip Summary
          </ThemedText>

          {car.aiSummary?.summary ? (
            <>
              <ThemedText style={{ color: theme.text, marginBottom: 8 }}>
                {car.aiSummary.summary}
              </ThemedText>

              <ThemedText style={{ color: theme.text }}>
                Risk Level: {car.aiSummary.riskLevel}
              </ThemedText>

              <ThemedText style={{ color: theme.text }}>
                Demand Score: {car.aiSummary.demandScore}/100
              </ThemedText>

              {car.aiSummary.recommendedSalePrice && (
                <ThemedText style={{ color: theme.text }}>
                  Recommended Sale Price: £{car.aiSummary.recommendedSalePrice.toFixed(2)}
                </ThemedText>
              )}
            </>
          ) : (
            <ThemedText style={{ color: theme.text }}>
              No AI summary yet.
            </ThemedText>
          )}

          <Pressable
            onPress={refreshAiSummary}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              backgroundColor: theme.accent,
              borderWidth: 2,
              borderColor: theme.goldDeep,
            }}
          >
            <ThemedText style={{ color: theme.black, fontWeight: "900", textAlign: "center" }}>
              Generate AI Summary
            </ThemedText>
          </Pressable>
        </View>

        {/* Notes */}
        {car.notes && (
          <View style={{ marginBottom: 20 }}>
            <ThemedText style={{ fontSize: 20, fontWeight: "900", color: theme.accent, marginBottom: 8 }}>
              📝 Notes
            </ThemedText>
            <ThemedText style={{ color: theme.text }}>{car.notes}</ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
