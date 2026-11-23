/**
 * The static twin of useNo3yBottomNavEnabled for module scope and non-React code — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. The hook also rules out split view and Duo,
 * which an iPhone never has; iPad and Android keep upstream's look.
 */
import { Platform } from "react-native";

export const NO3Y_IPHONE = Platform.OS === "ios" && !Platform.isPad;
