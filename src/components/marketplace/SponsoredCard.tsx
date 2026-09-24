import React, { useEffect } from "react";
import { Image, Linking, Text, TouchableOpacity, View } from "react-native";

import AdReportButton from "@/components/AdReportButton";
import { HouseFeedCard } from "@/components/HousePromo";
import { markShown } from "@/lib/adRotation";
import { reportAdvertEvent } from "@/lib/adverts";
import type { BusinessAdvert } from "@/lib/businessAdverts";
import { useTheme } from "@/styles/ThemeContext";

/**
 * A paid advert in the marketplace feed, made to sit between listings but never
 * to pass for one: it always says "Sponsored", and it opens the advertiser's
 * website, not a listing.
 *
 * Small like a listing card, and like one only its button (Visit) opens
 * anything: touching or scrolling past the card never sends anyone off to a
 * website by accident.
 *
 * Kept plain on purpose (no looping animation): the feed is long and scrolling
 * it smoothly matters more than a glow.
 */
const PaidCard = React.memo(function PaidCard({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();

  // Scrolling back past the same advert shouldn't count as a new view each time.
  useEffect(() => {
    markShown(advert.id);
    reportAdvertEvent(advert.id, "view", 30);
  }, [advert.id]);

  const open = () => {
    reportAdvertEvent(advert.id, "click");
    if (advert.website) Linking.openURL(advert.website);
  };

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.goldDeep,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row" }}>
        <Image
          source={{ uri: advert.image }}
          style={{ width: 104, alignSelf: "stretch", minHeight: 112 }}
          resizeMode="cover"
        />
        <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, justifyContent: "space-between" }}>
          <View>
            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: theme.goldDeep,
                marginBottom: 4,
              }}
            >
              <Text style={{ color: theme.black, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 }}>
                SPONSORED
              </Text>
            </View>
            <Text style={{ color: theme.goldDeep, fontSize: 16, fontWeight: "700" }} numberOfLines={2}>
              {advert.title}
            </Text>
            {advert.tagline || advert.description ? (
              <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                {advert.tagline ?? advert.description}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <AdReportButton advertId={advert.id} />
            {advert.website ? (
              <TouchableOpacity
                onPress={open}
                accessibilityRole="button"
                accessibilityLabel={`Sponsored: ${advert.title}. Visit website`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  backgroundColor: theme.goldDeep,
                  paddingHorizontal: 18,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: theme.black, fontSize: 13, fontWeight: "800" }}>Visit</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
});

/** A paying advertiser's card, or one of FlipPilot's own promos filling an unsold place. */
const SponsoredCard = React.memo(function SponsoredCard({ advert }: { advert: BusinessAdvert }) {
  return advert.house ? <HouseFeedCard advert={advert} /> : <PaidCard advert={advert} />;
});

export default SponsoredCard;
