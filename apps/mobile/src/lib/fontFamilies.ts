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
