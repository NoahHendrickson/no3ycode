/**
 * The glass card the no3y sheets group rows in (`.fork/customizations.yaml#no3y-mobile-redesign`):
 * the Agents sheet's subagent cards, the linked pull request cards and the Activity sheet's
 * sections. Rows inside draw their own top hairline from the second row on.
 */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import type { FlatGlassPalette } from "./flatGlassTheme";

export function No3yGlassCard(props: {
  readonly palette: FlatGlassPalette;
  readonly children: ReactNode;
}) {
  const { palette } = props;
  return (
    <View
      style={{
        marginTop: 8,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.controlBorder,
        backgroundColor: palette.controlSurface,
        overflow: "hidden",
      }}
    >
      {props.children}
    </View>
  );
}

/** The hairline a card row draws above itself when it follows another row. */
export function no3yCardDivider(palette: FlatGlassPalette, divider: boolean | undefined) {
  return divider
    ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.controlBorder }
    : null;
}
