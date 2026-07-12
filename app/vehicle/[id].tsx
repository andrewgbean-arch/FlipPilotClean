import { useLocalSearchParams } from "expo-router";
import { ScrollView, View, Image } from "react-native";
import ThemedText from "@/components/ThemedText";
import ThemedView from "@/components/ThemedView";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useTheme } from "@/context/ThemeContext";

export default function VehicleDetails() {
  const { id } = useLocalSearchParams();
  const { vehicles } = useVehicleHistory();
  const theme = useTheme();

  const vehicle = vehicles.find((v) => v.id === id);

  if (!vehicle) return <ThemedText>Vehicle not found.</ThemedText>;

  const safeBuy = vehicle.buyPrice || 0;
  const safeSell = vehicle.sellPrice || 0;
  const profit = safeSell - safeBuy;
  const roi = safeBuy > 0 ? ((safeSell - safeBuy) / safeBuy) * 100 : 0;

  const hasImages = Array.isArray(vehicle.images) && vehicle.images.length > 0;

  return (
    <ScrollView style={{ padding: 20 }}>
      {/* TITLE */}
      <ThemedText
        style={{
          fontSize: 28,
          fontWeight: "bold",
          marginBottom: 16,
          color: theme.accent,
        }}
      >
        {vehicle.title}
      </ThemedText>

      {/* IMAGE */}
      {hasImages && (
        <Image
          source={{ uri: vehicle.images![0] }}
          style={{
            width: "100%",
            height: 220,
            borderRadius: 16,
            marginBottom: 20,
            borderWidth: 2,
            borderColor: theme.goldDeep,
          }}
        />
      )}

  {/* FLIP SCORE */}
<ThemedView
  style={{
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.goldDeep,
    backgroundColor: theme.card,
  }}
>
  <ThemedText style={{ fontSize: 20, marginBottom: 6 }}>
    🔥 Flip Score
  </ThemedText>

  {/* SAFE VALUE */}
  <ThemedText
    style={{
      fontSize: 32,
      fontWeight: "bold",
      color: theme.accent,
    }}
  >
    {(vehicle.flipScore ?? 0)}/100
  </ThemedText>

  {/* SAFE GRADE */}
  <ThemedText style={{ fontSize: 16, color: theme.text, marginTop: 6 }}>
    {(() => {
      const score = vehicle.flipScore ?? 0;

      if (score >= 80) return "Excellent flip potential";
      if (score >= 60) return "Strong flip";
      if (score >= 40) return "Moderate flip";
      return "High-risk flip";
    })()}
  </ThemedText>
</ThemedView>


      {/* PROFIT CARD */}
      <ThemedView
        style={{
          marginBottom: 16,
          padding: 16,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          backgroundColor: theme.card,
        }}
      >
        <ThemedText style={{ fontSize: 20, marginBottom: 6 }}>
          💰 Profit & ROI
        </ThemedText>

        <ThemedText style={{ fontSize: 16, color: theme.text }}>
          Profit: £{profit}
        </ThemedText>

        <ThemedText style={{ fontSize: 16, color: theme.text }}>
          ROI: {roi.toFixed(1)}%
        </ThemedText>
      </ThemedView>

      {/* AI VALUATION */}
      <ThemedView
        style={{
          marginBottom: 16,
          padding: 16,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          backgroundColor: theme.card,
        }}
      >
        <ThemedText style={{ fontSize: 20, marginBottom: 6 }}>
          🤖 AI Valuation
        </ThemedText>

        {vehicle.aiPrice ? (
          <>
            <ThemedText style={{ fontSize: 16, color: theme.text }}>
              Recommended Sell: £{vehicle.aiPrice.recommendedSellPrice}
            </ThemedText>

            <ThemedText style={{ fontSize: 16, color: theme.text }}>
              Risk Level: {vehicle.aiPrice.riskLevel}
            </ThemedText>

            <ThemedText style={{ fontSize: 16, color: theme.text }}>
              Confidence: {(vehicle.aiPriceConfidence || 0) * 100}%
            </ThemedText>

            <ThemedText style={{ fontSize: 16, color: theme.text }}>
              Range: £{vehicle.aiPriceMin} – £{vehicle.aiPriceMax}
            </ThemedText>

            {vehicle.insights && (
              <ThemedText
                style={{ fontSize: 16, color: theme.text, marginTop: 8 }}
              >
                Insights: {vehicle.insights}
              </ThemedText>
            )}
          </>
        ) : (
          <ThemedText style={{ fontSize: 16, color: theme.text }}>
            No AI valuation yet.
          </ThemedText>
        )}
      </ThemedView>

      {/* MARKET INSIGHTS */}
      {vehicle.market && (
        <ThemedView
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: theme.goldDeep,
            backgroundColor: theme.card,
          }}
        >
          <ThemedText style={{ fontSize: 20, marginBottom: 6 }}>
            📈 Market Insights
          </ThemedText>

          {/* Price Range */}
          {vehicle.market.googlePriceMin != null &&
            vehicle.market.googlePriceMax != null && (
              <ThemedText style={{ fontSize: 16, color: theme.text }}>
                Range: £{vehicle.market.googlePriceMin} – £
                {vehicle.market.googlePriceMax}
              </ThemedText>
            )}

          {/* Lowest / Highest */}
          {vehicle.market.lowest != null &&
            vehicle.market.highest != null && (
              <ThemedText style={{ fontSize: 16, color: theme.text }}>
                Lowest: £{vehicle.market.lowest} • Highest: £
                {vehicle.market.highest}
              </ThemedText>
            )}

          {/* Average */}
          {vehicle.market.average != null && (
            <ThemedText style={{ fontSize: 16, color: theme.text }}>
              Average: £{vehicle.market.average}
            </ThemedText>
          )}

          {/* Smart Price */}
          {vehicle.market.smartPrice != null && (
            <ThemedText style={{ fontSize: 16, color: theme.text }}>
              Smart Price: £{vehicle.market.smartPrice}
            </ThemedText>
          )}

          {/* Sold Count */}
          {vehicle.market.soldCount != null && (
            <ThemedText style={{ fontSize: 16, color: theme.text }}>
              Sold Count: {vehicle.market.soldCount}
            </ThemedText>
          )}

          {/* Demand Score */}
          {vehicle.market.demandScore != null && (
            <ThemedText style={{ fontSize: 16, color: theme.text }}>
              Demand Score: {vehicle.market.demandScore}
            </ThemedText>
          )}

          {/* AI Confidence Range */}
          {(vehicle.market.aiPriceMin != null ||
            vehicle.market.aiPriceMax != null ||
            vehicle.market.aiPriceConfidence != null) && (
            <>
              <ThemedText
                style={{ fontSize: 16, marginTop: 8, color: theme.text }}
              >
                AI Price Range: £{vehicle.market.aiPriceMin} – £
                {vehicle.market.aiPriceMax}
              </ThemedText>

              <ThemedText style={{ fontSize: 16, color: theme.text }}>
                AI Confidence: {(vehicle.market.aiPriceConfidence || 0) * 100}%
              </ThemedText>
            </>
          )}
        </ThemedView>
      )}

      {/* MOT */}
      <ThemedView
        style={{
          marginBottom: 16,
          padding: 16,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: theme.goldDeep,
          backgroundColor: theme.card,
        }}
      >
        <ThemedText style={{ fontSize: 20, marginBottom: 6 }}>
          🚗 MOT Status
        </ThemedText>

        <ThemedText style={{ fontSize: 16, color: theme.text }}>
          Status: {vehicle.mot?.motStatus ?? "Unknown"}
        </ThemedText>

        {vehicle.mot?.expiryDate && (
          <ThemedText style={{ fontSize: 16, color: theme.text }}>
            Expiry: {vehicle.mot.expiryDate}
          </ThemedText>
        )}

        {/* Mileage History */}
        {vehicle.mot?.mileageHistory?.length ? (
          <>
            <ThemedText style={{ fontSize: 16, marginTop: 8 }}>
              Mileage History:
            </ThemedText>

            {vehicle.mot.mileageHistory.map(
              (m: { date: string; mileage: number }, idx: number) => (
                <ThemedText key={idx} style={{ fontSize: 14, opacity: 0.8 }}>
                  {m.date}: {m.mileage} miles
                </ThemedText>
              )
            )}
          </>
        ) : null}

        {/* Advisories */}
        {vehicle.mot?.advisories?.length ? (
          <>
            <ThemedText style={{ fontSize: 16, marginTop: 8 }}>
              Advisories:
            </ThemedText>

            {vehicle.mot.advisories.map((a: string, idx: number) => (
              <ThemedText key={idx} style={{ fontSize: 14, opacity: 0.8 }}>
                • {a}
              </ThemedText>
            ))}
          </>
        ) : null}

        {/* Failures */}
        {vehicle.mot?.failures?.length ? (
          <>
            <ThemedText style={{ fontSize: 16, marginTop: 8 }}>
              Failures:
            </ThemedText>

            {vehicle.mot.failures.map((f: string, idx: number) => (
              <ThemedText key={idx} style={{ fontSize: 14, opacity: 0.8 }}>
                • {f}
              </ThemedText>
            ))}
          </>
        ) : null}
      </ThemedView>

      {/* AI PRO TIPS */}
      {Array.isArray(vehicle.proTips) && vehicle.proTips.length > 0 && (
        <ThemedView
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: theme.goldDeep,
            backgroundColor: theme.card,
          }}
        >
          <ThemedText style={{ fontSize: 20, marginBottom: 6 }}>
            💡 AI Pro Tips
          </ThemedText>

          {vehicle.proTips.map((tip, idx) => (
            <ThemedText
              key={idx}
              style={{ fontSize: 16, color: theme.text, marginBottom: 4 }}
            >
              • {tip}
            </ThemedText>
          ))}
        </ThemedView>
      )}

      {/* NOTES */}
      {vehicle.notes && (
        <ThemedView
          style={{
            marginBottom: 40,
            padding: 16,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: theme.goldDeep,
            backgroundColor: theme.card,
          }}
        >
          <ThemedText style={{ fontSize: 20, marginBottom: 6 }}>
            📝 Notes
          </ThemedText>

          <ThemedText style={{ fontSize: 16, color: theme.text }}>
            {vehicle.notes}
          </ThemedText>
        </ThemedView>
      )}
    </ScrollView>
  );
}
