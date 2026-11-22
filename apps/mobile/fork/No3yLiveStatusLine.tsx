/**
 * The live turn's one status line at the bottom of the no3y transcript — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`: the bead ring, what the agent is doing now,
 * the turn's timer, and a chevron that opens the running tool group when there is one.
 */
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { useVisibleSecondClock } from "../src/features/threads/use-visible-second-clock";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { No3yBeadRing } from "./No3yBeadRing";
import { no3yTurnTimerLabel } from "./no3yLiveStatus";

export function No3yLiveStatusLine(props: {
  readonly label: string;
  readonly startedAt: string | null;
  readonly minHeight: number;
  /** Present when the line stands for a tool group it can open. */
  readonly group?: { readonly expanded: boolean; readonly onToggle: () => void };
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const nowMs = useVisibleSecondClock(props.startedAt !== null);
  const timer = props.startedAt === null ? null : no3yTurnTimerLabel(props.startedAt, nowMs);
  const content = (
    <>
      <No3yBeadRing color={palette.statusWorking} size={16} />
      <Text
        numberOfLines={1}
        style={{ flexShrink: 1, ...NO3Y_FONT.medium, fontSize: 15, color: palette.foreground }}
      >
        {props.label}
      </Text>
      {timer ? (
        <Text style={{ fontSize: 13, fontVariant: ["tabular-nums"], color: palette.metaInk }}>
          {timer}
        </Text>
      ) : null}
      <View style={{ flex: 1 }} />
      {props.group ? (
        <HugeIcon
          icon={props.group.expanded ? ArrowUp01Icon : ArrowDown01Icon}
          size={14}
          color={palette.quietInk}
        />
      ) : null}
    </>
  );
  const rowStyle = {
    minHeight: props.minHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  } as const;
  return props.group ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.label}${timer ? `, ${timer}` : ""}`}
      accessibilityState={{ expanded: props.group.expanded }}
      onPress={props.group.onToggle}
      style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  ) : (
    <View
      accessible
      accessibilityLabel={`${props.label}${timer ? `, ${timer}` : ""}`}
      style={rowStyle}
    >
      {content}
    </View>
  );
}
