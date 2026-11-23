/**
 * "Next message compacts history · 525K tokens" on the no3y iPhone composer: one 44pt glass pill
 * in the thread header bubbles' style, stacked above the composer card (and the queued banner) —
 * see `.fork/customizations.yaml#no3y-mobile-redesign` and fork/no3yCompactCopy.ts.
 */
import ArrowShrink02Icon from "@hugeicons/core-free-icons/ArrowShrink02Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import { formatTokens } from "@t3tools/shared/usageFormat";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { flatGlassPalette, NO3Y_CONTROL_SIZE, NO3Y_FONT } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { no3yCompactBannerCopy } from "./no3yCompactCopy";
import { No3yGlassLayer } from "./No3yGlass";
import { NO3Y_GLASS_RISE_IN, NO3Y_LAYOUT } from "./no3yMotion";

const BUBBLE = NO3Y_CONTROL_SIZE;
const PILL_HEIGHT = 32;

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
    // The thread header's glass bubble: a 44pt pill with its controls nested inside, as the
    // usage and ⋯ group nests its buttons.
    <Animated.View
      entering={NO3Y_GLASS_RISE_IN}
      layout={NO3Y_LAYOUT}
      style={{
        marginHorizontal: 16,
        marginBottom: 6,
        height: BUBBLE,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 14,
        paddingRight: copy.action.kind === "pill" ? (BUBBLE - PILL_HEIGHT) / 2 : 0,
      }}
    >
      <No3yGlassLayer radius={BUBBLE / 2} />
      <HugeIcon icon={ArrowShrink02Icon} size={18} color={palette.foreground} />
      <View
        accessible
        accessibilityLabel={`${copy.message}, ${tokens}`}
        style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" }}
      >
        <Text
          numberOfLines={1}
          style={{ flexShrink: 0, fontSize: 15, ...NO3Y_FONT.medium, color: palette.titleInk }}
        >
          {copy.message}
        </Text>
        {/* The token count gives way first when the row is short of room. */}
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            minWidth: 0,
            fontSize: 15,
            ...NO3Y_FONT.regular,
            color: palette.metaInk,
          }}
        >
          {` · ${tokens}`}
        </Text>
      </View>
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
          <Text style={{ fontSize: 14, ...NO3Y_FONT.medium, color: palette.foreground }}>
            {copy.action.label}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.action.label}
          onPress={props.onToggleKeepFullHistory}
          style={({ pressed }) => ({
            width: BUBBLE,
            height: BUBBLE,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <HugeIcon icon={Cancel01Icon} size={20} color={palette.foreground} />
        </Pressable>
      )}
    </Animated.View>
  );
}
