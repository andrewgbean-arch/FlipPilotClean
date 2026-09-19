import { router } from "expo-router";
import { useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fair, addUserFair } from "../../src/lib/fairs";

// Simple profanity filter. Whole words only (plus common endings), so genuine
// place names such as Scunthorpe or Shitterton are not rejected.
const bannedWords = ["fuck", "shit", "bitch", "cunt", "slut", "whore"];
const bannedPattern = new RegExp(
  `\\b(?:${bannedWords.join("|")})(?:s|es|ed|er|ers|ing|y)?\\b`,
  "i"
);

function containsBadLanguage(text: string) {
  return bannedPattern.test(text);
}

const POSTCODE_API = "https://api.postcodes.io/postcodes/";

type PostcodePlace = { postcode: string; lat: number; lng: number };

// Resolves a UK postcode to coordinates, which distance search and "Open in
// Google Maps" both need. Returns null when the postcode is not recognised;
// throws when the lookup itself fails (offline, timeout, server error).
async function lookupPostcode(postcode: string): Promise<PostcodePlace | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(POSTCODE_API + encodeURIComponent(postcode.trim()), {
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Postcode lookup failed (${res.status})`);

    const data = await res.json();
    const result = data?.result;
    if (typeof result?.latitude !== "number" || typeof result?.longitude !== "number") {
      return null;
    }

    return {
      postcode: result.postcode ?? postcode.trim().toUpperCase(),
      lat: result.latitude,
      lng: result.longitude,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Categories available
const CATEGORY_OPTIONS = [
  "Indoor",
  "Outdoor",
  "Weekly",
  "Seasonal",
  "Charity",
  "Vintage",
  "Community",
];

export default function AddFairScreen() {
  const [name, setName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [stallFee, setStallFee] = useState("");
  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");
  const [organiserWebsite, setOrganiserWebsite] = useState("");
  const [organiserEmail, setOrganiserEmail] = useState("");
  const [showEmailPublicly, setShowEmailPublicly] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleCategory = (cat: string) => {
    if (categories.includes(cat)) {
      setCategories(categories.filter((c) => c !== cat));
    } else {
      setCategories([...categories, cat]);
    }
  };

  const validateAndSubmit = async () => {
    if (submitting) return;

    if (
      !name ||
      !postcode ||
      !nextDate ||
      !entryFee ||
      !stallFee ||
      !openingTime ||
      !closingTime ||
      !organiserEmail
    ) {
      Alert.alert("Missing Information", "Please fill in all required fields.");
      return;
    }

    const fieldsToCheck = [
      name,
      postcode,
      nextDate,
      entryFee,
      stallFee,
      organiserWebsite,
    ];

    for (const field of fieldsToCheck) {
      if (containsBadLanguage(field)) {
        Alert.alert(
          "Invalid Content",
          "Please remove inappropriate language from your listing."
        );
        return;
      }
    }

    if (!organiserEmail.includes("@") || !organiserEmail.includes(".")) {
      Alert.alert("Invalid Email", "Please enter a valid organiser email.");
      return;
    }

    let cleanedWebsite = organiserWebsite.trim();
    if (cleanedWebsite && !cleanedWebsite.startsWith("http")) {
      cleanedWebsite = "https://" + cleanedWebsite;
    }

    // Held until the fair is saved (or the attempt fails) so a second tap
    // can't add it twice while the postcode lookup is running.
    setSubmitting(true);

    let place: PostcodePlace | null;
    try {
      place = await lookupPostcode(postcode);
    } catch {
      setSubmitting(false);
      Alert.alert(
        "Couldn't check the postcode",
        "Check your connection and try again."
      );
      return;
    }

    if (!place) {
      setSubmitting(false);
      Alert.alert(
        "Postcode not recognised",
        "Please check the postcode and try again."
      );
      return;
    }

    // ⭐ FULL PRO FAIR OBJECT
    const newFair: Fair = {
      id: "BF-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),

      // User‑entered fields
      name,
      postcode: place.postcode,
      nextDate,
      entryFee,
      stallFee,
      openingTime,
      closingTime,
      website: cleanedWebsite || undefined,
      email: organiserEmail,
      displayEmailPublicly: showEmailPublicly,
      categories,

      // Auto‑generated Pro fields
      address: "",
      lat: place.lat,
      lng: place.lng,
      hours: `${openingTime} – ${closingTime}`,
      frequency: "One‑off",
      images: [],
      featured: false,
      busyScore: 0,
      description: "",
      verified: false,
      lastUpdated: new Date().toISOString(),

      social: {},

      parking: false,
      toilets: false,
      foodStalls: false,
      dogFriendly: false,
      wheelchairAccessible: false,

      indoor: false,
      weatherSafe: false,

      estimatedStalls: 0,
      estimatedVisitors: 0,

      acceptsCard: false,
      acceptsCash: true,
    };

    try {
      await addUserFair(newFair);
    } catch {
      setSubmitting(false);
      Alert.alert(
        "Couldn't save your boot fair",
        "Something went wrong saving it to this phone. Please try again."
      );
      return;
    }

    // Fairs are only stored on this device for now, so say so.
    Alert.alert(
      "Boot fair saved",
      "It's saved on this phone and will show in your boot fair list."
    );
    setSubmitting(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>List Your Boot Fair</Text>

        {/* NAME */}
        <Text style={styles.label}>Fair Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Torbay Sunday Boot Fair"
          placeholderTextColor="#AAB4C3"
          value={name}
          onChangeText={setName}
        />

        {/* POSTCODE */}
        <Text style={styles.label}>Postcode *</Text>
        <TextInput
          style={styles.input}
          placeholder="TQ2 5DZ"
          placeholderTextColor="#AAB4C3"
          value={postcode}
          onChangeText={setPostcode}
        />

        {/* DATE */}
        <Text style={styles.label}>Next Date *</Text>
        <TextInput
          style={styles.input}
          placeholder="20 Apr 2026"
          placeholderTextColor="#AAB4C3"
          value={nextDate}
          onChangeText={setNextDate}
        />

        {/* FEES */}
        <Text style={styles.label}>Entry Fee *</Text>
        <TextInput
          style={styles.input}
          placeholder="£1"
          placeholderTextColor="#AAB4C3"
          value={entryFee}
          onChangeText={setEntryFee}
        />

        <Text style={styles.label}>Stall Fee *</Text>
        <TextInput
          style={styles.input}
          placeholder="£10"
          placeholderTextColor="#AAB4C3"
          value={stallFee}
          onChangeText={setStallFee}
        />

        {/* TIMES */}
        <Text style={styles.label}>Opening Time (24h) *</Text>
        <TextInput
          style={styles.input}
          placeholder="07:00"
          placeholderTextColor="#AAB4C3"
          value={openingTime}
          onChangeText={setOpeningTime}
        />

        <Text style={styles.label}>Closing Time (24h) *</Text>
        <TextInput
          style={styles.input}
          placeholder="13:00"
          placeholderTextColor="#AAB4C3"
          value={closingTime}
          onChangeText={setClosingTime}
        />

        {/* WEBSITE */}
        <Text style={styles.label}>Organiser Website (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://example.com"
          placeholderTextColor="#AAB4C3"
          value={organiserWebsite}
          onChangeText={setOrganiserWebsite}
        />

        {/* EMAIL */}
        <Text style={styles.label}>Organiser Email (required, private)</Text>
        <TextInput
          style={styles.input}
          placeholder="contact@example.com"
          placeholderTextColor="#AAB4C3"
          value={organiserEmail}
          onChangeText={setOrganiserEmail}
        />

        {/* PUBLIC EMAIL TOGGLE */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Display my email publicly</Text>
          <Switch
            value={showEmailPublicly}
            onValueChange={setShowEmailPublicly}
            thumbColor={showEmailPublicly ? "#FFD700" : "#888"}
            trackColor={{ true: "#FFD700", false: "#555" }}
          />
        </View>

        {/* CATEGORIES */}
        <Text style={styles.label}>Categories</Text>
        <View style={styles.categoryContainer}>
          {CATEGORY_OPTIONS.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                categories.includes(cat) && styles.categoryChipSelected,
              ]}
              onPress={() => toggleCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryText,
                  categories.includes(cat) && styles.categoryTextSelected,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SUBMIT */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonBusy]}
          onPress={validateAndSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? "Checking postcode..." : "Submit Fair"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A1931",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 200,
  },
  header: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    color: "#FFD700",
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#112240",
    padding: 14,
    borderRadius: 12,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  toggleLabel: {
    color: "#FFD700",
    fontWeight: "700",
    fontSize: 16,
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#112240",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
    marginRight: 8,
    marginBottom: 8,
  },
  categoryChipSelected: {
    backgroundColor: "#FFD700",
  },
  categoryText: {
    color: "#FFD700",
    fontWeight: "700",
  },
  categoryTextSelected: {
    color: "#0A1931",
  },
  submitButton: {
    backgroundColor: "#00E676",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFD700",
    marginTop: 10,
  },
  submitButtonBusy: {
    opacity: 0.6,
  },
  submitText: {
    color: "#0A1931",
    fontSize: 17,
    fontWeight: "900",
  },
});
