/** Soft fade behind the dock and bottom trays — see `.fork/customizations.yaml#no3y-mobile-redesign`. */
import { useId } from "react";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { NO3Y_BOTTOM_FADE_HEIGHT } from "./flatGlassTheme";

/** Transparent at the top to `color` at the bottom. */
export function No3yBottomFade(props: { readonly color: string }) {
  const id = `no3y-fade-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <Svg width="100%" height={NO3Y_BOTTOM_FADE_HEIGHT} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={props.color} stopOpacity={0} />
          <Stop offset="1" stopColor={props.color} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
