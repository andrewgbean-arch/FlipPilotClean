import { useState, useRef, useEffect } from "react";
import {
  View,
  Pressable,
  Animated,
  Modal,
  StyleSheet,
  TextInput,
  Text,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { CheckCircle, Star } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/useTheme";
import { describeApiError, sendFeedback } from "@/utils/api";
import * as Haptics from "expo-haptics";


// A word for each rating, shown under the stars once one is chosen.
const RATING_WORDS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

export default function RateScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  // TOAST
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslate = useRef(new Animated.Value(20)).current;

  // THANK YOU CARD
  const thankYouPulse = useRef(new Animated.Value(0)).current;

  // MAIN RATE HANDLER
  const handleRate = (value: number) => {
    setRating(value);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (value === 5) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // TOAST
  const showToast = () => {
    setToastVisible(true);

    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslate, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslate, {
          toValue: 20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setToastVisible(false));
    }, 2000);
  };

  // THANK YOU CARD
  useEffect(() => {
    if (thankYouOpen) {
      thankYouPulse.setValue(0);
      Animated.spring(thankYouPulse, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start();
    }
  }, [thankYouOpen]);

  // SUBMIT
  const submitRating = async () => {
    if (rating === 0) return;

    try {
      await sendFeedback({ kind: "rating", rating, text: reviewText });
    } catch (e) {
      Alert.alert("Couldn't send your rating", `${describeApiError(e)} Please try again.`);
      return;
    }

    setThankYouOpen(true);
    showToast();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      setThankYouOpen(false);
    }, 1800);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <KeyboardAwareScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 32 },
        ]}
        enableOnAndroid
        extraScrollHeight={80}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          How are we doing?
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Tap a star to rate your experience. Adding a few words helps us improve.
        </Text>

        {/* STARS */}
        <View
          style={[
            styles.card,
            styles.ratingCard,
            { backgroundColor: theme.card, borderColor: theme.hairline },
          ]}
        >
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => {
              const selected = star <= rating;

              return (
                <Pressable
                  key={star}
                  onPress={() => handleRate(star)}
                  accessibilityRole="button"
                  accessibilityLabel={`${star} ${star === 1 ? "star" : "stars"}`}
                  accessibilityState={{ selected: star === rating }}
                  style={({ pressed }) => [styles.star, pressed && styles.pressed]}
                >
                  <Star
                    size={40}
                    weight={selected ? "fill" : "regular"}
                    color={selected ? theme.gold : theme.muted}
                  />
                </Pressable>
              );
            })}
          </View>

          <Text
            style={[
              styles.ratingWord,
              { color: rating > 0 ? theme.text : theme.muted },
            ]}
            accessibilityLiveRegion="polite"
          >
            {rating > 0 ? RATING_WORDS[rating - 1] : "Tap a star to rate"}
          </Text>
        </View>

        {/* REVIEW BOX */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.hairline },
          ]}
        >
          <Text style={[styles.label, { color: theme.muted }]}>Your review (optional)</Text>
          <TextInput
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="Write your review…"
            placeholderTextColor={theme.muted}
            accessibilityLabel="Your review"
            multiline
            style={[
              styles.input,
              {
                backgroundColor: theme.background,
                borderColor: theme.hairline,
                color: theme.text,
              },
            ]}
          />
        </View>

        {/* SUBMIT BUTTON */}
        <Pressable
          onPress={submitRating}
          accessibilityRole="button"
          accessibilityLabel="Submit rating"
          accessibilityState={{ disabled: rating === 0 }}
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: theme.gold },
            rating === 0 && styles.submitIdle,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.submitText, { color: theme.black }]}>Submit rating</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      {/* TOAST */}
      {toastVisible && (
        <View
          style={[styles.toastWrap, { bottom: Math.max(insets.bottom, 16) + 24 }]}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.toast,
              {
                backgroundColor: theme.card,
                borderColor: theme.hairline,
                opacity: toastOpacity,
                transform: [{ translateY: toastTranslate }],
              },
            ]}
          >
            <CheckCircle size={20} weight="fill" color={theme.success} />
            <Text style={[styles.toastText, { color: theme.text }]}>Rating saved</Text>
          </Animated.View>
        </View>
      )}

      {/* THANK YOU MODAL */}
      <Modal transparent visible={thankYouOpen} animationType="fade">
        <View pointerEvents="none" style={styles.overlay}>
          <Animated.View
            style={[
              styles.thanksCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.hairline,
                transform: [
                  {
                    scale: thankYouPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.thanksIcon,
                { backgroundColor: theme.background, borderColor: theme.hairline },
              ]}
            >
              <CheckCircle size={30} weight="fill" color={theme.success} />
            </View>

            <Text style={[styles.thanksTitle, { color: theme.text }]}>Thank you</Text>

            <Text style={[styles.thanksBody, { color: theme.muted }]}>
              Your rating helps us improve FlipPilot.
            </Text>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 24,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  ratingCard: {
    alignItems: "center",
    paddingVertical: 20,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  star: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingWord: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: "top",
  },
  submit: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  submitIdle: {
    opacity: 0.4,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
  toastWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  toastText: {
    fontSize: 15,
    fontWeight: "600",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  thanksCard: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
  },
  thanksIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  thanksTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  thanksBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
});
