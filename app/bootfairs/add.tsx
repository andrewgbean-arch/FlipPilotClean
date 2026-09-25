import { router } from "expo-router";
import GoldFoil from "@/components/ui/GoldFoil";
import { Check, Plus, WarningCircle, X } from "phosphor-react-native";
import { useState } from "react";
import type { ReactNode } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { StyleProp, TextInputProps, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";

import { Fair, addUserFair } from "../../src/lib/fairs";
import { uploadPhotos } from "../../src/utils/uploadPhotos";

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
  "Boot Fair",
  "Fête",
  "Market",
  "Garage Sale",
  "Jumble Sale",
  "Indoor",
  "Outdoor",
  "Weekly",
  "Seasonal",
  "Charity",
  "Vintage",
  "Community",
];

const DAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const MAX_PHOTOS = 6;

type FieldKey =
  | "name"
  | "postcode"
  | "nextDate"
  | "daysOfWeek"
  | "entryFee"
  | "stallFee"
  | "openingTime"
  | "closingTime"
  | "description"
  | "organiserWebsite"
  | "organiserEmail";

type FormErrors = Partial<Record<FieldKey, string>>;

// A soft fill for a selected chip. The theme has no translucent gold of its own.
const GOLD_TINT = "rgba(255, 215, 0, 0.12)";

/* SMALL LOCAL COMPONENTS */
function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

// A card that holds a run of fields.
function FormCard({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      {children}
    </View>
  );
}

