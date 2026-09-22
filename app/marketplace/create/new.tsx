import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useTheme } from "../../../src/styles/ThemeContext";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import AnimatedHeroHeader from "../../../src/components/ui/AnimatedHeroHeader";
import GoldButton from "../../../src/components/ui/GoldButton";
import SparklesOverlay from "../../../src/components/ui/SparklesOverlay";

import { aiLookup, BASE_URL } from "../../../src/utils/api";
import { getDeviceId } from "../../../src/utils/deviceId";

const CATEGORIES = [
  { name: "Motors", icon: "🚗" },
  { name: "Electronics", icon: "📱" },
  { name: "Tools", icon: "🛠️" },
  { name: "Books", icon: "📚" },
  { name: "Collectibles", icon: "🎖️" },
  { name: "General", icon: "📦" },
];

export default function CreateNewListing() {
  const theme = useTheme();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Motors");

  const [photos, setPhotos] = useState<string[]>([]);
  const [photoAI, setPhotoAI] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [bestThumbnail, setBestThumbnail] = useState<string | null>(null);
  const [flipScore, setFlipScore] = useState<number | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setPhotos((prev) => [...prev, uri]);
    if (!bestThumbnail) setBestThumbnail(uri);

    setAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      const result2 = await aiLookup(base64);
      const analysis = result2?.ai ?? null;

      setPhotoAI((prev) => [...prev, analysis]);

      if (analysis) {
        // Auto-fill title/category from the first photo's AI read, if the user hasn't typed one yet
        if (!title.trim() && analysis.title) setTitle(analysis.title);
        if (analysis.category) {
          const match = CATEGORIES.find(
            (c) => c.name.toLowerCase() === String(analysis.category).toLowerCase()
          );
          if (match) setCategory(match.name);
        }

        const conditionScore = Number(analysis.conditionScore) || 5; // 1-10
        setFlipScore((prev) =>
          Math.max(20, Math.min(100, (prev ?? 50) + (conditionScore - 5) * 6))
        );
      }
    } catch (err) {
      console.log("Photo analysis error:", err);
      setPhotoAI((prev) => [...prev, null]);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return Alert.alert("Title required");
    if (!price.trim()) return Alert.alert("Price required");
    if (photos.length === 0) return Alert.alert("Add at least one photo");

    try {
      const deviceId = await getDeviceId();
      const payload = {
        title,
        price: Number(price),
        description,
        category,
        photos,
        bestThumbnail,
        flipScore,
        deviceId,
      };

      const res = await fetch(`${BASE_URL}/create-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!data?.ok) {
        if (data?.error === "selling-locked") {
          Alert.alert("Upgrade to sell", data.message, [
            { text: "Not now", style: "cancel" },
            { text: "Upgrade", onPress: () => router.push("/upgrade") },
          ]);
        } else {
          Alert.alert("Couldn't publish", data?.message ?? "Please try again.");
        }
        return;
      }

      router.push("/marketplace");
    } catch (err) {
      Alert.alert("Failed to publish listing");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AnimatedHeroHeader title="Create Listing" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        <SparklesOverlay />

        <Text
          style={{
            color: theme.goldDeep,
            fontSize: 28,
            fontWeight: "900",
            marginBottom: 12,
          }}
        >
          New Listing
        </Text>

        {/* TITLE */}
        <Text style={{ color: theme.text, marginBottom: 6 }}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Ford Fiesta 2014"
          placeholderTextColor={theme.muted}
          style={{
            backgroundColor: theme.card,
            color: theme.white,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.goldDeep,
            marginBottom: 16,
          }}
        />

        {/* PRICE */}
        <Text style={{ color: theme.text, marginBottom: 6 }}>Price (£)</Text>
        <TextInput
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          placeholder="e.g. 2495"
          placeholderTextColor={theme.muted}
          style={{
            backgroundColor: theme.card,
            color: theme.white,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.goldDeep,
            marginBottom: 16,
          }}
        />

        {/* DESCRIPTION */}
        <Text style={{ color: theme.text, marginBottom: 6 }}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Describe the item..."
          placeholderTextColor={theme.muted}
          style={{
            backgroundColor: theme.card,
            color: theme.white,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.goldDeep,
            minHeight: 120,
            marginBottom: 20,
          }}
        />

        {/* CATEGORY */}
        <Text style={{ color: theme.text, marginBottom: 6 }}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {CATEGORIES.map((cat) => {
            const active = category === cat.name;
            return (
              <TouchableOpacity
                key={cat.name}
                onPress={() => setCategory(cat.name)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: theme.goldDeep,
                  backgroundColor: active ? theme.goldDeep : theme.card,
                  marginRight: 10,
                }}
              >
                <Text
                  style={{
                    color: active ? theme.black : theme.white,
                    fontWeight: "700",
                  }}
                >
                  {cat.icon} {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* PHOTOS + AI */}
        <Text style={{ color: theme.text, marginBottom: 6 }}>Photos & AI Analysis</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {photos.map((uri, idx) => (
            <View key={idx} style={{ marginRight: 10 }}>
              <View style={{ position: "relative" }}>
                <Image
                  source={{ uri }}
                  style={{
                    width: 140,
                    height: 140,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.goldDeep,
                  }}
                />
              </View>

              <View style={{ marginTop: 6, width: 140 }}>
                {photoAI[idx] ? (
                  <>
                    <Text style={{ color: theme.goldDeep, fontWeight: "700" }} numberOfLines={1}>
                      {photoAI[idx]?.title ?? "Identified"}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 12 }}>
                      Condition: {photoAI[idx]?.condition ?? "Unknown"}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 12 }}>
                      {photoAI[idx]?.confidence != null
                        ? `${photoAI[idx].confidence}% confidence`
                        : ""}
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: theme.muted, fontSize: 12 }}>Analysing…</Text>
                )}

                {bestThumbnail === uri && (
                  <Text style={{ color: theme.goldDeep, fontWeight: "900", marginTop: 4 }}>
                    ⭐ Cover Photo
                  </Text>
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity
            onPress={pickImage}
            disabled={analyzing}
            style={{
              width: 100,
              height: 100,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.goldDeep,
              backgroundColor: theme.card,
              justifyContent: "center",
              alignItems: "center",
              opacity: analyzing ? 0.6 : 1,
            }}
          >
            <Text style={{ color: theme.goldDeep, fontWeight: "700" }}>
              {analyzing ? "…" : "+ Add"}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* FLIPSCORE */}
        {flipScore != null && (
          <View
            style={{
              backgroundColor: theme.card,
              padding: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.goldDeep,
              marginBottom: 20,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>
              FlipScore Preview: {flipScore}/100
            </Text>
            <Text style={{ color: theme.muted, marginTop: 4 }}>
              Based on AI-assessed condition of your photos.
            </Text>
          </View>
        )}

       <GoldButton onPress={handleSubmit}>
  Publish Listing
</GoldButton>

      </ScrollView>
    </View>
  );
}
