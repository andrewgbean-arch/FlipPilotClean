import { ScrollView, View, Text } from "react-native";

export default function MileageFlow({
  history,
  theme,
}: {
  history: { date: string; mileage: number }[];
  theme: any;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 24 }}
      contentContainerStyle={{ alignItems: "center", paddingVertical: 10 }}
    >
      {history.map((entry, idx) => {
        const isLast = idx === history.length - 1;

        return (
          <View
            key={idx}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginRight: isLast ? 0 : 24,
            }}
          >
            <View style={{ alignItems: "center" }}>
              {/* GOLD DOT */}
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: theme.goldDeep,
                  shadowColor: theme.goldSoftGlow,
                  shadowOpacity: 0.6,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />

              {/* DATE */}
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: theme.text,
                  textAlign: "center",
                }}
              >
                {entry.date}
              </Text>

              {/* MILEAGE */}
              <Text
                style={{
                  fontSize: 14,
                  color: theme.text,
                  fontWeight: "700",
                  marginTop: 2,
                }}
              >
                {entry.mileage} mi
              </Text>
            </View>

            {/* CONNECTOR LINE */}
            {!isLast && (
              <View
                style={{
                  width: 40,
                  height: 2,
                  backgroundColor: theme.goldDeep,
                  marginLeft: 8,
                }}
              />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
