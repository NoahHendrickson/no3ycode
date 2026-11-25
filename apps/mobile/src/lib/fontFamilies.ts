/* fork:begin no3y-mobile-interface-font — see .fork/customizations.yaml#no3y-mobile-interface-font */
import { useNo3yFontFamilies } from "../../fork/no3yInterfaceFont";
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
export function useFontFamilies(): Readonly<Record<keyof typeof FONT_FAMILIES, string>> {
  const picked = useNo3yFontFamilies();
  return NO3Y_IPHONE ? picked : FONT_FAMILIES;
}
/* fork:end no3y-mobile-interface-font */
