import { ScrollView, TouchableOpacity, Text, View } from "react-native";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";

import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export default function MotorsHub() {
  const theme = useTheme();
  const router = useRouter();

  const { dealerMode, setDealerMode, setFlashTrigger, vehicles } =
    useVehicleHistory();

  useEffect(() => {
    if (!dealerMode && vehicles.length > 0) {
      setDealerMode(true);
      setFlashTrigger(Date.now());
    }
  }, [dealerMode, vehicles.length]);

  const recentVehicles = [...vehicles]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 3);

  const activeVehicle: FlipRecord | null =
    recentVehicles[0] || vehicles[0] || null;

  const totalFlips = vehicles.length;

  const totalProfit = vehicles.reduce((sum: number, v: FlipRecord) => {
    const sell = v.sellPrice ?? v.valuation ?? 0;
    const buy = v.buyPrice ?? 0;
    return sum + (sell - buy);
  }, 0);

  const avgScore =
    totalFlips > 0
      ? Math.round(
          vehicles.reduce(
            (sum: number, v: FlipRecord) => sum + (v.flipScore ?? 0),
            0
          ) / totalFlips
        )
      : null;

  const bestFlip: FlipRecord | null =
    vehicles.length > 0
      ? [...vehicles].sort((a, b) => {
          const profitA =
            (a.sellPrice ?? a.valuation ?? 0) - (a.buyPrice ?? 0);
          const profitB =
            (b.sellPrice ?? b.valuation ?? 0) - (b.buyPrice ?? 0);
          return profitB - profitA;
        })[0]
      : null;

  const motAttention = vehicles.filter((v: FlipRecord) => {
    const expiry = v.mot?.motExpiry ?? v.mot?.expiryDate;
    if (!expiry) return false;
    const days = Math.ceil(
      (new Date(expiry).getTime() - Date.now()) / 86400000
    );
    return days <= 30;
  });

  const highScore = vehicles
    .filter((v: FlipRecord) => (v.flipScore ?? 0) >= 75)
    .slice(0, 3);

  const undervalued = vehicles
    .filter((v: FlipRecord) => {
      const valuation = v.valuation ?? 0;
      const buy = v.buyPrice ?? 0;
      return valuation - buy >= 1000;
    })
    .slice(0, 3);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* HEADER */}
      <Text
        style={{
          fontSize: 32,
          fontWeight: "800",
          color: theme.goldDeep,
          marginBottom: 12,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        FlipPilot Motors
      </Text>

      {/* VEHICLE STATS */}
      <Card title="Vehicle Stats" theme={theme}>
        <Stat label="Vehicles Flipped" value={totalFlips} theme={theme} />
        <Stat
          label="Total Profit"
          value={`£${totalProfit.toFixed(2)}`}
          theme={theme}
        />
        <Stat
          label="Avg Flip Score"
          value={`${avgScore ?? "?"}/100`}
          theme={theme}
        />
        <Stat label="Best Flip" value={bestFlip?.title ?? "-"} theme={theme} />
        <Stat label="MOT Attention" value={motAttention.length} theme={theme} />
      </Card>


      {/* Monthly Profit Timeline */}
      <Card title="Monthly Profit Timeline" theme={theme}>
        <MonthlyProfitTimeline vehicles={vehicles} theme={theme} />
      </Card>

      {/* Spotlight */}
      <Card title="Spotlight" theme={theme}>
        {bestFlip ? (
          <Text style={{ color: theme.accent, marginTop: 8 }}>
            {bestFlip.title} is your top performer.
          </Text>
        ) : (
          <Text style={{ color: theme.muted, marginTop: 8 }}>
            No vehicle flips yet. Start your first one.
          </Text>
        )}
      </Card>

      {/* Top Performing Cars */}
      <Card title="Top Performing Cars" theme={theme}>
        <TopPerformers vehicles={vehicles} theme={theme} router={router} />
      </Card>

      {/* Quick Actions */}
      <Card title="Quick Actions" theme={theme}>
        <QuickButton
          label="New Flip"
          onPress={() => router.push("/vehicles/new")}
          theme={theme}
        />
        <QuickButton
          label="MOT Lookup"
          onPress={() => router.push("/vehicles/mot-lookup")}
          theme={theme}
        />
        <QuickButton
          label="Vehicle List"
          onPress={() => router.push("/vehicles/list")}
          theme={theme}
        />
        <QuickButton
          label="Edit Flip"
          onPress={() => router.push("/vehicles/edit-lookup")}
          theme={theme}
        />
        <QuickButton
          label="Marketplace"
          onPress={() => router.push("/marketplace")}
          theme={theme}
        />
        <QuickButton
          label="Create Listing"
          onPress={() => router.push("/marketplace/create")}
          theme={theme}
        />
      </Card>

      {/* Recent Vehicles */}
      <SectionList
        title="Recent Vehicles"
        items={recentVehicles}
        theme={theme}
        router={router}
      />

      {/* MOT Attention */}
      <SectionList
        title="MOT Attention"
        items={motAttention}
        theme={theme}
        router={router}
      />

      {/* Upcoming MOT Expiries */}
      <Card title="Upcoming MOT Expiries" theme={theme}>
        <MotExpiryList items={motAttention} theme={theme} router={router} />
      </Card>

      {/* High Score */}
      <SectionList
        title="High Score Vehicles"
        items={highScore}
        theme={theme}
        router={router}
      />

      {/* Undervalued */}
      <SectionList
        title="Undervalued Vehicles"
        items={undervalued}
        theme={theme}
        router={router}
      />

    </ScrollView>
  );
}

