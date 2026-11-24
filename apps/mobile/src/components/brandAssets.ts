import Constants from "expo-constants";

const appVariant = Constants.expoConfig?.extra?.appVariant;

/* fork:begin fork-brand-name — see .fork/customizations.yaml#fork-brand-name */
// The no3y flower tile, orange for development like the installed dev app.
export const T3_CODE_BRAND_MARK_SOURCE =
  appVariant === "development"
    ? require("../../../../assets/fork/n3-dev-web-apple-touch-180.png")
    : require("../../../../assets/fork/n3-web-apple-touch-180.png");
/* fork:end fork-brand-name */
