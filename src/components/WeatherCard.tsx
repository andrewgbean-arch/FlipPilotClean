import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import * as Location from "expo-location";
import ThemedView from "./ThemedView";
import ThemedText from "./ThemedText";

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------
interface WeatherCardProps {
  theme: any;
}

interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
}

// ------------------------------------------------------
// COMPONENT
// ------------------------------------------------------
export default function WeatherCard({ theme }: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
        );
        const data = await res.json();

        setWeather(data.current_weather);
      } catch (e) {
        console.log("Weather error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <ThemedView style={[styles.card, { backgroundColor: theme.card }]}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  if (!weather) return null;

  return (
    <ThemedView
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.goldDeep, borderWidth: 3 },
      ]}
    >
      <ThemedText style={[styles.title, { color: theme.accent }]}>
        Weather Nearby
      </ThemedText>

      <ThemedText style={styles.text}>
        Temp: {weather.temperature}°C
      </ThemedText>

      <ThemedText style={styles.text}>
        Wind: {weather.windspeed} km/h
      </ThemedText>

      <ThemedText style={styles.text}>
        Conditions: {weather.weathercode < 3 ? "Clear" : "Cloudy"}
      </ThemedText>

      <ThemedText style={[styles.tip, { color: theme.accent }]}>
        {weather.temperature > 12
          ? "Great day for a boot fair"
          : "Might be chilly out there"}
      </ThemedText>
    </ThemedView>
  );
}

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    width: "92%",
    alignSelf: "center",
    padding: 18,
    borderRadius: 20,
    marginTop: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  text: {
    color: "white",
    fontSize: 15,
    marginBottom: 4,
  },
  tip: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
  },
});
