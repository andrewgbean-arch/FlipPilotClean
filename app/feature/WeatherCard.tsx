import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import * as Location from "expo-location";

import ThemedView from "@/styles/theme/ThemedView";
import ThemedText from "@/styles/theme/ThemedText";
import { useTheme } from "@/context/ThemeContext";

export default function WeatherCard() {
  const theme = useTheme();

  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied");
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;

        const res = await fetch(url);
        const data = await res.json();

        setWeather(data.current_weather);
      } catch (e) {
        setError("Unable to load weather");
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

  if (error || !weather) {
    return (
      <ThemedView style={[styles.card, { backgroundColor: theme.card }]}>
        <ThemedText style={{ color: theme.accent }}>{error}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.goldDeep,
          borderWidth: 3,
        },
      ]}
    >
      <ThemedText style={[styles.title, { color: theme.accent }]}>
        Local Weather
      </ThemedText>

      <ThemedText style={[styles.value, { color: theme.accent }]}>
        {weather.temperature}°C — {weather.weathercode}
      </ThemedText>

      <ThemedText style={[styles.sub, { color: theme.accent }]}>
        Wind: {weather.windspeed} km/h
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },
  value: {
    fontSize: 32,
    fontWeight: "900",
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.85,
  },
});
