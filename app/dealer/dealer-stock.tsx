import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from "react-native";
import { router } from "expo-router";

import { useTheme } from "@/styles/ThemeContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";   // ⭐ ADDED
import { DealerGridButton } from "@/components/dealer/DealerGridButton";

import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

export default function DealerStockHub() {
  const theme = useTheme();

  const { vehicles: cars, deleteVehicle } = useVehicleHistory();

  async function handleDelete(id: string) {
    deleteVehicle(id);
  }

  const [search, setSearch] = useState("");

  const filteredCars = useMemo(() => {
    if (!search.trim()) return cars;
    const s = search.toLowerCase();
    return cars.filter((v: FlipRecord) => {
      return (
        String(v.id).toLowerCase().includes(s) ||
        String(v.mileage ?? "").includes(s) ||
        String(v.valuation ?? "").includes(s) ||
        String(v.flipScore ?? "").includes(s)
      );
    });
  }, [search, cars]);

  const [sortMode, setSortMode] = useState<
    "newest" | "oldest" | "profit" | "mileage" | "flipScore"
  >("newest");

  const sortedCars = useMemo(() => {
    const list = [...filteredCars];

    switch (sortMode) {
      case "profit":
        return list.sort(
          (a: FlipRecord, b: FlipRecord) =>
            (b.sellPrice ?? b.valuation ?? 0) -
            (b.buyPrice ?? 0) -
            ((a.sellPrice ?? a.valuation ?? 0) - (a.buyPrice ?? 0))
        );

      case "mileage":
        return list.sort(
          (a: FlipRecord, b: FlipRecord) => (a.mileage ?? 0) - (b.mileage ?? 0)
        );

      case "flipScore":
        return list.sort(
          (a: FlipRecord, b: FlipRecord) =>
            (b.flipScore ?? 0) - (a.flipScore ?? 0)
        );

      case "oldest":
        return list.sort(
          (a: FlipRecord, b: FlipRecord) =>
            new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime()
        );

      default:
      case "newest":
        return list.sort(
          (a: FlipRecord, b: FlipRecord) =>
            new Date(b.timestamp).getTime() -
            new Date(a.timestamp).getTime()
        );
    }
  }, [filteredCars, sortMode]);

  const [quickOpen, setQuickOpen] = useState(false);

  const insights = useMemo(() => {
    const total = cars.length;

    const totalValuation = cars.reduce(
      (sum: number, v: FlipRecord) =>
        sum + (v.valuation ?? v.sellPrice ?? v.buyPrice ?? 0),
      0
    );

    const avgFlipScore =
      total === 0
        ? 0
        : Math.round(
            cars.reduce(
              (sum: number, v: FlipRecord) => sum + (v.flipScore ?? 0),
              0
            ) / total
          );

    const motRisk = cars.filter((v: FlipRecord) => {
      const expiry = v.mot?.motExpiry ?? v.mot?.expiryDate;
      if (!expiry) return false;
      const days =
        (new Date(expiry).getTime() - Date.now()) / 86400000;
      return days <= 30;
    }).length;

    const undervalued = cars.filter((v: FlipRecord) => {
      const valuation = v.valuation ?? 0;
      const buy = v.buyPrice ?? 0;
      return valuation - buy >= 1500;
    }).length;

    return {
      total,
      totalValuation,
      avgFlipScore,
      motRisk,
      undervalued,
    };
  }, [cars]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>

      {/* ⭐ ADDED — Premium Dealer Header */}
      <DealerNeonHeader
        title="Dealer Stock Hub"
        subtitle="Manage, Analyse & Optimise Your Stock"
      />

      <ScrollView style={{ padding: 20 }}>
        
        {/* ⭐ Modern 2‑wide Dealer Navigation Grid */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            marginBottom: 25,
          }}
        >
          <DealerGridButton
            label="Dealer Dashboard"
            icon="📊"
            route="/dealer/DealerDashboardV11"
          />

          <DealerGridButton
            label="Finance Hub"
            icon="💳"
            route="/dealer/dealer-finance"
          />

          <DealerGridButton
            label="CRM Hub"
            icon="👥"
            route="/dealer/DealerCRMHub"
          />

          <DealerGridButton
            label="Marketing Hub"
            icon="📣"
            route="/dealer/dealer-marketing"
          />

          <DealerGridButton
            label="Risk Hub"
            icon="⚠️"
            route="/dealer/dealer-risk"
          />

          <DealerGridButton
            label="Sales Hub"
            icon="💰"
            route="/dealer/dealer-sales"
          />
        </View>

        {/* ⭐ Header */}
        <Text
          style={{
            fontSize: 30,
            fontWeight: "900",
            color: theme.accent,
            marginBottom: 20,
          }}
        >
          Dealer Stock Hub
        </Text>

        {/* ⭐ Insights */}
        <InsightsBar insights={insights} theme={theme} />

        {/* ⭐ Search */}
        <TextInput
          placeholder="Search stock…"
          placeholderTextColor={theme.muted}
          value={search}
          onChangeText={setSearch}
          style={{
            backgroundColor: theme.card,
            padding: 14,
            borderRadius: theme.radius.md,
            color: theme.text,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
          }}
        />

        {/* ⭐ Sort */}
        <SortBar sortMode={sortMode} setSortMode={setSortMode} theme={theme} />

        {/* ⭐ Stock List */}
        {sortedCars.map((v: FlipRecord) => (
          <TouchableOpacity
            key={v.id}
            onPress={() =>
              router.push({
                pathname: "/motors/dealer-intelligence",
                params: { id: v.id },
              })
            }
          >
            <StockCard vehicle={v} theme={theme} handleDelete={handleDelete} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ⭐ Quick Switcher */}
      <QuickSwitcher
        open={quickOpen}
        setOpen={setQuickOpen}
        vehicles={cars}
        theme={theme}
      />

      {/* ⭐ Floating Switch Button */}
      <TouchableOpacity
        onPress={() => setQuickOpen(true)}
        style={{
          position: "absolute",
          bottom: 30,
          right: 30,
          backgroundColor: theme.accent,
          padding: 18,
          borderRadius: 50,
        }}
      >
        <Text style={{ color: theme.background, fontWeight: "900" }}>
          Switch
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* -------------------------------------------------------
   ⭐ COMPONENTS
------------------------------------------------------- */

function InsightsBar({
  insights,
  theme,
}: {
  insights: {
    total: number;
    totalValuation: number;
    avgFlipScore: number;
    motRisk: number;
    undervalued: number;
  };
  theme: any;
}) {

  return (
    <SupernovaCard title="Dealership Insights" glow style={{ marginBottom: 20 }}>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: "800" }}>
        Dealership Insights
      </Text>

      <Text style={{ color: theme.secondary }}>Total Stock: {insights.total}</Text>
      <Text style={{ color: theme.secondary }}>
        Total Valuation: £{insights.totalValuation}
      </Text>
      <Text style={{ color: theme.secondary }}>
        Avg FlipScore: {insights.avgFlipScore}
      </Text>
      <Text style={{ color: theme.secondary }}>
        MOT Risk: {insights.motRisk}
      </Text>
      <Text style={{ color: theme.secondary }}>
        Undervalued: {insights.undervalued}
      </Text>
    </SupernovaCard>
  );
}

function SortBar({
  sortMode,
  setSortMode,
  theme,
}: {
  sortMode: "newest" | "oldest" | "profit" | "mileage" | "flipScore";
  setSortMode: (
    mode: "newest" | "oldest" | "profit" | "mileage" | "flipScore"
  ) => void;
  theme: any;
}) {

  const modes = [
    { key: "newest", label: "Newest" },
    { key: "oldest", label: "Oldest" },
    { key: "profit", label: "Profit" },
    { key: "mileage", label: "Mileage" },
    { key: "flipScore", label: "FlipScore" },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        marginBottom: 20,
        gap: 10,
      }}
    >
      {modes.map((m) => (
        <TouchableOpacity
          key={m.key}
          onPress={() => setSortMode(m.key as typeof sortMode)}
          style={{
            backgroundColor:
              sortMode === m.key ? theme.accent : theme.card,
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: theme.radius.md,
          }}
        >
          <Text
            style={{
              color:
                sortMode === m.key ? theme.background : theme.secondary,
              fontWeight: "700",
            }}
          >
            {m.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function StockCard({
  vehicle,
  theme,
  handleDelete,
}: {
  vehicle: FlipRecord;
  theme: any;
  handleDelete: (id: string) => void;
}) {

  const profit =
    (vehicle.sellPrice ?? vehicle.valuation ?? 0) -
    (vehicle.buyPrice ?? 0);

  const expiry = vehicle.mot?.motExpiry ?? vehicle.mot?.expiryDate;

  return (
    <SupernovaCard title={`Flip #${vehicle.id}`} glow style={{ marginBottom: 20 }}>
      <Text
        style={{
          color: theme.text,
          fontSize: 20,
          fontWeight: "800",
          marginBottom: 6,
        }}
      >
        Flip #{vehicle.id}
      </Text>

      <Text style={{ color: theme.secondary, fontSize: 16 }}>
        £{vehicle.valuation ?? vehicle.sellPrice ?? vehicle.buyPrice ?? "—"} •{" "}
        {vehicle.mileage ?? "—"} miles
      </Text>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <Badge label={`FlipScore ${vehicle.flipScore ?? 0}`} theme={theme} />

        {vehicle.sellDate && (
          <Badge label="Sold" theme={theme} color={theme.goldDeep} />
        )}

        {expiry && (
          <Badge label={`MOT: ${expiry}`} theme={theme} color="#66FF99" />
        )}

        <Badge label={`Profit £${profit}`} theme={theme} />

        <TouchableOpacity
          onPress={() => handleDelete(vehicle.id)}
          style={{
            backgroundColor: "#FF4444",
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: theme.radius.md,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </SupernovaCard>
  );
}

function Badge({
  label,
  theme,
  color,
}: {
  label: string;
  theme: any;
  color?: string;
}) {

  return (
    <View
      style={{
        backgroundColor: color ?? theme.accent,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: theme.radius.md,
      }}
    >
      <Text style={{ color: theme.background, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}

function QuickSwitcher({
  open,
  setOpen,
  vehicles,
  theme,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  vehicles: FlipRecord[];
  theme: any;
}) {

  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return vehicles;
    const q = query.toLowerCase();
    return vehicles.filter((v: FlipRecord) =>
      String(v.id).toLowerCase().includes(q)
    );
  }, [query, vehicles]);

  return (
    <Modal visible={open} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "#000000AA",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: theme.card,
            padding: 20,
            borderRadius: theme.radius.lg,
          }}
        >
          <TextInput
            placeholder="Quick switch…"
            placeholderTextColor={theme.muted}
            value={query}
            onChangeText={setQuery}
            style={{
              backgroundColor: theme.background,
              padding: 14,
              borderRadius: theme.radius.md,
              color: theme.text,
              marginBottom: 20,
            }}
          />

          <ScrollView style={{ maxHeight: 300 }}>
            {results.map((v: FlipRecord) => (
              <TouchableOpacity
                key={v.id}
                onPress={() => {
                  setOpen(false);
                  router.push({
                    pathname: "/motors/dealer-intelligence",
                    params: { id: v.id },
                  });
                }}
              >
                <Text
                  style={{
                    color: theme.text,
                    fontSize: 18,
                    paddingVertical: 10,
                  }}
                >
                  Flip #{v.id}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={() => setOpen(false)}
            style={{
              marginTop: 20,
              backgroundColor: theme.accent,
              padding: 12,
              borderRadius: theme.radius.md,
            }}
          >
            <Text
              style={{
                color: theme.background,
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
