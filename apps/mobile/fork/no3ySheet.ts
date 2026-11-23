/**
 * no3y half sheets on iOS 26 (no3y-mobile-redesign): the native sheet owns the surface and its
 * shape, concentric with the display, so the content stays clear. An opaque page-coloured body
 * drew a second, smaller corner inside the sheet's. Earlier iOS keeps the page colour.
 */
import { NATIVE_LIQUID_GLASS_SUPPORTED } from "../src/native/native-glass";

export function no3ySheetBackground(pageColor: string): string {
  return NATIVE_LIQUID_GLASS_SUPPORTED ? "transparent" : pageColor;
}

export function no3ySheetOptions<Options extends object>(options: Options): Options {
  return NATIVE_LIQUID_GLASS_SUPPORTED
    ? { ...options, contentStyle: { backgroundColor: "transparent" } }
    : options;
}
