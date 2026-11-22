/**
 * The bottom tray that holds a screen's frequent controls (prompt bar, search, filters) just above
 * the dock, on a soft fade so the list behind stays legible — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import type { ReactNode } from "react";
import { View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NO3Y_BOTTOM_NAV_CLEARANCE } from "./flatGlassTheme";
import { No3yBottomFade } from "./No3yBottomFade";
import { useNo3yBottomNavEnabled } from "./No3yBottomNav";

/** Height of the bars the tray holds; lists pad by it so their last row clears the tray. */
export const NO3Y_TRAY_BAR_HEIGHT = 40;

/** Where the tray's bar rests above the screen bottom: over the dock when it shows. */
export function useNo3yTrayRestingInset(): number {
  const insets = useSafeAreaInsets();
  const dock = useNo3yBottomNavEnabled();
  return Math.max(insets.bottom, 10) + (dock ? NO3Y_BOTTOM_NAV_CLEARANCE : 0);
}

/** Bottom padding a list behind the tray needs so its last row scrolls clear of the bar. */
export function useNo3yTrayContentInset(): number {
  return useNo3yTrayRestingInset() + NO3Y_TRAY_BAR_HEIGHT + 16;
}

export function No3yBottomTray(props: { readonly color: string; readonly children: ReactNode }) {
  const resting = useNo3yTrayRestingInset();
  return (
    <KeyboardStickyView
      offset={{ closed: 0, opened: Math.max(0, resting - 8) }}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
    >
      <No3yBottomFade color={props.color} />
      <View
        style={{
          backgroundColor: props.color,
          paddingHorizontal: 16,
          paddingBottom: resting,
        }}
      >
        {props.children}
      </View>
    </KeyboardStickyView>
  );
}
