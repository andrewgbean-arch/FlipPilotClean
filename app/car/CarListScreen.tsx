import React, { useEffect, useState } from "react";
import { ScrollView, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { useTheme } from "@/context/ThemeContext";
import ThemedText from "@/styles/theme/ThemedText";
import ThemedView from "@/styles/theme/ThemedView";

import { CarRecord } from "./carTypes";
import { loadCars } from "./carStorage";
import { CarCard } from "./components/CarCard";
import { CarStatPanel } from "./components/CarStatPanel";

export default function CarListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [cars, setCars] = useState<CarRecord[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      loadCars().then(setCars);
    }, [])
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <ThemedText style={{ fontSize: 24, fontWeight: "900", color: theme.accent, marginBottom: 12 }}>
          My Cars
        </ThemedText>

        <Pressable
          onPress={() => router.push("/car/AddCarScreen")}
          style={{
            padding: 14,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: theme.goldDeep,
            backgroundColor: theme.card,
            marginBottom: 16,
          }}
        >
          <ThemedText style={{ fontSize: 16, color: theme.accent, textAlign: "center" }}>
            + Add Car
          </ThemedText>
        </Pressable>

        <CarStatPanel cars={cars} />

        <View style={{ marginTop: 20 }}>
          {cars.map(car => (
            <CarCard
              key={car.id}
              car={car}
              onPress={() => router.push({ pathname: "/car/CarDetailsScreen", params: { id: car.id } })}
            />
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
