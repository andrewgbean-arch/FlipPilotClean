import { Pressable, Image, View, Text } from "react-native";

export default function MarketplaceListingCard({
  id,
  year,
  make,
  model,
  reg,
  price,
  mileage,
  thumbnail,
  theme,
  onPress,
}: {
  id: string;
  year: string | number;
  make: string;
  model: string;
  reg: string;
  price: number;
  mileage?: number | null;
  thumbnail?: string | null;
  theme: any;
  onPress: (id: string) => void;
}) {
  return (
    <Pressable onPress={() => onPress(id)}>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          backgroundColor: theme.card,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        {/* IMAGE */}
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            style={{
              width: "100%",
              height: 160,
            }}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: 160,
              backgroundColor: theme.blackSoft,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.text }}>No Image</Text>
          </View>
        )}

        {/* CONTENT */}
        <View style={{ padding: 14 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: theme.accent,
              marginBottom: 4,
              textShadowColor: theme.goldSoftGlow,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 6,
            }}
          >
            {year} {make} {model}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: theme.text,
              marginBottom: 10,
            }}
          >
            {reg}
          </Text>

          <Text style={{ color: theme.text }}>
            📍 Mileage:{" "}
            <Text style={{ color: theme.accent }}>
              {mileage ?? "Unknown"}
            </Text>
          </Text>

          <Text style={{ color: theme.text }}>
            💷 Price:{" "}
            <Text style={{ color: theme.accent }}>
              £{price.toLocaleString()}
            </Text>
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
