import { useGT } from "gt-react-native";
import { Platform } from "react-native";
import { AndroidNavigationAppearanceSection } from "./appearance/sections/AndroidNavigationAppearanceSection";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SettingsScreen } from "./components/SettingsScreen";
import { CodeAppearanceSection } from "./appearance/sections/CodeAppearanceSection";
import { TerminalAppearanceSection } from "./appearance/sections/TerminalAppearanceSection";
import { TextAppearanceSection } from "./appearance/sections/TextAppearanceSection";
import { ThemeAppearanceSection } from "./appearance/sections/ThemeAppearanceSection";
import { ToolCallsAppearanceSection } from "./appearance/sections/ToolCallsAppearanceSection";
/* fork:begin no3y-mobile-interface-font — see .fork/customizations.yaml#no3y-mobile-interface-font */
import { No3yInterfaceFontSection } from "../../../fork/No3yInterfaceFontSection";
import { NO3Y_IPHONE } from "../../../fork/no3yIphone";
/* fork:end no3y-mobile-interface-font */

export function SettingsAppearanceRouteScreen() {
  const gt = useGT();
  const insets = useSafeAreaInsets();

  return (
    <SettingsScreen title={gt("Appearance")}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pt-4"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 18) + 18,
        }}
      >
        <ThemeAppearanceSection />
        {Platform.OS === "android" ? <AndroidNavigationAppearanceSection /> : null}
        {/* fork:begin no3y-mobile-interface-font — see .fork/customizations.yaml#no3y-mobile-interface-font */}
        {NO3Y_IPHONE ? <No3yInterfaceFontSection /> : null}
        {/* fork:end no3y-mobile-interface-font */}
        <TextAppearanceSection />
        <TerminalAppearanceSection />
        <CodeAppearanceSection />
        <ToolCallsAppearanceSection />
      </ScrollView>
    </SettingsScreen>
  );
}
