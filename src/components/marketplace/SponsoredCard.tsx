import React, { useEffect } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";

import AdReportButton from "@/components/AdReportButton";
import { markShown } from "@/lib/adRotation";
import { reportAdvertEvent } from "@/lib/adverts";
import type { BusinessAdvert } from "@/lib/businessAdverts";
import { useTheme } from "@/styles/ThemeContext";

/**
 * A paid advert in the marketplace feed, made to sit between listings but never
 * to pass for one: it always says "Sponsored", and it opens the advertiser's
 * website, not a listing.
 *
 * Kept plain on purpose (no looping animation): the feed is long and scrolling
 * it smoothly matters more than a glow.
 */
const SponsoredCard = React.memo(function SponsoredCard({ advert }: { advert: BusinessAdvert }) {
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
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole={advert.website ? "button" : undefined}
        accessibilityLabel={
          advert.website ? `Sponsored: ${advert.title}. Visit website` : `Sponsored: ${advert.title}`
        }
        disabled={!advert.website}
        onPress={open}
      >
        <Image source={{ uri: advert.image }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
        <View style={{ padding: 14 }}>
          <View
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: theme.goldDeep,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: theme.black, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 }}>
              SPONSORED
            </Text>
          </View>
          <Text style={{ color: theme.goldDeep, fontSize: 20, fontWeight: "800" }} numberOfLines={2}>
            {advert.title}
          </Text>
          {advert.tagline ? (
            <Text style={{ color: theme.text, fontWeight: "700", marginTop: 4 }} numberOfLines={2}>
              {advert.tagline}
            </Text>
          ) : null}
          {advert.description ? (
            <Text style={{ color: theme.muted, marginTop: 4 }} numberOfLines={3}>
              {advert.description}
            </Text>
          ) : null}
          {advert.website ? (
            <Text style={{ color: theme.goldDeep, fontWeight: "800", marginTop: 10 }}>Visit website →</Text>
          ) : null}
        </View>
      </Pressable>
      <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
        <AdReportButton advertId={advert.id} />
      </View>
    </View>
  );
});

export default SponsoredCard;
