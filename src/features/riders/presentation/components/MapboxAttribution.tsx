/**
 * Mapbox credits for any map that draws a route from POST /api/routing/directions.
 *
 * Mapbox Product Terms (2026-10-20) §1.4.1 and §1.4.2 require the Mapbox logo,
 * "© Mapbox", "© OpenStreetMap" and "Improve this map" (lower right of the map).
 * The app can't tell whether the backend used Mapbox or OSRM, so callers show this
 * whenever a route map is on screen. Callers place it with `style` (absolute).
 */

import { SaganaImage } from "@/components/ui/SaganaImage";
import { fontFamily } from "@/constants/FontTheme";
import { useT } from "@/lib/i18n";
import { Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

const LINKS = [
  { text: "© Mapbox", url: "https://www.mapbox.com/about/maps/", a11y: "mapCredit.mapbox" },
  { text: "© OpenStreetMap", url: "https://www.openstreetmap.org/copyright", a11y: "mapCredit.osm" },
  { text: "Improve this map", url: "https://apps.mapbox.com/feedback/", a11y: "mapCredit.improve" },
] as const;

export default function MapboxAttribution({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <View style={[styles.box, style]}>
      <SaganaImage
        source={require("@/assets/images/mapbox-logo.png")}
        style={styles.logo}
        contentFit="contain"
        accessibilityRole="image"
        accessibilityLabel={t("mapCredit.logo")}
      />
      <View style={styles.links}>
        {LINKS.map((link) => (
          <Pressable
            key={link.url}
            onPress={() => Linking.openURL(link.url).catch(() => {})}
            hitSlop={{ top: 10, bottom: 10, left: 3, right: 3 }}
            accessibilityRole="link"
            accessibilityLabel={t(link.a11y)}
          >
            <Text style={styles.link}>{link.text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "flex-end",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  logo: {
    width: 81,
    height: 20,
  },
  links: {
    flexDirection: "row",
    gap: 6,
  },
  link: {
    fontSize: 10,
    fontFamily: fontFamily.medium,
    color: "#1C1C1C",
    textDecorationLine: "underline",
  },
});
