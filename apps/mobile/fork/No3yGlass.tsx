/**
 * The glass behind the no3y controls and composer card — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. Native liquid glass where iOS has it, the
 * app's blur-and-tint backdrop (GlassBackdrop) elsewhere. It sits behind a control's content as an
 * absolute layer, the way ThreadComposer's own surface does, so presses land on the content.
 */
import { GlassView } from "expo-glass-effect";
import { StyleSheet, View } from "react-native";

import { GlassBackdrop } from "../src/components/ui/GlassBackdrop";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { NATIVE_LIQUID_GLASS_SUPPORTED } from "../src/native/native-glass";
import { flatGlassPalette } from "./flatGlassTheme";

/** Every glass panel above the composer takes 6pt on each side, so the pills, each panel and the
    composer sit 12pt apart whichever panels show. */
export const NO3Y_PANEL_MARGIN = { marginHorizontal: 16, marginVertical: 6 } as const;

export function No3yGlassLayer(props: {
  readonly radius: number;
  readonly tint?: string | undefined;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  if (NATIVE_LIQUID_GLASS_SUPPORTED) {
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        colorScheme={themeAppearance === "dark" ? "dark" : "light"}
        {...(props.tint === undefined ? {} : { tintColor: props.tint })}
        style={[StyleSheet.absoluteFill, { borderRadius: props.radius, overflow: "hidden" }]}
      />
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: props.radius,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.panelBorder,
        },
      ]}
    >
      <GlassBackdrop fallbackColor={palette.panelFallback} />
      {props.tint === undefined ? null : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: props.tint }]} />
      )}
    </View>
  );
}
