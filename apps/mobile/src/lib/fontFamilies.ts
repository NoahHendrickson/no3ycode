import { Platform } from "react-native";

/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
// iOS draws the system font (SF Pro); markdown adds bold weights itself (EnrichedMarkdownText).
export const FONT_FAMILIES =
  Platform.OS === "ios"
    ? ({ regular: "System", medium: "System", bold: "System" } as const)
    : /* fork:end no3y-mobile-redesign */
      ({
        regular: "DMSans-Regular",
        medium: "DMSans-Medium",
        bold: "DMSans-Bold",
      } as const);
