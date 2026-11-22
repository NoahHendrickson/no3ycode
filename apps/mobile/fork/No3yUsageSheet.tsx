/**
 * The half-height usage sheet the no3y usage buttons open — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. It embeds Settings › Usage's limits section
 * and its refresh, and links to the full page for cost and tokens.
 */
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import { useNavigation } from "@react-navigation/native";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import { RefreshControl } from "../src/components/ui/RefreshControl";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { openSettings } from "../src/features/settings/settings-navigation";
import { UsageLimitsSection } from "../src/features/usage/UsageLimitsPooled";
import { useRefreshLimits } from "../src/features/usage/UsageLimitsSection";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import { No3yCircleButton } from "./No3yControls";

export function No3yUsageSheet() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const limits = useRefreshLimits(null, true);
  const close = () => navigation.goBack();
  return (
    <View style={{ flex: 1, backgroundColor: palette.stageBackground }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        <No3yCircleButton
          palette={palette}
          accessibilityLabel="Close"
          icon={Cancel01Icon}
          onPress={close}
        />
        <Text
          accessibilityRole="header"
          style={{ flex: 1, ...NO3Y_FONT.medium, fontSize: 16, color: palette.foreground }}
        >
          Usage
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="See all usage"
          hitSlop={8}
          onPress={() => {
            close();
            openSettings(navigation, "SettingsUsage");
          }}
        >
          <Text style={{ ...NO3Y_FONT.medium, fontSize: 14, color: palette.peekRing }}>
            See all
          </Text>
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={limits.refreshing} onRefresh={() => void limits.refresh()} />
        }
      >
        <UsageLimitsSection
          now={limits.now}
          failedLabels={limits.failedLabels}
          selectedEnvironmentIds={null}
        />
      </ScrollView>
    </View>
  );
}
