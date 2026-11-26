/**
 * The iPhone's interface font: the system face (SF Pro) or Cinnabar Interface, the desktop's face —
 * see `.fork/customizations.yaml#no3y-mobile-interface-font`. app.config.ts bundles the faces;
 * no3yInterfaceFontState.ts applies the pick. Kept free of app state: persistence and the font
 * family hooks import it.
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

export function isNo3yInterfaceFont(value: unknown): value is No3yInterfaceFont {
  return NO3Y_INTERFACE_FONT_OPTIONS.some((option) => option.font === value);
}

// The family name lets RCTFont keep an inherited italic or weight (bold inside *italic*); a
// PostScript name would pin that face. Medium stays a face: chip links pass no weight.
export const NO3Y_FONT_FAMILIES = {
  system: { regular: "System", medium: "System", bold: "System" },
  cinnabar: {
    regular: "Cinnabar Interface",
    medium: "CinnabarInterface-Medium",
    bold: "Cinnabar Interface",
  },
} as const satisfies Record<No3yInterfaceFont, Record<"regular" | "medium" | "bold", string>>;

/** The Swift composer's UIFont(name:) needs a face, not a family; "System" falls back to SF Pro. */
export const NO3Y_COMPOSER_FONT_FACES = {
  system: "System",
  cinnabar: "CinnabarInterface-Regular",
} as const satisfies Record<No3yInterfaceFont, string>;

/** The global.css font tokens the `font-sans` / `font-t3-*` utilities read. */
export function no3yInterfaceFontVariables(font: No3yInterfaceFont) {
  const families = NO3Y_FONT_FAMILIES[font];
  return {
    "--font-sans": families.regular,
    "--font-medium": families.medium,
    "--font-bold": families.bold,
  };
}

// A mirror of the picked font for the family hooks, which load with every markdown and composer
// module; importing app state there breaks their mocked test suites. installNo3yInterfaceFont feeds it.
let current: No3yInterfaceFont = "system";
const listeners = new Set<() => void>();

export function publishNo3yInterfaceFont(font: No3yInterfaceFont) {
  current = font;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getFont = () => current;

function usePublishedFont() {
  return useSyncExternalStore(subscribe, getFont, getFont);
}

/** The families native-styled text (markdown, link chips) passes where classes can't reach. */
export function useNo3yFontFamilies() {
  return NO3Y_FONT_FAMILIES[usePublishedFont()];
}

export function useNo3yComposerFontFace() {
  return NO3Y_COMPOSER_FONT_FACES[usePublishedFont()];
}
