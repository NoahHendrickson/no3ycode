/**
 * "Next message compacts history · 525K tokens" on the no3y iPhone composer: one glass row stacked
 * right above the composer card, as the queued-messages banner is, the Mac's composer banner
 * treatment — see `.fork/customizations.yaml#no3y-mobile-redesign` and fork/no3yCompactCopy.ts.
 */
import ArrowShrink02Icon from "@hugeicons/core-free-icons/ArrowShrink02Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import { formatTokens } from "@t3tools/shared/usageFormat";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { no3yCompactBannerCopy } from "./no3yCompactCopy";
import { No3yGlassLayer } from "./No3yGlass";
import { NO3Y_GLASS_RISE_IN, NO3Y_LAYOUT } from "./no3yMotion";

const RADIUS = 22;
const PILL_HEIGHT = 30;

export function No3yCompactBanner(props: {
  readonly tokens: number;
  readonly keepFullHistory: boolean;
  readonly onToggleKeepFullHistory: () => void;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const copy = no3yCompactBannerCopy(props.keepFullHistory);
  const tokens = `${formatTokens(props.tokens)} tokens`;
  return (
    <Animated.View
      entering={NO3Y_GLASS_RISE_IN}
      layout={NO3Y_LAYOUT}
      style={{ marginHorizontal: 16, marginBottom: 6, borderRadius: RADIUS }}
    >
      <No3yGlassLayer radius={RADIUS} />
      <View
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingLeft: 16,
          paddingRight: copy.action.kind === "pill" ? 7 : 6,
        }}
      >
        <HugeIcon icon={ArrowShrink02Icon} size={16} color={palette.quietInk} />
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontSize: 14, ...NO3Y_FONT.medium, color: palette.titleInk }}
        >
          {copy.message}
          <Text style={{ ...NO3Y_FONT.regular, color: palette.metaInk }}>{` · ${tokens}`}</Text>
        </Text>
        {copy.action.kind === "pill" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.action.label}
            onPress={props.onToggleKeepFullHistory}
            style={({ pressed }) => ({
              height: PILL_HEIGHT,
              justifyContent: "center",
              paddingHorizontal: 12,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <No3yGlassLayer radius={PILL_HEIGHT / 2} />
            <Text style={{ fontSize: 13, ...NO3Y_FONT.medium, color: palette.foreground }}>
              {copy.action.label}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.action.label}
            hitSlop={6}
            onPress={props.onToggleKeepFullHistory}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <HugeIcon icon={Cancel01Icon} size={16} color={palette.quietInk} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
