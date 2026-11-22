/**
 * Status section header for the iOS Threads list — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. A muted Geist label with a chevron that
 * points down while the section is open; the count stays in the accessibility label.
 */
import ChevronDownIcon from "@hugeicons/core-free-icons/ChevronDownIcon";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import {
  SIDEBAR_V2_STATUS_SECTION_LABELS,
  type SidebarV2StatusHeaderKey,
} from "./forkStatusGrouping";
import { HugeIcon } from "./HugeIcon";

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
    <View style={{ paddingTop: props.isFirst ? 10 : 20, paddingHorizontal: 18 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${props.count} ${props.count === 1 ? "thread" : "threads"}`}
        accessibilityState={{ expanded: !props.collapsed, disabled: props.disabled }}
        disabled={props.disabled}
        hitSlop={{ top: 8, bottom: 8, right: 24 }}
        onPress={() => props.onToggle(props.section)}
        style={({ pressed }) => ({
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          height: 24,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Text
          numberOfLines={1}
          style={{
            ...NO3Y_FONT.medium,
            fontSize: 14,
            lineHeight: 16,
            color: palette.sectionInk,
          }}
        >
          {label}
        </Text>
        <View
          style={{
            width: 20,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ rotate: props.collapsed ? "-90deg" : "0deg" }],
          }}
        >
          <HugeIcon icon={ChevronDownIcon} size={14} color={palette.sectionInk} filled />
        </View>
      </Pressable>
    </View>
  );
});
