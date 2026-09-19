import { router } from "expo-router";
import { Check, WarningCircle } from "phosphor-react-native";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
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

type FieldKey =
  | "name"
  | "postcode"
  | "nextDate"
  | "entryFee"
  | "stallFee"
  | "openingTime"
  | "closingTime"
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

export default function AddFairScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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

    // The full fair object, with the fields this form does not ask for filled in.
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
      setFormError(
        "Couldn't save your boot fair. Something went wrong saving it to this phone. Please try again."
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
          List your boot fair
        </Text>
        <Text style={[styles.pageSubtitle, { color: theme.muted }]}>
          Fairs you list are saved on this phone. Fields marked * are required.
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
              { backgroundColor: theme.gold },
              submitting && styles.submitButtonBusy,
              pressed && styles.pressed,
            ]}
          >
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
