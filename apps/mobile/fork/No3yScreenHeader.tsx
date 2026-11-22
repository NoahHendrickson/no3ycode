/**
 * The Threads screen header (title, Settings and Usage buttons) and the thread bar's usage button
 * and ⋯ menu — see `.fork/customizations.yaml#no3y-mobile-redesign`. The usage buttons open the
 * half-height usage sheet; the ring shows how much of the thread's provider limit is left.
 */
import GaugeIcon from "@hugeicons/core-free-icons/GaugeIcon";
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon";
import { StackActions, useNavigation } from "@react-navigation/native";
import type { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { collectProviderUsageLimits, remainingPercent } from "@t3tools/shared/usageLimits";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import type { AppBarMenu } from "../src/components/ui/AppBar.types";
import { Toolbar } from "../src/components/ui/Toolbar";
import { useAdaptiveWorkspaceLayout } from "../src/features/layout/adaptive-workspace-context";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { NativeStackScreenOptions } from "../src/native/StackHeader";
import { useServerConfigs } from "../src/state/entities";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import { useNo3yBottomNavEnabled } from "./No3yBottomNav";
import { No3yCircleButton, No3yUsageRing } from "./No3yControls";

/** Opens the half-height usage sheet (fork/No3yUsageSheet.tsx). */
function useOpenUsage() {
  const navigation = useNavigation();
  return () => navigation.dispatch(StackActions.push("No3yUsage"));
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
          style={{ ...NO3Y_FONT.medium, fontSize: 20, color: palette.foreground }}
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

/** What the no3y thread bar shows: the usage button and the ⋯ menu that holds the rest. */
export interface No3yThreadBar {
  readonly trailing: ReactNode;
  readonly menus: ReadonlyArray<AppBarMenu>;
}

/**
 * The thread bar on the no3y iPhone layout: one usage button (the ring, or a gauge when the
 * provider reports no limits) opening the usage sheet, and a ⋯ menu with the subtitle's project,
 * environment and branch as info rows plus the git, terminal and files items the bar used to
 * carry. Undefined when off.
 */
export function useNo3yThreadBar(
  input:
    | {
        readonly environmentId: EnvironmentId;
        readonly providerInstanceId: ProviderInstanceId;
        readonly subtitle: string;
        readonly branch: string | null;
        readonly menus: ReadonlyArray<AppBarMenu | null>;
        readonly openFiles: (() => void) | null;
      }
    | undefined,
): No3yThreadBar | undefined {
  const enabled = useNo3yBottomNavEnabled();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const remaining = useProviderUsageRemaining(input);
  const openUsage = useOpenUsage();
  if (!enabled || input === undefined) return undefined;
  const info = [
    ...input.subtitle.split(" · ").filter((part) => part.length > 0),
    ...(input.branch ? [input.branch] : []),
  ];
  const more: AppBarMenu = {
    title: "Thread",
    icon: "ellipsis",
    items: [
      ...(info.length > 0
        ? [
            {
              id: "info",
              inline: true,
              items: info.map((line, index) => ({
                id: `info-${index}`,
                title: line,
                disabled: true,
                onPress: () => {},
              })),
            },
          ]
        : []),
      ...input.menus
        .filter((menu): menu is AppBarMenu => menu !== null)
        .map((menu) => ({ id: menu.title, title: menu.title, items: menu.items })),
      ...(input.openFiles
        ? [{ id: "files", title: "Files", icon: "folder", onPress: input.openFiles }]
        : []),
    ],
  };
  return {
    menus: [more],
    trailing:
      remaining === null ? (
        <Toolbar.Button
          accessibilityLabel="Usage"
          icon="gauge.with.dots.needle.67percent"
          onPress={openUsage}
          separateBackground
        />
      ) : (
        <Toolbar.Custom>
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
  };
}

/** The thread bar's title at the mocks' size: one 16pt Medium line, centred by UIKit. */
export function No3yThreadTitleStyle() {
  return (
    <NativeStackScreenOptions options={{ headerTitleStyle: { fontSize: 16, fontWeight: "500" } }} />
  );
}