// A label, a 48pt input and, when there is one, its hint or error.
function FormField({
  label,
  required,
  hint,
  error,
  style,
  inputStyle,
  value,
  onChangeText,
  placeholder,
  inputProps,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  style?: StyleProp<ViewStyle>;
  // Extra style for the input itself, e.g. a taller box for a multiline field.
  inputStyle?: StyleProp<ViewStyle>;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  // Keyboard hints for the field (capitalisation, keyboard type).
  inputProps?: TextInputProps;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.label, { color: theme.muted }]}>
        {required ? `${label} *` : label}
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.background,
            color: theme.text,
            borderColor: error ? theme.danger : focused ? theme.gold : theme.hairline,
          },
          inputStyle,
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={required ? `${label}, required` : label}
        {...inputProps}
      />
      {error ? (
        <Text
          style={[styles.fieldMessage, { color: theme.danger }]}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.fieldMessage, { color: theme.muted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

// A plain yes/no question - one row, a label and a switch.
function ToggleRow({
  label,
  value,
  onValueChange,
  divider,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.toggleRow,
        divider ? { borderTopColor: theme.hairline } : { borderTopWidth: 0, paddingTop: 0 },
      ]}
    >
      <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={theme.white}
        trackColor={{ true: theme.gold, false: theme.cardElevated }}
        ios_backgroundColor={theme.cardElevated}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function AddFairScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [entryFee, setEntryFee] = useState("");
  const [stallFee, setStallFee] = useState("");
  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [organiserWebsite, setOrganiserWebsite] = useState("");
  const [organiserEmail, setOrganiserEmail] = useState("");
  const [showEmailPublicly, setShowEmailPublicly] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Facilities - each a plain yes/no the organiser answers themselves.
  const [parking, setParking] = useState(false);
  const [toilets, setToilets] = useState(false);
  const [foodStalls, setFoodStalls] = useState(false);
  const [dogFriendly, setDogFriendly] = useState(false);
  const [wheelchairAccessible, setWheelchairAccessible] = useState(false);
  const [indoor, setIndoor] = useState(false);
  const [weatherSafe, setWeatherSafe] = useState(false);
  const [acceptsCard, setAcceptsCard] = useState(false);
  const [acceptsCash, setAcceptsCash] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");

  // Typing in a field takes its error away.
  const onChange = (key: FieldKey, set: (value: string) => void) => (text: string) => {
    set(text);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (formError) setFormError("");
  };

  const toggleCategory = (cat: string) => {
    if (categories.includes(cat)) {
      setCategories(categories.filter((c) => c !== cat));
    } else {
      setCategories([...categories, cat]);
    }
  };

  const toggleDay = (day: string) => {
    if (errors.daysOfWeek) setErrors((prev) => ({ ...prev, daysOfWeek: undefined }));
    if (formError) setFormError("");
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day]);
    }
  };

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access to add pictures of your boot fair."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled) return;
    setPhotos((prev) => [...prev, result.assets[0].uri]);
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const validateAndSubmit = async () => {
    if (submitting) return;

    setErrors({});
    setFormError("");

    const required: [FieldKey, string][] = [
      ["name", name],
      ["postcode", postcode],
      ["nextDate", nextDate],
      ["entryFee", entryFee],
      ["stallFee", stallFee],
      ["openingTime", openingTime],
      ["closingTime", closingTime],
      ["organiserEmail", organiserEmail],
    ];

    const missing: FormErrors = {};
    for (const [key, value] of required) {
      if (!value) missing[key] = "Required";
    }
    if (daysOfWeek.length === 0) missing.daysOfWeek = "Pick at least one day";

    if (Object.keys(missing).length > 0) {
      setErrors(missing);
      setFormError("Please fill in all required fields.");
      return;
    }

    const fieldsToCheck: [FieldKey, string][] = [
      ["name", name],
      ["postcode", postcode],
      ["nextDate", nextDate],
      ["entryFee", entryFee],
      ["stallFee", stallFee],
      ["organiserWebsite", organiserWebsite],
      ["description", description],
    ];

    const badLanguage: FormErrors = {};
    for (const [key, value] of fieldsToCheck) {
      if (containsBadLanguage(value)) {
        badLanguage[key] = "Please remove inappropriate language from your listing.";
      }
    }

    if (Object.keys(badLanguage).length > 0) {
      setErrors(badLanguage);
      setFormError("Please check the highlighted fields.");
      return;
    }

    if (!organiserEmail.includes("@") || !organiserEmail.includes(".")) {
      setErrors({ organiserEmail: "Please enter a valid organiser email." });
      setFormError("Please check the highlighted fields.");
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
      setErrors({
        postcode: "Couldn't check the postcode. Check your connection and try again.",
      });
      setFormError("Please check the highlighted fields.");
      return;
    }

    if (!place) {
      setSubmitting(false);
      setErrors({
        postcode: "Postcode not recognised. Please check the postcode and try again.",
      });
      setFormError("Please check the highlighted fields.");
      return;
    }

    // Photos go up first: the server only keeps pictures this phone uploaded,
    // and a phone's own file path is no use to anyone else.
    let uploaded: string[] = [];
    try {
      uploaded = await uploadPhotos(photos);
    } catch (err: any) {
      setSubmitting(false);
      setFormError(
        typeof err?.message === "string" && err.message
          ? err.message
          : "Couldn't upload your photos. Check your connection and try again."
      );
      return;
    }

    // The full fair object, with the fields this form does not ask for filled in.
    const newFair: Fair = {
      id: "BF-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),

      // User‑entered fields
      name,
      postcode: place.postcode,
      nextDate,
      daysOfWeek,
      entryFee,
      stallFee,
      openingTime,
      closingTime,
      cancelledDueToWeather: false,
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
      images: uploaded,
      featuredUntil: null,
      busyScore: 0,
      description,
      verified: false,
      lastUpdated: new Date().toISOString(),

      social: {},

      parking,
      toilets,
      foodStalls,
      dogFriendly,
      wheelchairAccessible,

      indoor,
      weatherSafe,

      estimatedStalls: 0,
      estimatedVisitors: 0,

      acceptsCard,
      acceptsCash,
    };

    try {
      await addUserFair(newFair);
    } catch (err: any) {
      setSubmitting(false);
      setFormError(
        typeof err?.message === "string" && err.message
          ? err.message
          : "Couldn't save your boot fair. Check your connection and try again."
      );
      return;
    }

    Alert.alert(
      "Boot fair listed",
      "It's live and visible to everyone nearby."
    );
    setSubmitting(false);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: theme.text }]} accessibilityRole="header">
          List your boot fair, fête, market or sale
        </Text>
        <Text style={[styles.pageSubtitle, { color: theme.muted }]}>
          Your listing is visible to everyone nearby. Fields marked * are required.
        </Text>

        {/* FAIR DETAILS */}
        <SectionTitle title="Fair details" />
        <FormCard>
          <FormField
            label="Fair name"
            required
            placeholder="Example: Torbay Sunday Boot Fair"
            value={name}
            onChangeText={onChange("name", setName)}
            error={errors.name}
          />
          <FormField
            label="Postcode"
            required
            placeholder="TQ2 5DZ"
            value={postcode}
            onChangeText={onChange("postcode", setPostcode)}
            error={errors.postcode}
            inputProps={{ autoCapitalize: "characters", autoCorrect: false }}
          />
          <FormField
            label="Next date"
            required
            placeholder="e.g. Sunday 4 October"
            value={nextDate}
            onChangeText={onChange("nextDate", setNextDate)}
            error={errors.nextDate}
          />

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.muted }]}>Day(s) of the week *</Text>
            <View style={styles.dayContainer}>
              {DAY_OPTIONS.map((day) => {
                const selected = daysOfWeek.includes(day);

                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={day}
                    accessibilityState={{ selected }}
                    onPress={() => toggleDay(day)}
                    style={({ pressed }) => [
                      styles.dayChip,
                      {
                        backgroundColor: selected ? GOLD_TINT : theme.background,
                        borderColor: selected ? theme.gold : theme.hairline,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[styles.dayText, { color: selected ? theme.gold : theme.text }]}
                    >
                      {day.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.daysOfWeek ? (
              <Text
                style={[styles.fieldMessage, { color: theme.danger }]}
                accessibilityLiveRegion="polite"
              >
                {errors.daysOfWeek}
              </Text>
            ) : (
              <Text style={[styles.fieldMessage, { color: theme.muted }]}>
                Which day(s) this fair usually runs on.
              </Text>
            )}
          </View>
        </FormCard>

        {/* PHOTOS */}
        <SectionTitle title="Photos" subtitle="Show people what to expect. The first photo is used as the cover." />
        <FormCard>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
            {photos.map((uri) => (
              <View key={uri} style={styles.photoThumbWrap}>
                <Image source={{ uri }} style={[styles.photoThumb, { borderColor: theme.hairline }]} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  onPress={() => removePhoto(uri)}
                  style={[styles.photoRemove, { backgroundColor: theme.danger }]}
                >
                  <X size={14} color={theme.white} weight="bold" />
                </Pressable>
              </View>
            ))}

            {photos.length < MAX_PHOTOS ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a photo"
                onPress={pickPhoto}
                style={({ pressed }) => [
                  styles.photoAdd,
                  { backgroundColor: theme.background, borderColor: theme.hairline },
                  pressed && styles.pressed,
                ]}
              >
                <Plus size={22} color={theme.muted} />
              </Pressable>
            ) : null}
          </ScrollView>
          <Text style={[styles.fieldMessage, { color: theme.muted }]}>
            {photos.length} of {MAX_PHOTOS} photos added.
          </Text>
        </FormCard>

        {/* ABOUT */}
        <SectionTitle title="About" subtitle="Tell people what your boot fair is like." />
        <FormCard>
          <FormField
            label="Description (optional)"
            placeholder="Pitch types, what to expect, parking info, regular stalls..."
            value={description}
            onChangeText={onChange("description", setDescription)}
            error={errors.description}
            inputStyle={styles.descriptionInput}
            inputProps={{ multiline: true, numberOfLines: 5, textAlignVertical: "top" }}
          />
        </FormCard>

        {/* FEES AND TIMES */}
        <SectionTitle title="Fees and times" />
        <FormCard>
          <View style={styles.pair}>
            <FormField
              style={styles.pairItem}
              label="Entry fee"
              required
              placeholder="£1"
              value={entryFee}
              onChangeText={onChange("entryFee", setEntryFee)}
              error={errors.entryFee}
            />
            <FormField
              style={styles.pairItem}
              label="Stall fee"
              required
              placeholder="£10"
              value={stallFee}
              onChangeText={onChange("stallFee", setStallFee)}
              error={errors.stallFee}
            />
          </View>

          <View style={styles.pair}>
            <FormField
              style={styles.pairItem}
              label="Opening time"
              required
              placeholder="07:00"
              value={openingTime}
              onChangeText={onChange("openingTime", setOpeningTime)}
              error={errors.openingTime}
            />
            <FormField
              style={styles.pairItem}
              label="Closing time"
              required
              placeholder="13:00"
              value={closingTime}
              onChangeText={onChange("closingTime", setClosingTime)}
              error={errors.closingTime}
            />
          </View>

          <Text style={[styles.fieldMessage, { color: theme.muted }]}>
            Use 24-hour times, for example 07:00.
          </Text>
        </FormCard>

        {/* FACILITIES */}
        <SectionTitle title="Facilities" subtitle="What's actually there, so visitors know before they travel." />
        <FormCard>
          <ToggleRow label="Parking available" value={parking} onValueChange={setParking} />
          <ToggleRow label="Toilets on site" value={toilets} onValueChange={setToilets} divider />
          <ToggleRow label="Food stalls" value={foodStalls} onValueChange={setFoodStalls} divider />
          <ToggleRow label="Dog friendly" value={dogFriendly} onValueChange={setDogFriendly} divider />
          <ToggleRow
            label="Wheelchair accessible"
            value={wheelchairAccessible}
            onValueChange={setWheelchairAccessible}
            divider
          />
          <ToggleRow label="Indoor" value={indoor} onValueChange={setIndoor} divider />
          <ToggleRow
            label="Weather safe (covered even in rain)"
            value={weatherSafe}
            onValueChange={setWeatherSafe}
            divider
          />
          <ToggleRow label="Accepts card payments" value={acceptsCard} onValueChange={setAcceptsCard} divider />
          <ToggleRow label="Accepts cash" value={acceptsCash} onValueChange={setAcceptsCash} divider />
        </FormCard>

        {/* ORGANISER */}
        <SectionTitle title="Organiser" />
        <FormCard>
          <FormField
            label="Organiser website (optional)"
            placeholder="https://example.com"
            value={organiserWebsite}
            onChangeText={onChange("organiserWebsite", setOrganiserWebsite)}
            error={errors.organiserWebsite}
            inputProps={{ keyboardType: "url", autoCapitalize: "none", autoCorrect: false }}
          />
          <FormField
            label="Organiser email"
            required
            hint="Kept private unless you turn on public display below."
            placeholder="contact@example.com"
            value={organiserEmail}
            onChangeText={onChange("organiserEmail", setOrganiserEmail)}
            error={errors.organiserEmail}
            inputProps={{
              keyboardType: "email-address",
              autoCapitalize: "none",
              autoCorrect: false,
            }}
          />

          {/* PUBLIC EMAIL TOGGLE */}
          <View style={[styles.toggleRow, { borderTopColor: theme.hairline }]}>
            <Text style={[styles.toggleLabel, { color: theme.text }]}>
              Display my email publicly
            </Text>
            <Switch
              value={showEmailPublicly}
              onValueChange={setShowEmailPublicly}
              thumbColor={theme.white}
              trackColor={{ true: theme.gold, false: theme.cardElevated }}
              ios_backgroundColor={theme.cardElevated}
              accessibilityLabel="Display my email publicly"
            />
          </View>
        </FormCard>

        {/* CATEGORIES */}
        <SectionTitle title="Categories" subtitle="Choose any that apply." />
        <View style={styles.categoryContainer}>
          {CATEGORY_OPTIONS.map((cat) => {
            const selected = categories.includes(cat);

            return (
              <Pressable
                key={cat}
                accessibilityRole="button"
                accessibilityLabel={cat}
                accessibilityState={{ selected }}
                onPress={() => toggleCategory(cat)}
                style={({ pressed }) => [
                  styles.categoryChip,
                  {
                    backgroundColor: selected ? GOLD_TINT : theme.card,
                    borderColor: selected ? theme.gold : theme.hairline,
                  },
                  pressed && styles.pressed,
                ]}
              >
                {selected ? <Check size={14} color={theme.gold} weight="bold" /> : null}
                <Text
                  style={[styles.categoryText, { color: selected ? theme.gold : theme.text }]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* SUBMIT */}
        <View style={styles.submitBlock}>
          {formError ? (
            <View
              style={styles.formError}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <WarningCircle size={18} color={theme.danger} />
              <Text style={[styles.formErrorText, { color: theme.danger }]}>{formError}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={submitting ? "Checking postcode" : "Submit fair"}
            accessibilityState={{ disabled: submitting, busy: submitting }}
            onPress={validateAndSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: theme.gold, overflow: "hidden" },
              submitting && styles.submitButtonBusy,
              pressed && styles.pressed,
            ]}
          >
            <GoldFoil />
            {submitting ? <ActivityIndicator size="small" color={theme.black} /> : null}
            <Text style={[styles.submitText, { color: theme.black }]}>
              {submitting ? "Checking postcode..." : "Submit fair"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pressed: {
    opacity: 0.75,
  },

  /* HEADER */
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  /* FORM */
  formCard: {
    padding: 16,
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  fieldMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  pair: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  pairItem: {
    flex: 1,
  },
  toggleRow: {
    minHeight: 52,
    paddingTop: 16,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  descriptionInput: {
    height: 110,
    paddingTop: 12,
  },

  /* DAYS OF THE WEEK */
  dayContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayChip: {
    minWidth: 48,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "600",
  },

  /* PHOTOS */
  photoScroll: {
    flexGrow: 0,
  },
  photoThumbWrap: {
    marginRight: 10,
  },
  photoThumb: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
  },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAdd: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* CATEGORIES */
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  categoryText: {
    fontSize: 15,
    fontWeight: "600",
  },

  /* SUBMIT */
  submitBlock: {
    marginTop: 24,
    gap: 12,
  },
  formError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  formErrorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonBusy: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
