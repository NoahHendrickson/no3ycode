/**
 * The iPhone's interface font: the system face (SF Pro) or Cinnabar Interface, the desktop's face —
 * see `.fork/customizations.yaml#no3y-mobile-interface-font`. app.config.ts bundles the faces;
 * AppearancePreferencesProvider applies the pick to Uniwind and publishes it here.
 */
import { useSyncExternalStore } from "react";

export type No3yInterfaceFont = "system" | "cinnabar";

export const NO3Y_INTERFACE_FONT_OPTIONS: ReadonlyArray<{
  readonly font: No3yInterfaceFont;
  readonly label: string;
}> = [
  { font: "system", label: "System" },
  { font: "cinnabar", label: "Cinnabar Interface" },
];

export function normalizeNo3yInterfaceFont(value: unknown): No3yInterfaceFont {
  return value === "cinnabar" ? "cinnabar" : "system";
}

// PostScript names: RCTFont resolves one to its family and picks the face nearest the requested
// weight, and the native composer's UIFont(name:) needs a face name, not a family.
const FONT_FAMILIES_BY_FONT = {
  system: { regular: "System", medium: "System", bold: "System" },
  cinnabar: {
    regular: "CinnabarInterface-Regular",
    medium: "CinnabarInterface-Medium",
    bold: "CinnabarInterface-Bold",
  },
} as const satisfies Record<No3yInterfaceFont, Record<"regular" | "medium" | "bold", string>>;

/** The global.css font tokens the `font-sans` / `font-t3-*` utilities read. */
export function no3yInterfaceFontVariables(font: No3yInterfaceFont) {
  const families = FONT_FAMILIES_BY_FONT[font];
  return {
    "--font-sans": families.regular,
    "--font-medium": families.medium,
    "--font-bold": families.bold,
  };
}

let current: No3yInterfaceFont = "system";
const listeners = new Set<() => void>();

/** Returns whether the font changed. */
export function publishNo3yInterfaceFont(font: No3yInterfaceFont): boolean {
  if (font === current) return false;
  current = font;
  for (const listener of listeners) listener();
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getFont = () => current;

export function useNo3yInterfaceFont(): No3yInterfaceFont {
  return useSyncExternalStore(subscribe, getFont, getFont);
}

/** The families native-styled text (markdown, the composer) passes where classes can't reach. */
export function useNo3yFontFamilies() {
  return FONT_FAMILIES_BY_FONT[useNo3yInterfaceFont()];
}
