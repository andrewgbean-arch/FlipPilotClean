import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { FadeIn } from "react-native-reanimated";

import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/styles/useTheme";
import { buildVehicleTimeline } from "@/features/vehicles/utils/vehicleUtils";

import { Theme } from "@/styles/theme";

/* ============================================================
   VEHICLE DETAILS SCREEN
============================================================ */
export default function VehicleDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { vehicles, deleteVehicle, toggleFavourite } = useVehicleHistory();

  const vehicle = vehicles.find((v: FlipRecord) => v.id === id);
  const [advisorVisible, setAdvisorVisible] = useState(false);

  if (!vehicle) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.background,
        }}
      >
        <Text style={{ color: theme.white, fontSize: 20 }}>
          Vehicle not found
        </Text>
      </View>
    );
  }

  /* SAFE VALUES */
  const flipScore = vehicle.flipScore ?? 0;
  const demandScore = vehicle.market?.demandScore ?? 0;
  const aiConfidence = vehicle.aiPriceConfidence ?? 0;

  const profit = (vehicle.sellPrice ?? 0) - (vehicle.buyPrice ?? 0);
  const margin =
    vehicle.buyPrice && vehicle.buyPrice > 0
      ? (profit / vehicle.buyPrice) * 100
      : 0;

  const aiPrice = vehicle.aiPrice?.recommendedSellPrice ?? null;
  const aiRisk = vehicle.aiPrice?.riskLevel ?? null;
  const aiNotes = vehicle.aiPrice?.notes ?? null;
  const aiConfidence2 = vehicle.aiPrice?.confidence ?? null;

  const timeline = buildVehicleTimeline(vehicle);

  return (
    <View style={{ flex: 1 }}>
      <SparkleDust theme={theme} />

      {/* GOLD HALO */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <View
          style={{
            height: 140,
            backgroundColor: theme.goldDeep,
            opacity: 0.12,
            borderRadius: 200,
          }}
        />
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        {/* HEADER */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={[styles.heading, { color: theme.goldDeep }]}>
            {vehicle.title}
          </Text>

          <TouchableOpacity onPress={() => toggleFavourite(vehicle.id)}>
            <Text style={{ fontSize: 32 }}>
              {vehicle.favourite ? "⭐" : "☆"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* QUICK ACTIONS */}
        <QuickActions
          vehicle={vehicle}
          theme={theme}
          router={router}
          onOpenAdvisor={() => setAdvisorVisible(true)}
        />

        {/* AI INSIGHTS SUMMARY */}
        {vehicle.aiPrice && (
          <AIInsights
            theme={theme}
            aiPrice={aiPrice}
            aiRisk={aiRisk}
            aiConfidence={aiConfidence2}
            aiNotes={aiNotes}
            profit={profit}
            sellPrice={vehicle.sellPrice ?? 0}
          />
        )}

        {/* IMAGE GALLERY */}
        {vehicle.images && vehicle.images.length > 0 && (
          <ScrollView
            horizontal
            style={{ marginVertical: 20 }}
            showsHorizontalScrollIndicator={false}
          >
            {vehicle.images.map((uri: string, i: number) => (
              <Image
                key={i}
                source={{ uri }}
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: theme.radius.md,
                  marginRight: 12,
                  borderWidth: 1,
                  borderColor: theme.goldSoftGlow,
                }}
              />
            ))}
          </ScrollView>
        )}

        {/* FLIPSCORE */}
        <Section title="FlipScore" theme={theme}>
          <Text
            style={{
              color: theme.goldDeep,
              fontSize: 40,
              fontWeight: "900",
              textShadowColor: theme.goldDeep,
              textShadowRadius: 12,
              marginBottom: 10,
            }}
          >
            {flipScore}
          </Text>

          <Bar value={flipScore} theme={theme} />
        </Section>

        {/* PROFIT BREAKDOWN */}
        <Section title="Profit Breakdown" theme={theme}>
          <BreakItem
            label="Buy Price"
            value={`£${vehicle.buyPrice ?? 0}`}
            theme={theme}
          />
          <BreakItem
            label="Sell Price"
            value={`£${vehicle.sellPrice ?? 0}`}
            theme={theme}
          />
          <BreakItem label="Profit" value={`£${profit}`} theme={theme} />
          <BreakItem
            label="Margin"
            value={`${margin.toFixed(1)}%`}
            theme={theme}
          />
        </Section>

        {/* ATTRIBUTES */}
        <Section title="Attributes" theme={theme}>
          <IconItem
            label="Rarity"
            value={vehicle.rarity ?? "Unknown"}
            icon={rarityIcon(vehicle.rarity ?? undefined)}
            theme={theme}
          />
          <IconItem
            label="Condition"
            value={vehicle.ai?.condition ?? "Unknown"}
            icon={conditionIcon(vehicle.ai?.condition ?? undefined)}
            theme={theme}
          />
          <IconItem
            label="Sell Speed"
            value={vehicle.sellSpeed ?? "Unknown"}
            icon={speedIcon(vehicle.sellSpeed ?? undefined)}
            theme={theme}
          />
        </Section>

        {/* MARKET DATA */}
        <Section title="Market Data" theme={theme}>
          <BreakItem
            label="Demand Score"
            value={`${demandScore}/100`}
            theme={theme}
          />
          <Bar value={demandScore} theme={theme} />

          <BreakItem
            label="AI Confidence"
            value={`${aiConfidence}/100`}
            theme={theme}
          />
          <Bar value={aiConfidence} theme={theme} />
        </Section>

        {/* TIMELINE */}
        {timeline.length > 0 && (
          <Section title="Timeline" theme={theme}>
            {timeline.map((event, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  {new Date(event.date).toLocaleDateString()}
                </Text>
                <Text style={{ color: theme.white, fontSize: 14, fontWeight: "600" }}>
                  {event.label}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {/* AI PRO TIPS */}
        {vehicle.proTips && vehicle.proTips.length > 0 && (
          <Section title="AI Pro Tips" theme={theme}>
            {vehicle.proTips.map((tip: string, i: number) => (
              <Animated.View
                key={i}
                entering={FadeIn.duration(400).delay(i * 120)}
                style={{
                  backgroundColor: theme.card,
                  borderRadius: theme.radius.md,
                  padding: 12,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: theme.goldSoftGlow,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    color: theme.goldDeep,
                    marginTop: -2,
                  }}
                >
                  ⚡
                </Text>

                <Text
                  style={{
                    color: theme.white,
                    fontSize: 15,
                    lineHeight: 20,
                    flex: 1,
                  }}
                >
                  {tip}
                </Text>
              </Animated.View>
            ))}
          </Section>
        )}

        {/* MOT SECTION */}
        {vehicle.mot && (
          <Section title="MOT & Tax Status" theme={theme}>
            <BreakItem
              label="Make"
              value={vehicle.mot.make ?? "N/A"}
              theme={theme}
            />
            <BreakItem
              label="Model"
              value={vehicle.mot.model ?? "N/A"}
              theme={theme}
            />
            <BreakItem
              label="Year"
              value={vehicle.mot.year ?? "N/A"}
              theme={theme}
            />
            <BreakItem
              label="Registration"
              value={vehicle.mot.reg ?? "N/A"}
              theme={theme}
            />
            <BreakItem
              label="MOT Status"
              value={vehicle.mot.motStatus ?? "Unknown"}
              theme={theme}
            />
            <BreakItem
              label="MOT Expiry"
              value={vehicle.mot.motExpiry ?? "N/A"}
              theme={theme}
            />
            <BreakItem
              label="Mileage"
              value={vehicle.mot.mileage ?? "N/A"}
              theme={theme}
            />
            <BreakItem
              label="Tax Status"
              value={vehicle.mot.taxStatus ?? "Unknown"}
              theme={theme}
            />

            {vehicle.mot.advisories && vehicle.mot.advisories.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text
                  style={{
                    color: theme.white,
                    fontSize: 16,
                    fontWeight: "600",
                    marginBottom: 6,
                  }}
                >
                  Advisories
                </Text>

                {vehicle.mot.advisories.map((adv: string, i: number) => (
                  <Text
                    key={i}
                    style={{ color: theme.muted, marginBottom: 4 }}
                  >
                    • {adv}
                  </Text>
                ))}
              </View>
            )}
          </Section>
        )}

        {/* ACTION BUTTONS */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.goldDeep, borderRadius: theme.radius.md },
          ]}
          onPress={() => router.push(`/vehicles/edit/${vehicle.id}`)}
        >
          <Text style={[styles.buttonText, { color: theme.black }]}>
            Edit Flip
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deleteButton,
            { borderColor: theme.goldDeep, borderRadius: theme.radius.md },
          ]}
          onPress={() => deleteVehicle(vehicle.id)}
        >
          <Text style={[styles.buttonText, { color: theme.goldDeep }]}>
            Delete Flip
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* AI ADVISOR MODAL */}
      {vehicle.aiPrice && (
        <Modal
          visible={advisorVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setAdvisorVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.6)",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <View
              style={{
                backgroundColor: theme.card,
                borderRadius: 24,
                borderWidth: 2,
                borderColor: theme.goldDeep,
                padding: 20,
                maxHeight: "80%",
              }}
            >
              <ScrollView>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "700",
                    color: theme.accent,
                    marginBottom: 10,
                  }}
                >
                  🤖 AI Advisor
                </Text>

                <BreakItem
                  label="Recommended Sell Price"
                  value={
                    vehicle.aiPrice?.recommendedSellPrice
                      ? `£${vehicle.aiPrice.recommendedSellPrice}`
                      : "N/A"
                  }
                  theme={theme}
                />

                <BreakItem
                  label="AI Confidence"
                  value={
                    vehicle.aiPrice?.confidence
                      ? `${vehicle.aiPrice.confidence}/100`
                      : "N/A"
                  }
                  theme={theme}
                />
                <Bar
                  value={vehicle.aiPrice?.confidence ?? 0}
                  theme={theme}
                />

                <BreakItem
                  label="Risk Level"
                  value={vehicle.aiPrice?.riskLevel ?? "Unknown"}
                  theme={theme}
                />

                <BreakItem
                  label="Planned vs AI Price"
                  value={
                    vehicle.aiPrice?.recommendedSellPrice
                      ? `You planned £${vehicle.sellPrice ?? 0}, AI suggests £${
                          vehicle.aiPrice.recommendedSellPrice
                        }`
                      : "N/A"
                  }
                  theme={theme}
                />

                {vehicle.aiPrice?.notes && (
                  <View style={{ marginTop: 12 }}>
                    <Text
                      style={{
                        color: theme.white,
                        fontSize: 16,
                        fontWeight: "600",
                        marginBottom: 6,
                      }}
                    >
                      AI Notes
                    </Text>
                    <Text style={{ color: theme.muted }}>
                      {vehicle.aiPrice.notes}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => setAdvisorVisible(false)}
                  style={{
                    marginTop: 18,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: theme.accent,
                    borderWidth: 2,
                    borderColor: theme.goldDeep,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: theme.black,
                      fontWeight: "700",
                      fontSize: 16,
                    }}
                  >
                    Close Advisor
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

/* ============================================================
   QUICK ACTIONS
============================================================ */
function QuickActions({
  vehicle,
  theme,
  router,
  onOpenAdvisor,
}: {
  vehicle: FlipRecord;
  theme: Theme;
  router: any;
  onOpenAdvisor: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <ActionButton
        label="📸 Gallery"
        theme={theme}
        onPress={() => router.push(`/vehicles/gallery/${vehicle.id}`)}
      />

      <ActionButton
        label="🕒 MOT Timeline"
        theme={theme}
        onPress={() => router.push(`/mot/${vehicle.id}`)}
      />

      <ActionButton
        label="📈 Market Scan"
        theme={theme}
        onPress={() => router.push(`/vehicles/market/${vehicle.id}`)}
      />

      {vehicle.aiPrice && (
        <ActionButton
          label="🤖 AI Advisor"
          theme={theme}
          gold
          onPress={onOpenAdvisor}
        />
      )}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  theme,
  gold,
}: {
  label: string;
  onPress: () => void;
  theme: Theme;
  gold?: boolean;
}) {
  return (
    <TouchableOpacity
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: theme.radius.md,
        backgroundColor: gold ? theme.goldDeep : theme.card,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
      }}
      onPress={onPress}
    >
      <Text style={{ color: gold ? theme.black : theme.white }}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ============================================================
   AI INSIGHTS HERO SECTION
============================================================ */
function AIInsights({
  theme,
  aiPrice,
  aiRisk,
  aiConfidence,
  aiNotes,
  profit,
  sellPrice,
}: {
  theme: Theme;
  aiPrice: number | null;
  aiRisk: string | null;
  aiConfidence: number | null;
  aiNotes: string | null;
  profit: number;
  sellPrice: number;
}) {
  const glow = useSharedValue(0);

  glow.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);

  const animatedStyle = useAnimatedStyle(() => ({
    shadowColor: theme.goldDeep,
    shadowOpacity: glow.value * 0.4,
    shadowRadius: glow.value * 20,
  }));

  const riskColor =
    aiRisk === "low"
      ? "#4CAF50"
      : aiRisk === "medium"
      ? "#FFD966"
      : aiRisk === "high"
      ? "#FF6666"
      : theme.muted;

  return (
    <Animated.View
      style={[
        {
          backgroundColor: theme.card,
          padding: 18,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          marginBottom: 20,
        },
        animatedStyle,
      ]}
    >
      <Text
        style={{
          color: theme.white,
          fontSize: 20,
          fontWeight: "700",
          marginBottom: 10,
        }}
      >
        AI Insights
      </Text>

      <BreakItem
        label="Recommended Sell Price"
        value={aiPrice ? `£${aiPrice}` : "N/A"}
        theme={theme}
      />

      <View
        style={{
          marginTop: 10,
          paddingVertical: 6,
          paddingHorizontal: 12,
          backgroundColor: riskColor,
          borderRadius: theme.radius.md,
          alignSelf: "flex-start",
        }}
      >
        <Text
          style={{
            color: theme.black,
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          Risk Level: {aiRisk ?? "Unknown"}
        </Text>
      </View>

      <BreakItem
        label="AI Confidence"
        value={aiConfidence ? `${aiConfidence}/100` : "N/A"}
        theme={theme}
      />
      <Bar value={aiConfidence ?? 0} theme={theme} />

      <BreakItem
        label="Profit vs AI Price"
        value={
          aiPrice
            ? `You planned £${sellPrice}, AI suggests £${aiPrice}`
            : "N/A"
        }
        theme={theme}
      />

      {aiNotes && (
        <View style={{ marginTop: 12 }}>
          <Text
            style={{
              color: theme.white,
              fontSize: 16,
              fontWeight: "600",
              marginBottom: 6,
            }}
          >
            AI Notes
          </Text>
          <Text style={{ color: theme.muted }}>{aiNotes}</Text>
        </View>
      )}
    </Animated.View>
  );
}

/* ============================================================
   SPARKLE DUST
============================================================ */
function SparkleDust({ theme }: { theme: Theme }) {
  const particles = Array.from({ length: 12 });

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {particles.map((_, i) => (
        <SparkleParticle key={i} theme={theme} />
      ))}
    </View>
  );
}

function SparkleParticle({ theme }: { theme: Theme }) {
  const x = useSharedValue(Math.random() * 300);
  const y = useSharedValue(Math.random() * 600);

  useEffect(() => {
    x.value = withRepeat(
      withTiming(Math.random() * 300, { duration: 6000 }),
      -1,
      true
    );
    y.value = withRepeat(
      withTiming(Math.random() * 600, { duration: 8000 }),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    opacity: 0.4,
  }));

  return (
    <Animated.Text style={[{ color: theme.goldDeep }, style]}>
      ✨
    </Animated.Text>
  );
}

/* ============================================================
   SECTION
============================================================ */
function Section({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: Theme;
}) {
  const glow = useSharedValue(0);

  glow.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true);

  const animatedStyle = useAnimatedStyle(() => ({
    shadowColor: theme.goldDeep,
    shadowOpacity: glow.value * 0.4,
    shadowRadius: glow.value * 18,
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: theme.card,
          padding: 16,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
          marginBottom: 20,
        },
        animatedStyle,
      ]}
    >
      <Text
        style={{
          color: theme.white,
          fontSize: 18,
          fontWeight: "600",
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      {children}
    </Animated.View>
  );
}

/* ============================================================
   BREAK ITEM
============================================================ */
function BreakItem({
  label,
  value,
  theme,
}: {
  label: string;
  value: string | number;
  theme: Theme;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: theme.muted, fontSize: 14 }}>{label}</Text>
      <Text
        style={{
          color: theme.white,
          fontSize: 16,
          fontWeight: "600",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/* ============================================================
   ICON ITEM
============================================================ */
function IconItem({
  label,
  value,
  icon,
  theme,
}: {
  label: string;
  value: string;
  icon: string;
  theme: Theme;
}) {
  return (
    <View
      style={{
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <View>
        <Text style={{ color: theme.muted, fontSize: 14 }}>{label}</Text>
        <Text
          style={{
            color: theme.white,
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/* ============================================================
   SAFE ICON HELPERS
============================================================ */
const rarityIcon = (r: string | undefined): string => {
  if (r === "Ultra Rare") return "👑";
  if (r === "Rare") return "💎";
  if (r === "Uncommon") return "✨";
  if (r === "Common") return "📦";
  return "❓";
};

const conditionIcon = (c: string | undefined): string => {
  if (c === "Excellent") return "🌟";
  if (c === "Good") return "👍";
  if (c === "Fair") return "🛠️";
  if (c === "Poor") return "💔";
  return "❓";
};

const speedIcon = (s: string | undefined): string => {
  if (s === "Fast") return "⚡";
  if (s === "Medium") return "🚶‍♂️";
  if (s === "Slow") return "🐌";
  return "❓";
};

/* ============================================================
   FLEX BAR
============================================================ */
function Bar({ value, theme }: { value: number; theme: Theme }) {
  const safe = Math.max(0, Math.min(100, value));

  return (
    <View
      style={{
        height: 12,
        backgroundColor: theme.muted,
        borderRadius: theme.radius.full,
        overflow: "hidden",
        marginTop: 6,
        flexDirection: "row",
      }}
    >
      <View
        style={{
          flex: safe,
          backgroundColor:
            safe > 75
              ? theme.goldDeep
              : safe > 50
              ? "#FFD966"
              : "#FF6666",
        }}
      />

      <View style={{ flex: 100 - safe }} />
    </View>
  );
}

/* ============================================================
   STYLES
============================================================ */
const styles = StyleSheet.create({
  heading: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 10,
  },
  button: {
    paddingVertical: 14,
    marginTop: 10,
  },
  deleteButton: {
    paddingVertical: 14,
    marginTop: 10,
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
