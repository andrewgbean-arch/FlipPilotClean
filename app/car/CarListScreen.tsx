import React, { useEffect, useState } from "react";
import { ScrollView, View, Pressable, AppState } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import ThemedText from "@/src/styles/theme/ThemedText";
import ThemedView from "@/src/styles/theme/ThemedView";
import { CarRecord } from "../../src/car/carTypes";
import { loadCars } from "../../src/car/carStorage";
import { CarCard } from "./components/CarCard";
import { CarStatPanel } from "./components/CarStatPanel";

export default function CarListScreen() {
  const theme = useTheme();
  const [cars, setCars] = useState<CarRecord[]>([]);

  // Load cars on mount
  useEffect(() => {
    loadCars().then(setCars);
  }, []);

  // Reload cars when returning to the app
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadCars().then(setCars);
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <ThemedText
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: theme.accent,
            marginBottom: 12,
          }}
        >
          My Cars
        </ThemedText>

        <Pressable
          onPress={() => router.push("/car/addCarScreen")}
          style={{
            padding: 14,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: theme.goldDeep,
            backgroundColor: theme.card,
            marginBottom: 16,
          }}
        >
          <ThemedText
            style={{
              fontSize: 16,
              color: theme.accent,
              textAlign: "center",
            }}
          >
            + Add Car
          </ThemedText>
        </Pressable>

        <CarStatPanel cars={cars} />

        <View style={{ marginTop: 20 }}>
          {cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              onPress={() =>
                router.push({
                  pathname: "/car/CarDetailsScreen",
                  params: { id: car.id },
                })
              }
            />
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
