/**
 * The Threads screen header (title, Settings and Usage buttons) and the thread bar's usage
 * ring and gauge — see `.fork/customizations.yaml#no3y-mobile-redesign`. The ring shows how much
 * of the thread's provider limit is left; both it and the gauge open Usage.
 */
import GaugeIcon from "@hugeicons/core-free-icons/GaugeIcon";
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon";
import { useNavigation } from "@react-navigation/native";
import type { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { collectProviderUsageLimits, remainingPercent } from "@t3tools/shared/usageLimits";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import { Toolbar } from "../src/components/ui/Toolbar";
import { useAdaptiveWorkspaceLayout } from "../src/features/layout/adaptive-workspace-context";
import { openSettings } from "../src/features/settings/settings-navigation";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { useServerConfigs } from "../src/state/entities";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import { useNo3yBottomNavEnabled } from "./No3yBottomNav";
import { No3yCircleButton, No3yUsageRing } from "./No3yControls";

function useOpenUsage() {
  const navigation = useNavigation();
  return () => openSettings(navigation, "SettingsUsage");
}

/** Replaces the native bar on Threads; the list lays out below it. */
export function No3yThreadsHeader() {
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { openWorkspaceTab } = useAdaptiveWorkspaceLayout();
  const openUsage = useOpenUsage();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: palette.stageBackground }}>
      <View
        style={{
          height: 68,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ fontFamily: NO3Y_FONT.medium, fontSize: 20, color: palette.foreground }}
        >
          Threads
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <No3yCircleButton
            palette={palette}
            accessibilityLabel="Settings"
            icon={Settings01Icon}
            onPress={() => openWorkspaceTab("settings")}
          />
          <No3yCircleButton
            palette={palette}
            accessibilityLabel="Usage"
            icon={GaugeIcon}
            onPress={openUsage}
          />
        </View>
      </View>
    </View>
  );
}

/** The share of the provider's tightest current limit that is left, or null when it reports none. */
function useProviderUsageRemaining(
  usage:
    | { readonly environmentId: EnvironmentId; readonly providerInstanceId: ProviderInstanceId }
    | undefined,
): number | null {
  const configs = useServerConfigs();
  const config = usage ? configs.get(usage.environmentId) : undefined;
  if (!config || !usage) return null;
  const instanceId = usage.providerInstanceId;
  const report = collectProviderUsageLimits(
    instanceId,
    config.providers,
    config.usageLimitSources ?? [],
    // `now` only stamps the report's createdAt, which the ring never reads.
    0,
  );
  const account =
    report?.accounts.find((candidate) => candidate.instanceId === instanceId) ??
    report?.accounts[0];
  const windows = account?.limits.windows ?? [];
  if (windows.length === 0) return null;
  return Math.min(...windows.map(remainingPercent));
}

/**
 * The thread bar's trailing items, as native bar items: the usage ring (when the provider
 * reports limits) over the bar's own glass circle, then the gauge. Undefined when off.
 */
export function useNo3yThreadHeaderTrailing(
  usage:
    | { readonly environmentId: EnvironmentId; readonly providerInstanceId: ProviderInstanceId }
    | undefined,
): ReactNode {
  const enabled = useNo3yBottomNavEnabled();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const remaining = useProviderUsageRemaining(usage);
  const openUsage = useOpenUsage();
  if (!enabled || usage === undefined) return undefined;
  return [
    remaining === null ? null : (
      <Toolbar.Custom key="no3y-usage-ring">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${remaining}% of usage left`}
          onPress={openUsage}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        >
          <No3yUsageRing palette={palette} remainingPercent={remaining} />
        </Pressable>
      </Toolbar.Custom>
    ),
    <Toolbar.Button
      key="no3y-usage"
      accessibilityLabel="Usage"
      icon="gauge.with.dots.needle.67percent"
      onPress={openUsage}
      separateBackground
    />,
  ];
}
