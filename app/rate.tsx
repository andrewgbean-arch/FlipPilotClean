import { useState, useRef, useEffect } from "react";
import {
  View,
  Pressable,
  Animated,
  Modal,
  TextInput,
  Text,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/styles/useTheme";
import * as Haptics from "expo-haptics";

const REVIEWS_KEY = "@flippilot_reviews";

export default function RateScreen() {
  const theme = useTheme();

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  // STAR ANIMATIONS
  const starScale = useRef(Array.from({ length: 5 }, () => new Animated.Value(1))).current;
  const starLift = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
  const starGlowBright = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;

  // GOLD BURST
  const burstOpacity = useRef(new Animated.Value(0)).current;
  const burstScale = useRef(new Animated.Value(0.4)).current;

  // CONFETTI
  const confettiOpacity = useRef(new Animated.Value(0)).current;
  const confettiY = useRef(new Animated.Value(-40)).current;

  // SHOCKWAVE
  const shockwaveScale = useRef(new Animated.Value(0.2)).current;
  const shockwaveOpacity = useRef(new Animated.Value(0)).current;

  // ORBIT PULSE
  const orbitScale = useRef(new Animated.Value(1)).current;

  // TOAST
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslate = useRef(new Animated.Value(20)).current;

  // THANK YOU PULSE
  const thankYouPulse = useRef(new Animated.Value(0)).current;

  // SUBMIT BUTTON ANIMATIONS
  const submitGlow = useRef(new Animated.Value(0)).current;
  const submitShake = useRef(new Animated.Value(0)).current;
  const submitBounce = useRef(new Animated.Value(1)).current;
  const submitSparkle = useRef(new Animated.Value(0)).current;

  // MAIN RATE HANDLER
  const handleRate = (value: number) => {
    setRating(value);

    for (let i = 0; i < 5; i++) {
      if (i < value) {
        Animated.timing(starGlowBright[i], {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();

        Animated.spring(starScale[i], {
          toValue: 1.4,
          friction: 4,
          useNativeDriver: true,
        }).start();

        Animated.spring(starLift[i], {
          toValue: -10,
          friction: 5,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(starGlowBright[i], {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();

        Animated.spring(starScale[i], {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start();

        Animated.spring(starLift[i], {
          toValue: 0,
          friction: 5,
          useNativeDriver: true,
        }).start();
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (value >= 3) triggerBurst();
    if (value >= 4) triggerShockwave();
    if (value === 5) {
      triggerConfetti();
      triggerOrbitPulse();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    triggerSubmitPulse();
  };

  // GOLD BURST
  const triggerBurst = () => {
    burstOpacity.setValue(1);
    burstScale.setValue(0.4);

    Animated.parallel([
      Animated.timing(burstOpacity, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(burstScale, {
        toValue: 1.8,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // CONFETTI
  const triggerConfetti = () => {
    confettiOpacity.setValue(1);
    confettiY.setValue(-40);

    Animated.parallel([
      Animated.timing(confettiOpacity, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(confettiY, {
        toValue: 80,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // SHOCKWAVE
  const triggerShockwave = () => {
    shockwaveOpacity.setValue(1);
    shockwaveScale.setValue(0.2);

    Animated.parallel([
      Animated.timing(shockwaveScale, {
        toValue: 2.2,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(shockwaveOpacity, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ORBIT PULSE
  const triggerOrbitPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbitScale, {
          toValue: 1.15,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(orbitScale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 3 }
    ).start();
  };

  // SUBMIT BUTTON ANIMATIONS
  const triggerSubmitPulse = () => {
    Animated.timing(submitGlow, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(submitGlow, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    Animated.sequence([
      Animated.spring(submitBounce, {
        toValue: 1.15,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(submitBounce, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.timing(submitShake, {
        toValue: 10,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(submitShake, {
        toValue: -10,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(submitShake, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.timing(submitSparkle, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(submitSparkle, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
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

  // THANK YOU PULSE
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
      const existing = await AsyncStorage.getItem(REVIEWS_KEY);
      const reviews = existing ? JSON.parse(existing) : [];
      reviews.push({
        rating,
        reviewText,
        date: new Date().toISOString(),
      });
      await AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
    } catch (e) {
      console.log("Failed to save review", e);
    }

    setThankYouOpen(true);
    showToast();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      setThankYouOpen(false);
    }, 1800);
  };

  return (
    <>
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
          backgroundColor: theme.background,
        }}
        enableOnAndroid
        extraScrollHeight={80}
      >
        {/* GOLD BURST */}
        <Animated.View
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: theme.goldDeep,
            opacity: burstOpacity,
            transform: [{ scale: burstScale }],
            alignSelf: "center",
            top: "35%",
          }}
        />

        {/* CONFETTI */}
        <Animated.View
          style={{
            position: "absolute",
            opacity: confettiOpacity,
            transform: [{ translateY: confettiY }],
            top: "30%",
          }}
        >
          <Text style={{ fontSize: 40, color: theme.goldDeep }}>✨✨✨</Text>
        </Animated.View>

        {/* SHOCKWAVE */}
        <Animated.View
          style={{
            position: "absolute",
            width: 260,
            height: 260,
            borderRadius: 130,
            borderWidth: 4,
            borderColor: theme.goldDeep,
            opacity: shockwaveOpacity,
            transform: [{ scale: shockwaveScale }],
            top: "32%",
            alignSelf: "center",
          }}
        />

        <Text
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: theme.accent,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          Rate & Review FlipPilot
        </Text>

        {/* STARS */}
        <Animated.View style={{ transform: [{ scale: orbitScale }] }}>
          <View style={{ flexDirection: "row", marginBottom: 30 }}>
            {[1, 2, 3, 4, 5].map((star, i) => (
              <Pressable key={star} onPress={() => handleRate(star)}>
                <View style={{ alignItems: "center", justifyContent: "center" }}>
                  {/* GLOW */}
                  <Animated.View
                    style={{
                      position: "absolute",
                      width: 70,
                      height: 70,
                      borderRadius: 35,
                      backgroundColor: theme.goldDeep,
                      opacity: starGlowBright[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.6],
                      }),
                      transform: [
                        {
                          scale: starGlowBright[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.6, 1.4],
                          }),
                        },
                      ],
                    }}
                  />

                  {/* STAR */}
                  <Animated.Text
                    style={{
                      fontSize: 48,
                      marginHorizontal: 10,
                      transform: [
                        { scale: starScale[i] },
                        { translateY: starLift[i] },
                      ],
                      color: star <= rating ? theme.goldDeep : theme.text,
                    }}
                  >
                    ★
                  </Animated.Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* REVIEW BOX */}
        <TextInput
          value={reviewText}
          onChangeText={setReviewText}
          placeholder="Write your review..."
          placeholderTextColor={theme.text}
          multiline
          style={{
            width: "100%",
            minHeight: 120,
            borderRadius: 14,
            padding: 14,
            backgroundColor: theme.card,
            color: theme.text,
            borderWidth: 2,
            borderColor: theme.goldDeep,
            marginBottom: 30,
            fontSize: 16,
          }}
        />

        {/* SUBMIT BUTTON */}
        <Animated.View
          style={{
            transform: [
              { scale: submitBounce },
              { translateX: submitShake },
            ],
          }}
        >
          {/* glow */}
          <Animated.View
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: 14,
              backgroundColor: theme.goldDeep,
              opacity: submitGlow.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.4],
              }),
              transform: [
                {
                  scale: submitGlow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.4],
                  }),
                },
              ],
            }}
          />

          {/* sparkles */}
          <Animated.Text
            style={{
              position: "absolute",
              top: -20,
              right: -10,
              fontSize: 30,
              opacity: submitSparkle,
            }}
          >
            ✨
          </Animated.Text>

          <Pressable
            onPress={submitRating}
            style={{
              backgroundColor: theme.accent,
              paddingVertical: 14,
              paddingHorizontal: 28,
              borderRadius: 14,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "900",
                color: theme.black,
              }}
            >
              Submit Rating
            </Text>
          </Pressable>
        </Animated.View>

        {/* TOAST */}
        {toastVisible && (
          <Animated.View
            style={{
              position: "absolute",
              bottom: 40,
              backgroundColor: theme.card,
              paddingVertical: 14,
              paddingHorizontal: 26,
              borderRadius: 14,
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslate }],
              shadowColor: theme.goldDeep,
              shadowOpacity: 0.4,
              shadowRadius: 12,
            }}
          >
            <Text
              style={{
                color: theme.accent,
                fontWeight: "900",
                fontSize: 18,
              }}
            >
              Rating Saved ⭐
            </Text>
          </Animated.View>
        )}
      </KeyboardAwareScrollView>

      {/* THANK YOU MODAL */}
      <Modal transparent visible={thankYouOpen} animationType="fade">
        <View
          pointerEvents="none"
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Animated.View
            style={{
              backgroundColor: theme.card,
              padding: 24,
              borderRadius: 20,
              width: "80%",
              alignItems: "center",
              transform: [
                {
                  scale: thankYouPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            }}
          >
            <Text
              style={{
                fontSize: 24,
                fontWeight: "900",
                color: theme.accent,
                marginBottom: 12,
              }}
            >
              Thank You!
            </Text>

            <Text
              style={{
                fontSize: 16,
                color: theme.text,
                opacity: 0.9,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              Your rating helps us improve FlipPilot.
            </Text>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
