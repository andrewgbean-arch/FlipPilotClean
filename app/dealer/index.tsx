import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";

const NAVY = "#0A1128";
const GOLD = "#FFD700";
const SILVER = "#AAB4C3";
const CARD = "#111827";

export default function DealerHome() {
  return (
    <View style={{ flex: 1, backgroundColor: NAVY }}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>

        {/* HEADER */}
        <View
          style={{
            backgroundColor: CARD,
            padding: 24,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: GOLD,
            marginBottom: 28,
          }}
        >
          <Text
            style={{
              color: GOLD,
              fontSize: 30,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            FlipPilot Dealer
          </Text>
          <Text
            style={{
              color: SILVER,
              fontSize: 15,
              textAlign: "center",
              marginTop: 8,
            }}
          >
            Professional dealership tools
          </Text>
        </View>

        {/* GRID */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <DealerGridButton
            label="Dealer Dashboard"
            icon="🚀"
            route="/dealer/DealerDashboardV11"
          />

          <DealerGridButton
            label="Motors Dashboard"
            icon="🚗"
            route="/dealer/dealer-motors-dashboard"
          />

          <DealerGridButton
            label="Stock Hub"
            icon="📦"
            route="/dealer/dealer-stock"
          />

          <DealerGridButton
            label="Intelligence Hub"
            icon="🧠"
            route="/dealer/dealer-intelligence"
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

          <DealerGridButton
            label="CRM Hub"
            icon="👥"
            route="/dealer/DealerCRMHub"
          />

          <DealerGridButton
            label="Finance Hub"
            icon="💳"
            route="/dealer/dealer-finance"
          />

          <DealerGridButton
            label="Marketing Hub"
            icon="📣"
            route="/dealer/DealerMarketingHub"
          />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

type DealerGridButtonProps = {
  label: string;
  icon: string;
  route: string;
};

function DealerGridButton({ label, icon, route }: DealerGridButtonProps) {

  return (
    <TouchableOpacity
      onPress={() => router.push(route)}
      style={{
        backgroundColor: CARD,
        borderRadius: 20,
        paddingVertical: 24,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: GOLD,
        width: "48%",
        marginBottom: 16,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: GOLD, fontSize: 28, fontWeight: "900" }}>
        {icon}
      </Text>
      <Text
        style={{
          color: SILVER,
          fontSize: 16,
          marginTop: 8,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
