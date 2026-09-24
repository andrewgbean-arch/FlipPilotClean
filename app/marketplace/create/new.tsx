import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { useTheme } from "../../../src/styles/ThemeContext";
import AnimatedHeroHeader from "../../../src/components/ui/AnimatedHeroHeader";
import SparklesOverlay from "../../../src/components/ui/SparklesOverlay";

import { identifyPhoto, BASE_URL } from "../../../src/utils/api";
import { uploadPhotos } from "../../../src/utils/uploadPhotos";
import { getDeviceId } from "../../../src/utils/deviceId";
import { deviceRegionHints } from "../../../src/utils/deviceRegion";
import { getSellerName } from "../../../src/utils/sellerName";
import { listingFromFlip } from "../../../src/utils/listingFromFlip";
import { useVehicleHistory } from "../../../src/features/vehicles/context/VehicleHistoryContext";
import { SELLER_SAFETY_TIPS } from "../../../src/utils/scamSafety";
import SafetyCard from "../../../src/components/marketplace/SafetyCard";
import {
  MARKETPLACE_CATEGORIES,
  CategoryField,
  MarketplaceCategory,
  fieldsFor,
  getCategory,
  matchCategory,
  missingRequiredFields,
} from "../../../src/constants/marketplaceCategories";

export default function CreateNewListing() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ category?: string; fromFlip?: string }>();
  const { vehicles } = useVehicleHistory();

  // Selling something already saved in History or Favourites: its photo and
  // everything the scan worked out come across, so there is nothing to retype.
  const flip = params.fromFlip
    ? vehicles.find((v) => v.id === params.fromFlip) ?? null
    : null;
  const draft = useMemo(() => (flip ? listingFromFlip(flip) : null), [flip?.id]);

  // Preselected when you arrive from a category tile or a saved flip. Otherwise
  // nothing is chosen for you — an item filed in the wrong place never gets found.
  const [category, setCategory] = useState<string | null>(
    getCategory(params.category)?.id ?? draft?.category ?? null
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const [title, setTitle] = useState(draft?.title ?? "");
  const [price, setPrice] = useState(draft?.price ?? "");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [details, setDetails] = useState<Record<string, string>>(draft?.details ?? {});

  const [photos, setPhotos] = useState<string[]>(draft?.photos ?? []);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggested, setSuggested] = useState<MarketplaceCategory | null>(null);
  const [publishing, setPublishing] = useState(false);
  // The launch offer and the limits, from the server.
  const [policy, setPolicy] = useState<{
    promoActive: boolean;
    promoEndsAt: string | null;
    carCreditCost: number;
    freeActiveItemsAfterPromo: number;
  } | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/marketplace/policy`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPolicy(data?.ok ? data : null))
      .catch(() => setPolicy(null));
  }, []);

  // Saved flips are read from storage, so on the first render there is usually
  // nothing to copy from yet. Fill the form in once the flip turns up, and only
  // once, so it never overwrites something already typed.
  const filledFrom = useRef<string | null>(null);
  useEffect(() => {
    if (!draft || !flip || filledFrom.current === flip.id) return;
    filledFrom.current = flip.id;

    setPhotos(draft.photos);
    setTitle(draft.title);
    setPrice(draft.price);
    setDescription(draft.description);
    setDetails(draft.details);
    if (draft.category) setCategory((prev) => prev ?? draft.category);
  }, [draft, flip]);

  const chosen = getCategory(category);
  const fields = useMemo(() => fieldsFor(category), [category]);

  const setDetail = (key: string, value: string) =>
    setDetails((prev) => ({ ...prev, [key]: value }));

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const isFirst = photos.length === 0;
    setPhotos((prev) => [...prev, uri]);

    // The first photo is the one we read, to fill in what we can.
    if (!isFirst) return;

    setAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      // Identify only (no price lookup): what it is, its category and condition.
      // Marketplace screens must not touch eBay-derived prices.
      const identified = await identifyPhoto(base64);
      const analysis = identified?.ok ? identified : null;
      if (!analysis) return;

      if (!title.trim() && analysis.title) setTitle(String(analysis.title));

      // Guess from what it was called, then from the title as a fallback.
      const guess = matchCategory(analysis.category) ?? matchCategory(analysis.title);
      if (guess) {
        setSuggested(guess);
        setCategory((prev) => prev ?? guess.id);
      }

      if (analysis.condition && !details.condition) {
        const named = String(analysis.condition).trim().toLowerCase();
        const match = fieldsFor(guess?.id ?? category)
          .find((f) => f.key === "condition")
          ?.options?.find((o) => o.toLowerCase() === named);
        if (match) setDetail("condition", match);
      }
    } catch (err) {
      console.log("Photo analysis error:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const removePhoto = (uri: string) =>
    setPhotos((prev) => prev.filter((p) => p !== uri));

  const missing = missingRequiredFields(category, details);

  // Everything still missing, in the order the form asks for it.
  const stillNeeded: string[] = [];
  if (photos.length === 0) stillNeeded.push("a photo");
  if (!title.trim()) stillNeeded.push("a title");
  if (!price.trim() || !Number(price)) stillNeeded.push("a price");
  if (!category) stillNeeded.push("a category");
  if (!location.trim()) stillNeeded.push("where it is");
  for (const field of missing) stillNeeded.push(field.label.toLowerCase());

  const incomplete = stillNeeded.length > 0;

  const handleSubmit = async () => {
    if (incomplete) {
      return Alert.alert("Almost there", `Still needed: ${stillNeeded.join(", ")}.`);
    }

    setPublishing(true);
    try {
      const deviceId = await getDeviceId();

      // Only the questions this category actually asked get stored.
      const kept: Record<string, string> = {};
      for (const f of fields) {
        const value = String(details[f.key] ?? "").trim();
        if (value) kept[f.key] = value;
      }

      // The server only keeps photos this phone uploaded to it, so they go
      // first; a phone's own file path is no use to a buyer.
      let uploaded: string[];
      try {
        uploaded = await uploadPhotos(photos);
      } catch (err: any) {
        Alert.alert(
          "Couldn't upload your photos",
          typeof err?.message === "string" && err.message
            ? err.message
            : "Check your connection and try again."
        );
        return;
      }

      const res = await fetch(`${BASE_URL}/create-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          price: Number(price),
          description: description.trim(),
          category,
          location: location.trim(),
          condition: kept.condition ?? null,
          details: kept,
          photos: uploaded,
          deviceId,
          // What they chose to be called, if they have set one in Settings.
          sellerName: await getSellerName(),
          ...deviceRegionHints(),
        }),
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
      Alert.alert("Couldn't publish", "Check your connection and try again.");
    } finally {
      setPublishing(false);
    }
  };

  /* ---------------- field rendering ---------------- */

  const inputStyle = {
    backgroundColor: theme.card,
    color: theme.white,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.goldDeep,
  } as const;

  const labelFor = (f: CategoryField) => (
    <Text style={{ color: theme.text, marginBottom: 6 }}>
      {f.label}
      {f.required ? <Text style={{ color: theme.goldDeep }}> *</Text> : null}
    </Text>
  );

  const renderField = (f: CategoryField) => {
    if (f.type === "choice") {
      return (
        <View key={f.key} style={{ marginBottom: 16 }}>
          {labelFor(f)}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(f.options ?? []).map((option) => {
              const active = details[f.key] === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setDetail(f.key, active ? "" : option)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: theme.goldDeep,
                    backgroundColor: active ? theme.goldDeep : theme.card,
                  }}
                >
                  <Text
                    style={{
                      color: active ? theme.black : theme.white,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    return (
      <View key={f.key} style={{ marginBottom: 16 }}>
        {labelFor(f)}
        <TextInput
          value={details[f.key] ?? ""}
          onChangeText={(v) => setDetail(f.key, v)}
          placeholder={f.placeholder ?? ""}
          placeholderTextColor={theme.muted}
          keyboardType={f.type === "number" ? "numeric" : "default"}
          multiline={f.multiline}
          style={[
            inputStyle,
            f.multiline ? { minHeight: 80, textAlignVertical: "top" as const } : null,
          ]}
        />
      </View>
    );
  };

  /* ---------------- category picker ---------------- */

  const pickerResults = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return MARKETPLACE_CATEGORIES;
    return MARKETPLACE_CATEGORIES.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q) || q.includes(k))
    );
  }, [pickerSearch]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AnimatedHeroHeader title="Sell something" />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <SparklesOverlay />

        <Text
          style={{
            color: theme.goldDeep,
            fontSize: 26,
            fontWeight: "900",
            marginBottom: 4,
          }}
        >
          New listing
        </Text>
        <Text style={{ color: theme.muted, marginBottom: 18 }}>
          {flip
            ? "Brought over from your saved flip. Check it over, add where it is, and it is ready."
            : "A photo, a price and the right category. The rest takes a minute."}
        </Text>

        {/* The launch offer, and the one-car rule, so neither is a surprise */}
        {policy ? (
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.goldSoftGlow,
              padding: 12,
              marginBottom: 18,
            }}
          >
            <Text style={{ color: theme.goldDeep, fontWeight: "800", marginBottom: 2 }}>
              {policy.promoActive
                ? policy.promoEndsAt
                  ? `Free for everyone until ${new Date(policy.promoEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                  : "Free for everyone during our launch"
                : "Listings"}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 19 }}>
              {policy.promoActive
                ? `One car for sale at a time. After the launch offer, a car costs ${policy.carCreditCost} credits.`
                : `One car for sale at a time, costing ${policy.carCreditCost} credits. ${policy.freeActiveItemsAfterPromo} items can be for sale free at once.`}
            </Text>
          </View>
        ) : null}

        {/* PHOTOS */}
        <Text style={{ color: theme.text, marginBottom: 6 }}>
          Photos<Text style={{ color: theme.goldDeep }}> *</Text>
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {photos.map((uri) => (
            <TouchableOpacity
              key={uri}
              onLongPress={() => removePhoto(uri)}
              style={{ marginRight: 10 }}
            >
              <Image source={{ uri }} style={{ width: 92, height: 92, borderRadius: 12 }} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={pickImage}
            style={{
              width: 92,
              height: 92,
              borderRadius: 12,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: theme.goldDeep,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.card,
            }}
          >
            <Text style={{ color: theme.goldDeep, fontSize: 28 }}>+</Text>
          </TouchableOpacity>
        </ScrollView>
        <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 18 }}>
          {photos.length > 0
            ? "Press and hold a photo to remove it."
            : "The first one is what buyers see in the list."}
        </Text>

        {analyzing && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <ActivityIndicator color={theme.goldDeep} />
            <Text style={{ color: theme.muted }}>Reading your photo…</Text>
          </View>
        )}

        {/* CATEGORY */}
        <Text style={{ color: theme.text, marginBottom: 6 }}>
          Category<Text style={{ color: theme.goldDeep }}> *</Text>
        </Text>
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: theme.card,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: chosen ? theme.goldDeep : theme.danger,
          }}
        >
          <Text style={{ color: chosen ? theme.white : theme.muted, fontSize: 15 }}>
            {chosen ? `${chosen.emoji}  ${chosen.label}` : "Choose a category"}
          </Text>
          <Text style={{ color: theme.goldDeep, fontWeight: "700" }}>
            {chosen ? "Change" : "Choose"}
          </Text>
        </TouchableOpacity>

        {suggested && chosen?.id === suggested.id && (
          <Text style={{ color: theme.muted, fontSize: 12, marginTop: 6 }}>
            Suggested from your photo. Change it if it is wrong.
          </Text>
        )}
        <View style={{ height: 18 }} />

        {/* TITLE */}
        <Text style={{ color: theme.text, marginBottom: 6 }}>
          Title<Text style={{ color: theme.goldDeep }}> *</Text>
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What is it? Brand and model if you know them"
          placeholderTextColor={theme.muted}
          style={[inputStyle, { marginBottom: 16 }]}
        />

        {/* PRICE + LOCATION */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, marginBottom: 6 }}>
              Price (£)<Text style={{ color: theme.goldDeep }}> *</Text>
            </Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="e.g. 45"
              placeholderTextColor={theme.muted}
              style={inputStyle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, marginBottom: 6 }}>
              Location<Text style={{ color: theme.goldDeep }}> *</Text>
            </Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Paignton"
              placeholderTextColor={theme.muted}
              style={inputStyle}
            />
          </View>
        </View>

        {/* CATEGORY QUESTIONS */}
        {chosen && (
          <>
            <Text
              style={{
                color: theme.goldDeep,
                fontSize: 18,
                fontWeight: "800",
                marginBottom: 4,
              }}
            >
              About your {chosen.label.toLowerCase()}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 14 }}>
              What buyers ask before they message you.
            </Text>
            {fields.map(renderField)}
          </>
        )}

        {/* DESCRIPTION */}
        <Text style={{ color: theme.text, marginBottom: 6 }}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Anything else worth knowing"
          placeholderTextColor={theme.muted}
          style={[
            inputStyle,
            { minHeight: 100, textAlignVertical: "top" as const, marginBottom: 20 },
          ]}
        />

        {/* SAFETY — open, because this is the moment it matters */}
        <SafetyCard title="Selling safely" tips={SELLER_SAFETY_TIPS} startOpen />

        {/* PUBLISH */}
        {incomplete && !publishing ? (
          <Text style={{ color: theme.muted, textAlign: "center", marginBottom: 10 }}>
            Still needed: {stillNeeded.join(", ")}
          </Text>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Publish listing"
          onPress={handleSubmit}
          disabled={publishing}
          style={{
            backgroundColor: theme.goldDeep,
            padding: 16,
            borderRadius: 14,
            alignItems: "center",
            // Dimmed while something is missing, but still a "Publish" button
            // that says what is missing when tapped.
            opacity: publishing ? 0.6 : incomplete ? 0.65 : 1,
          }}
        >
          <Text style={{ color: theme.black, fontWeight: "900", fontSize: 16 }}>
            {publishing ? "Publishing…" : "Publish listing"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* CATEGORY PICKER */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <Text style={{ color: theme.goldDeep, fontSize: 22, fontWeight: "900" }}>
              Category
            </Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Text style={{ color: theme.white, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            value={pickerSearch}
            onChangeText={setPickerSearch}
            placeholder="Type what it is — sofa, iPhone, trainers…"
            placeholderTextColor={theme.muted}
            style={[inputStyle, { marginBottom: 14 }]}
          />

          <ScrollView>
            {pickerResults.length === 0 && (
              <Text style={{ color: theme.muted }}>
                Nothing matches that. Try another word, or pick Everything Else.
              </Text>
            )}

            {pickerResults.map((cat) => {
              const active = cat.id === category;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setCategory(cat.id);
                    setPickerOpen(false);
                    setPickerSearch("");
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active ? theme.goldDeep : theme.hairline,
                    backgroundColor: active ? theme.goldTint : theme.card,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
                  <Text style={{ color: theme.white, fontSize: 16, fontWeight: "600" }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
