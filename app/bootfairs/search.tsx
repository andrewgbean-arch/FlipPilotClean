import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { fairs } from "../../src/lib/fairs";

const API_URL = "https://api.postcodes.io/postcodes/";

export default function BootfairSearchResults() {
  const { postcode, radius } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postcode) {
      setError("No postcode provided.");
      setLoading(false);
      return;
    }

    fetch(API_URL + postcode)
      .then((res) => res.json())
      .then((data) => {
        if (!data.result) {
          setError("Invalid postcode.");
          setLoading(false);
          return;
        }

        const coords = {
          lat: data.result.latitude,
          lng: data.result.longitude,
        };

        setUserCoords(coords);

        const filtered = fairs
          .map((fair) => {
            const d = distanceMiles(coords.lat, coords.lng, fair.lat, fair.lng);
            return { ...fair, distance: d };
          })
          .filter((f) => f.distance <= Number(radius))
          .sort((a, b) => a.distance - b.distance);

        setResults(filtered);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to fetch postcode data.");
        setLoading(false);
      });
  }, [postcode, radius]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Searching bootfairs…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Results near {postcode} ({radius} miles)
      </Text>

      {results.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.noResults}>No bootfairs found in this area.</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/bootfairs/details",
                  params: { id: item.id },
                })
              }
            >
              {item.images?.[0] && (
                <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
              )}

              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSub}>{item.postcode}</Text>
              <Text style={styles.cardSub}>{item.nextDate}</Text>

              <Text style={styles.distanceText}>
                {item.distance.toFixed(1)} miles away
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

/* ------------------------------
   DISTANCE CALCULATION (Haversine)
--------------------------------*/
function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ------------------------------
   STYLES
--------------------------------*/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A1128",
  },
  header: {
    color: "#FFD700",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 20,
    textAlign: "center",
  },
  loadingText: {
    color: "#FFD700",
    marginTop: 10,
  },
  errorText: {
    color: "#FFD700",
    fontSize: 18,
    marginBottom: 20,
  },
  noResults: {
    color: "#AFC6FF",
    fontSize: 16,
    marginTop: 20,
  },
  backButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  backButtonText: {
    color: "#0A1128",
    fontWeight: "900",
  },
  card: {
    backgroundColor: "#112240",
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  cardImage: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    marginBottom: 10,
  },
  cardTitle: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "900",
  },
  cardSub: {
    color: "#AFC6FF",
    marginBottom: 2,
  },
  distanceText: {
    color: "#00E676",
    fontWeight: "900",
    marginTop: 6,
  },
});
