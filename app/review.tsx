import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, TextInput, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

const NAVY = "#0A1128";
const GOLD = "#FFD700";
const BLUE = "#1e90ff";

export default function ReviewScreen() {
  const router = useRouter();

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [warning, setWarning] = useState(false);

  const starScale = useRef([...Array(5)].map(() => new Animated.Value(1))).current;

  const animateStar = (index: number) => {
    Animated.sequence([
      Animated.spring(starScale[index], { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(starScale[index], { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const handleStarPress = (index: number) => {
    setRating(index + 1);
    animateStar(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const submitReview = async () => {
    if (rating === 0 || !reviewText.trim()) {
      setWarning(true);
      return;
    }

    try {
      const existing = await AsyncStorage.getItem("reviews");
      const arr = existing ? JSON.parse(existing) : [];

      arr.push({
        id: Date.now().toString(),
        rating,
        text: reviewText.trim(),
        timestamp: new Date().toISOString(),
      });

      await AsyncStorage.setItem("reviews", JSON.stringify(arr));
    } catch {}

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Rate / Review FlipPilot</Text>
      <Text style={styles.subtitle}>Your feedback helps us grow stronger.</Text>

      {/* ⭐ STAR RATING */}
      <View style={styles.starRow}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Pressable key={i} onPress={() => handleStarPress(i)}>
            <Animated.Text
              style={[
                styles.star,
                {
                  transform: [{ scale: starScale[i] }],
                  color: rating > i ? GOLD : "#555",
                },
              ]}
            >
              ★
            </Animated.Text>
          </Pressable>
        ))}
      </View>

      {/* ⭐ REVIEW INPUT */}
      <TextInput
        style={styles.input}
        multiline
        placeholder="Write your review..."
        placeholderTextColor="#889"
        value={reviewText}
        onChangeText={(t) => {
          setReviewText(t);
          if (warning) setWarning(false);
        }}
      />

      {warning && (
        <Text style={styles.warning}>Please select a rating and write a review</Text>
      )}

      {/* ⭐ SUBMIT BUTTON */}
      <Pressable style={styles.submitButton} onPress={submitReview}>
        <Text style={styles.submitText}>Submit Review</Text>
      </Pressable>

      {/* ⭐ CANCEL */}
      <Pressable style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingTop: 40,
  },

  title: {
    color: "white",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: "#AFC6FF",
    fontSize: 15,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },

  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 20,
  },

  star: {
    fontSize: 48,
    marginHorizontal: 8,
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "white",
    borderRadius: 16,
    padding: 14,
    minHeight: 120,
    textAlignVertical: "top",
    fontSize: 16,
  },

  warning: {
    color: "#FF8080",
    marginTop: 10,
    textAlign: "center",
    fontWeight: "700",
  },

  submitButton: {
    marginTop: 20,
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: GOLD,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },

  submitText: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "900",
  },

  cancelButton: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#333",
  },

  cancelText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
});