/* ⭐ Fully Typed Helper Components */

function Card({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: any;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        marginBottom: 20,
      }}
    >
      <Text style={{ color: theme.white, fontSize: 18, fontWeight: "700" }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Stat({
  label,
  value,
  theme,
}: {
  label: string;
  value: string | number;
  theme: any;
}) {
  return (
    <Text style={{ color: theme.muted, marginTop: 6 }}>
      {label}: {value}
    </Text>
  );
}

function QuickButton({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: theme.goldDeep,
        padding: 12,
        borderRadius: theme.radius.md,
        marginTop: 10,
      }}
    >
      <Text
        style={{
          color: theme.black,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SectionList({
  title,
  items,
  theme,
  router,
}: {
  title: string;
  items: FlipRecord[];
  theme: any;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        marginBottom: 20,
      }}
    >
      <Text style={{ color: theme.white, fontSize: 18, fontWeight: "700" }}>
        {title}
      </Text>

      {items.length === 0 ? (
        <Text style={{ color: theme.muted, marginTop: 8 }}>None found.</Text>
      ) : (
        items.map((v: FlipRecord) => (
          <TouchableOpacity
            key={v.id}
            onPress={() => router.push(`/vehicles/overview/${v.id}`)}
            style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: theme.black,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.goldSoftGlow,
            }}
          >
            <Text style={{ color: theme.white, fontWeight: "700" }}>
              {v.title}
            </Text>
            <Text style={{ color: theme.muted }}>
              Score: {v.flipScore ?? "?"}/100 • Profit: £
              {(v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0)}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function MonthlyProfitTimeline({
  vehicles,
  theme,
}: {
  vehicles: FlipRecord[];
  theme: any;
}) {
  const monthly: Record<string, number> = {};

  vehicles.forEach((v: FlipRecord) => {
    const month = new Date(v.timestamp).toLocaleString("en-GB", {
      month: "short",
    });
    const profit =
      (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);

    monthly[month] = (monthly[month] ?? 0) + profit;
  });

  const entries = Object.entries(monthly) as [string, number][];

  return (
    <View style={{ marginTop: 10 }}>
      {entries.length === 0 ? (
        <Text style={{ color: theme.muted }}>No data yet.</Text>
      ) : (
        entries.map(([month, profit]) => (
          <View key={month} style={{ marginBottom: 8 }}>
            <Text style={{ color: theme.white }}>
              {month}: £{profit.toFixed(0)}
            </Text>
            <View
              style={{
                height: 8,
                backgroundColor: theme.black,
                borderRadius: theme.radius.full,
                overflow: "hidden",
                marginTop: 4,
              }}
            >
              <View
                style={{
                  width: Math.min(100, profit / 10),
                  height: "100%",
                  backgroundColor:
                    profit > 500
                      ? theme.goldDeep
                      : profit > 200
                      ? "#FFD966"
                      : "#FF6666",
                }}
              />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function TopPerformers({
  vehicles,
  theme,
  router,
}: {
  vehicles: FlipRecord[];
  theme: any;
  router: ReturnType<typeof useRouter>;
}) {
  const sorted = [...vehicles]
    .sort((a, b) => {
      const profitA =
        (a.sellPrice ?? a.valuation ?? 0) - (a.buyPrice ?? 0);
      const profitB =
        (b.sellPrice ?? b.valuation ?? 0) - (b.buyPrice ?? 0);
      return profitB - profitA;
    })
    .slice(0, 3);

  if (sorted.length === 0)
    return <Text style={{ color: theme.muted }}>No flips yet.</Text>;

  return sorted.map((v: FlipRecord) => {
    const profit =
      (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);

    return (
      <TouchableOpacity
        key={v.id}
        onPress={() => router.push(`/vehicles/overview/${v.id}`)}
        style={{
          marginTop: 12,
          padding: 12,
          backgroundColor: theme.black,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
      >
        <Text style={{ color: theme.white, fontWeight: "700" }}>
          {v.title}
        </Text>
        <Text style={{ color: theme.accent }}>Profit: £{profit}</Text>
      </TouchableOpacity>
    );
  });
}

function MotExpiryList({
  items,
  theme,
  router,
}: {
  items: FlipRecord[];
  theme: any;
  router: ReturnType<typeof useRouter>;
}) {
  if (items.length === 0)
    return <Text style={{ color: theme.muted }}>No MOT issues.</Text>;

  return items.map((v: FlipRecord) => {
    const rawExpiry = v.mot?.motExpiry ?? v.mot?.expiryDate ?? null;
    if (!rawExpiry) return null;

    const expiry = new Date(rawExpiry);

    const daysLeft = Math.ceil(
      (expiry.getTime() - Date.now()) / 86400000
    );

    const color =
      daysLeft <= 7 ? "#FF4444" : daysLeft <= 30 ? "#FFD966" : theme.white;

    return (
      <TouchableOpacity
        key={v.id}
        onPress={() => router.push(`/vehicles/overview/${v.id}`)}
        style={{
          marginTop: 12,
          padding: 12,
          backgroundColor: theme.black,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.goldSoftGlow,
        }}
      >
        <Text style={{ color: theme.white, fontWeight: "700" }}>
          {v.title}
        </Text>
        <Text style={{ color }}>
          MOT expires in {daysLeft} days
        </Text>
      </TouchableOpacity>
    );
  });
}
