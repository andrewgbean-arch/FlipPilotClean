import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import * as Location from "expo-location";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  MapPin,
  Snowflake,
  Sun,
  Wind,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------
interface WeatherCardProps {
  theme: any;
  style?: StyleProp<ViewStyle>;
}

interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
}

type State =
  | { kind: "checking" }
  | { kind: "ask" }
  | { kind: "loading" }
  | { kind: "ready"; weather: WeatherData }
  | { kind: "unavailable" };

const REQUEST_TIMEOUT_MS = 10_000;

// ------------------------------------------------------
// WMO weather codes, as returned by Open-Meteo
// ------------------------------------------------------
function describeWeather(code: number): { label: string; Icon: PhosphorIcon; wet: boolean } {
  if (code === 0) return { label: "Clear", Icon: Sun, wet: false };
  if (code === 1) return { label: "Mostly clear", Icon: Sun, wet: false };
  if (code === 2) return { label: "Partly cloudy", Icon: CloudSun, wet: false };
  if (code === 3) return { label: "Overcast", Icon: Cloud, wet: false };
  if (code === 45 || code === 48) return { label: "Foggy", Icon: CloudFog, wet: false };
  if (code >= 51 && code <= 57) return { label: "Drizzle", Icon: CloudRain, wet: true };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { label: "Rain", Icon: CloudRain, wet: true };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { label: "Snow", Icon: Snowflake, wet: true };
  }
  if (code >= 95) return { label: "Thunderstorms", Icon: CloudLightning, wet: true };
  return { label: "Mixed conditions", Icon: Cloud, wet: false };
}

// Advice for someone selling at a boot fair: rain and wind matter as much as warmth.
function bootFairTip(weather: WeatherData, wet: boolean): string {
  if (wet) return "Wet out there. Bring a coat and cover for your stock.";
  if (weather.windspeed >= 40) return "Very windy. Weigh down your stall.";
  if (weather.temperature <= 12) return "A bit chilly. Wrap up warm.";
  return "Good conditions for a boot fair.";
}

async function fetchWeather(): Promise<WeatherData | null> {
  const position = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), REQUEST_TIMEOUT_MS)),
  ]);
  if (!position) return null;

  const { latitude, longitude } = position.coords;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;

    const current = (await res.json())?.current_weather;
    if (
      typeof current?.temperature !== "number" ||
      typeof current?.windspeed !== "number" ||
      typeof current?.weathercode !== "number"
    ) {
      return null;
    }

    return {
      temperature: current.temperature,
      windspeed: current.windspeed,
      weathercode: current.weathercode,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------
// COMPONENT
// ------------------------------------------------------
export default function WeatherCard({ theme, style }: WeatherCardProps) {
  const [state, setState] = useState<State>({ kind: "checking" });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setState({ kind: "loading" });

    try {
      const weather = await fetchWeather();
      if (!mounted.current) return;
      setState(weather ? { kind: "ready", weather } : { kind: "unavailable" });
    } catch (e) {
      console.log("Weather error:", e);
      if (mounted.current) setState({ kind: "unavailable" });
    }
  }, []);

  // Look at the permission without asking for it. The system prompt only appears once the
  // person has read why we want their location and tapped the button below.
  useEffect(() => {
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!mounted.current) return;

        if (permission.granted) load();
        else if (permission.canAskAgain) setState({ kind: "ask" });
        else setState({ kind: "unavailable" });
      } catch (e) {
        console.log("Weather permission error:", e);
        if (mounted.current) setState({ kind: "unavailable" });
      }
    })();
  }, [load]);

  const enableLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted.current) return;

      if (permission.granted) load();
      else setState({ kind: "unavailable" });
    } catch (e) {
      console.log("Weather permission error:", e);
      if (mounted.current) setState({ kind: "unavailable" });
    }
  };

  const card = [styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }, style];

  if (state.kind === "checking" || state.kind === "unavailable") return null;

  if (state.kind === "loading") {
    return (
      <View style={[card, styles.loadingRow]}>
        <ActivityIndicator color={theme.gold} />
        <Text style={[styles.secondary, { color: theme.muted }]}>Checking the weather…</Text>
      </View>
    );
  }

  if (state.kind === "ask") {
    return (
      <View style={card}>
        <View style={styles.header}>
          <MapPin size={20} color={theme.gold} />
          <Text style={[styles.title, { color: theme.text }]}>Weather for boot fairs</Text>
        </View>
        <Text style={[styles.secondary, { color: theme.muted }]}>
          Share your location to see local conditions before you head out. It is only used to look up
          the weather.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enable location for weather"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={enableLocation}
        >
          <Text style={[styles.buttonText, { color: theme.black }]}>Enable location</Text>
        </Pressable>
      </View>
    );
  }

  const { weather } = state;
  const { label, Icon, wet } = describeWeather(weather.weathercode);
  const tip = bootFairTip(weather, wet);
  const temperature = Math.round(weather.temperature);
  const wind = Math.round(weather.windspeed);

  return (
    <View
      accessible
      accessibilityLabel={`Weather nearby: ${temperature} degrees, ${label}, wind ${wind} kilometres per hour. ${tip}`}
      style={card}
    >
      <View style={styles.header}>
        <Icon size={20} color={theme.gold} />
        <Text style={[styles.title, { color: theme.text }]}>Weather nearby</Text>
      </View>

      <View style={styles.mainRow}>
        <Text style={[styles.temperature, { color: theme.text }]}>{temperature}°C</Text>
        <View style={styles.conditions}>
          <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
          <View style={styles.windRow}>
            <Wind size={14} color={theme.muted} />
            <Text style={[styles.secondary, { color: theme.muted }]}>{wind} km/h</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.tip, { color: theme.muted, borderTopColor: theme.hairline }]}>{tip}</Text>
    </View>
  );
}

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  temperature: {
    fontSize: 34,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  conditions: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  windRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secondary: {
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  tip: {
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  button: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
});
