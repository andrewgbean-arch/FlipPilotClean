import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";

import GoldButton from "@/components/ui/GoldButton";
import FlipScoreMeter from "@/components/analytics/FlipScoreMeter";
import MileageRiskScore from "@/components/motors/MileageRiskScore";
import ListingQualityScore from "@/components/marketplace/ListingQualityScore";
import ValuationEngine from "@/components/ai/ValuationEngine";
import MarketHeatIndex from "@/components/analytics/MarketHeatIndex";
import GlowPulseCard from "@/components/ui/GlowPulseCard";
import HeroHeader from "@/components/ui/HeroHeader";
import SparklesOverlay from "@/components/ui/SparklesOverlay";
import GoldParticlesBurst from "@/components/ui/GoldParticlesBurst";
import AnimatedButton from "@/components/ui/AnimatedButton";

import { BASE_URL } from "@/utils/api";

export default function PublishFlip() {
  const router = useRouter();

  return <PublishFlipForm router={router} />;
}

/* ---------------------------------------------
   ⭐ Dealer Mode active — full Publish UI
--------------------------------------------- */
function PublishFlipForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<string>("");
  const [mileage, setMileage] = useState<string>("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const numericPrice = Number(price) || 0;
  const numericMileage = Number(mileage) || 0;

  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const shimmerColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,215,0,0.15)", "rgba(255,215,0,0.45)"],
  });

  const handlePublish = async () => {
    if (!title || !numericPrice || !description || !location) return;

    setSubmitting(true);

    try {
      await fetch(`${BASE_URL}/publish-flip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          price: numericPrice,
          mileage: numericMileage,
          description,
          location,
        }),
      });

      setSuccess(true);
      setSubmitting(false);

      setTimeout(() => {
        setSuccess(false);
        router.push("/marketplace");
      }, 1200);
    } catch (err) {
      console.log("Publish error:", err);
      setSubmitting(false);
    }
  };

  const isPublishDisabled =
    !title || !numericPrice || !description || !location;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SparklesOverlay />

      <HeroHeader
        title="Publish Flip"
        subtitle="Create a high‑trust, high‑profit listing with FlipPilot AI."
        glow
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <GlowPulseCard>
          <Text style={styles.cardTitle}>Listing Assistant</Text>
          <Text style={styles.cardDesc}>
            Fill in the basics — FlipPilot will analyse risk, profit and market heat in real time.
          </Text>
        </GlowPulseCard>

        <Animated.View
          style={[styles.divider, { backgroundColor: shimmerColor }]}
        />

        {/* INPUTS */}
        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2015 Ford Fiesta 1.0 EcoBoost – Full history"
            placeholderTextColor="#7A86A8"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.label}>Price (£)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 4950"
              placeholderTextColor="#7A86A8"
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />
          </View>

          <View style={styles.column}>
            <Text style={styles.label}>Mileage</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 72000"
              placeholderTextColor="#7A86A8"
              keyboardType="numeric"
              value={mileage}
              onChangeText={setMileage}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Paignton, Devon"
            placeholderTextColor="#7A86A8"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Service history, MOT status, known issues, upgrades, tyre condition, ownership story..."
            placeholderTextColor="#7A86A8"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <Animated.View
          style={[styles.divider, { backgroundColor: shimmerColor }]}
        />

        {/* METRICS */}
        <View style={styles.metricsSection}>
          <FlipScoreMeter
            price={numericPrice}
            mileage={numericMileage}
            descriptionLength={description.length}
          />

          <MileageRiskScore listing={{ mileage: numericMileage }} />

          <ListingQualityScore
            listing={{
              photos: [],
              description,
              vehicle: {
                mileage: numericMileage,
              },
              price: numericPrice,
            }}
            prediction={{
              flipScore: 0,
            }}
          />

          <ValuationEngine
            listing={{
              vehicle: {
                year: 2010,
                mileage: numericMileage,
              },
              price: numericPrice,
              mileage: numericMileage,
              condition: "excellent",
            }}
            prediction={{
              flipScore: 0,
            }}
          />

          <MarketHeatIndex />
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <AnimatedButton
            onPress={handlePublish}
            style={{
              backgroundColor: isPublishDisabled ? "#3A3F55" : "#FFD700",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            <Text style={{ color: isPublishDisabled ? "#8890A8" : "#0A1128", fontWeight: "900", fontSize: 16 }}>
              {submitting ? "Publishing…" : "Publish Listing"}
            </Text>
          </AnimatedButton>
        </View>
      </ScrollView>

      <Modal transparent visible={success} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <GoldParticlesBurst trigger={success} />
            <Text style={styles.modalTitle}>Flip Published 🎉</Text>
            <Text style={styles.modalSubtitle}>
              Your listing is now live in the Marketplace.
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1128",
  },

  divider: {
    height: 2,
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 999,
  },

  section: {
    marginTop: 18,
    paddingHorizontal: 16,
  },

  label: {
    color: "#FFD700",
    fontSize: 14,
    marginBottom: 6,
    fontWeight: "700",
  },

  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#24335A",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    backgroundColor: "#0F1733",
    fontSize: 14,
  },

  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },

  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 18,
  },

  column: {
    flex: 1,
  },

  metricsSection: {
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 14,
  },

  cardTitle: {
    color: "#FFD700",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 6,
  },

  cardDesc: {
    color: "#E5ECFF",
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalCard: {
    backgroundColor: "#0F1733",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFD700",
    width: "80%",
    alignItems: "center",
  },

  modalTitle: {
    color: "#FFD700",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },

  modalSubtitle: {
    color: "#E5ECFF",
    fontSize: 14,
    textAlign: "center",
  },
});
