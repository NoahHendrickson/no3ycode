/**
 * Flat Glass status section header matching `SidebarV2StatusSectionHeader.tsx`
 * — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 *
 * Quiet 13px semibold label, fainter tabular count beside it, trailing chevron,
 * no hairline rule.
 */
import {
  SIDEBAR_V2_STATUS_SECTION_LABELS,
  type SidebarV2StatusHeaderKey,
} from "./forkStatusGrouping";
import { memo } from "react";
import { Pressable } from "react-native";

import { SymbolView } from "../src/components/ui/AppSymbol";
import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { flatGlassPalette } from "./flatGlassTheme";

export const No3yStatusSectionHeader = memo(function No3yStatusSectionHeader(props: {
  readonly section: SidebarV2StatusHeaderKey;
  readonly count: number;
  readonly isFirst: boolean;
  readonly collapsed: boolean;
  readonly disabled?: boolean;
  readonly onToggle: (section: SidebarV2StatusHeaderKey) => void;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const label = SIDEBAR_V2_STATUS_SECTION_LABELS[props.section];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${props.count} ${props.count === 1 ? "thread" : "threads"}`}
      accessibilityState={{ expanded: !props.collapsed, disabled: props.disabled }}
      disabled={props.disabled}
      onPress={() => props.onToggle(props.section)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 16,
        paddingTop: props.isFirst ? 10 : 20,
        paddingBottom: 6,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          lineHeight: 16,
          fontWeight: "600",
          color: palette.quietInk,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          lineHeight: 16,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
          color: palette.faintInk,
        }}
      >
        {props.count}
      </Text>
      <SymbolView
        name={props.collapsed ? "chevron.down" : "chevron.up"}
        size={10}
        tintColor={palette.faintInk}
        type="monochrome"
        style={{ marginLeft: "auto" }}
      />
    </Pressable>
  );
});
