/* fork:begin no3y-mobile-interface-font — see .fork/customizations.yaml#no3y-mobile-interface-font */
import { useNo3yComposerFontFace, useNo3yFontFamilies } from "../../fork/no3yInterfaceFont";
/* fork:end no3y-mobile-interface-font */
/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
import { NO3Y_IPHONE } from "../../fork/no3yIphone";

// The iPhone draws the system font (SF Pro); markdown adds bold weights itself (EnrichedMarkdownText).
export const FONT_FAMILIES = NO3Y_IPHONE
  ? ({ regular: "System", medium: "System", bold: "System" } as const)
  : /* fork:end no3y-mobile-redesign */
    ({
      regular: "DMSans-Regular",
      medium: "DMSans-Medium",
      bold: "DMSans-Bold",
    } as const);

/* fork:begin no3y-mobile-interface-font — see .fork/customizations.yaml#no3y-mobile-interface-font */
/** The iPhone follows the font picked in Settings → Appearance; other devices keep FONT_FAMILIES. */
export const useFontFamilies: () => Readonly<Record<keyof typeof FONT_FAMILIES, string>> =
  NO3Y_IPHONE ? useNo3yFontFamilies : () => FONT_FAMILIES;

/** The native composer's face for UIFont(name:). */
export const useComposerFontFace: () => string = NO3Y_IPHONE
  ? useNo3yComposerFontFace
  : () => FONT_FAMILIES.regular;
/* fork:end no3y-mobile-interface-font */
