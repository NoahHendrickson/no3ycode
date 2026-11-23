/**
 * Old routes of what are now no3y Home tabs (a `chat` or `settings/scheduled-tasks` link): they
 * open the tab and leave — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 */
import { StackActions, useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { View } from "react-native";

import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { flatGlassPalette } from "./flatGlassTheme";
import { useNo3yBottomNavEnabled } from "./No3yBottomNav";
import { setNo3yHomeTabsEnabled, showNo3yHomeTab, type No3yHomeTab } from "./no3yHomeTabs";

export function No3yHomeTabRedirect(props: { readonly tab: No3yHomeTab }) {
  const navigation = useNavigation();
  const enabled = useNo3yBottomNavEnabled();
  const { themeAppearance } = useAppearancePreferences();
  const tab = props.tab;
  useEffect(() => {
    setNo3yHomeTabsEnabled(enabled);
    if (!showNo3yHomeTab(navigation, tab)) navigation.dispatch(StackActions.popTo("Home"));
  }, [enabled, navigation, tab]);
  return (
    <View style={{ flex: 1, backgroundColor: flatGlassPalette(themeAppearance).stageBackground }} />
  );
}

export function No3yChatLinkScreen() {
  return <No3yHomeTabRedirect tab="chat" />;
}
