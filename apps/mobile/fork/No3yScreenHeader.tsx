/**
 * The Threads, Chat and New agent headers (title; 44pt glass buttons) and the thread bar's usage button
 * and ⋯ menu — see `.fork/customizations.yaml#no3y-mobile-redesign`. The usage buttons open the
 * half-height usage sheet; the ring shows how much of the thread's provider limit is left.
 */
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import GaugeIcon from "@hugeicons/core-free-icons/GaugeIcon";
import GitPullRequestIcon from "@hugeicons/core-free-icons/GitPullRequestIcon";
import MoreHorizontalIcon from "@hugeicons/core-free-icons/MoreHorizontalIcon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon";
import XIcon from "@hugeicons/core-free-icons/XIcon";
import { useAtomMount } from "@effect/atom-react";
import type { MenuAction } from "@react-native-menu/menu";
import { HeaderHeightContext } from "@react-navigation/elements";
import { StackActions, useNavigation } from "@react-navigation/native";
import type { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { collectProviderUsageLimits, remainingPercent } from "@t3tools/shared/usageLimits";
import { Atom } from "effect/reactivity";
import { useId, type ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { AppText as Text } from "../src/components/ui/AppText";
import type { AppBarMenu, AppBarMenuItem } from "../src/components/ui/AppBar.types";
import { Menu } from "../src/components/ui/Menu";
import { useAdaptiveWorkspaceLayout } from "../src/features/layout/adaptive-workspace-context";
import { limitsAutoRefreshSetAtom } from "../src/features/usage/usageLimitsRefresh";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { NativeStackScreenOptions } from "../src/native/StackHeader";
import { useServerConfigs } from "../src/state/entities";
import { flatGlassPalette, NO3Y_CONTROL_SIZE, NO3Y_FONT } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { No3yGlassLayer } from "./No3yGlass";
import { useNo3yBottomNavEnabled } from "./No3yBottomNav";
import { No3yCircleButton, No3yUsageRing } from "./No3yControls";
import { useLendNo3yWorkspaceTabSelect } from "./no3yWorkspaceTabs";

/** Opens the half-height usage sheet (fork/No3yUsageSheet.tsx). */
function useOpenUsage() {
  const navigation = useNavigation();
  return () => navigation.dispatch(StackActions.push("No3yUsage"));
}

/**
 * A workspace screen's header in place of the native bar: the title at Medium 20 and its 44pt
 * glass buttons on the right, or a search pill across the row. Content lays out below it.
 */
function No3yPageHeader(props: {
  readonly title: string;
  readonly search?: ReactNode;
  readonly children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: palette.stageBackground }}>
      <View
        style={{
          height: 68,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {props.search ?? (
          <Text
            accessibilityRole="header"
            style={{ ...NO3Y_FONT.medium, fontSize: 20, color: palette.foreground }}
          >
            {props.title}
          </Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{props.children}</View>
      </View>
    </View>
  );
}

/** Replaces the native bar on Threads; the list lays out below it. */
export function No3yThreadsHeader() {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { openWorkspaceTab } = useAdaptiveWorkspaceLayout();
  // openWorkspaceTab alone resets the stack but leaves Home on Threads; this also selects the tab.
  const selectTab = useLendNo3yWorkspaceTabSelect();
  const openUsage = useOpenUsage();
  return (
    <No3yPageHeader title="Threads">
      <No3yCircleButton
        palette={palette}
        accessibilityLabel="Pull requests"
        icon={GitPullRequestIcon}
        onPress={() => selectTab("pullRequests")}
      />
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
    </No3yPageHeader>
  );
}

export interface No3yHeaderSearch {
  readonly searching: boolean;
  readonly searchQuery: string;
  readonly onSearchingChange: (searching: boolean) => void;
  readonly onSearchQueryChange: (query: string) => void;
}

/**
 * A page header with a Search button and no native bar. Search turns the row into a search pill
 * with a close button, which clears the search; `children` are the buttons after Search.
 */
function No3ySearchHeader(
  props: No3yHeaderSearch & {
    readonly title: string;
    readonly subject: string;
    readonly children?: ReactNode;
  },
) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const search = props.searching ? (
    <View
      style={{
        flex: 1,
        height: NO3Y_CONTROL_SIZE,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
      }}
    >
      <No3yGlassLayer radius={NO3Y_CONTROL_SIZE / 2} />
      <HugeIcon icon={Search01Icon} size={20} color={palette.foreground} filled />
      <TextInput
        accessibilityLabel={`Search ${props.subject}`}
        value={props.searchQuery}
        onChangeText={props.onSearchQueryChange}
        placeholder={`Search ${props.subject}`}
        placeholderTextColor={palette.faintInk}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={{
          flex: 1,
          ...NO3Y_FONT.regular,
          fontSize: 14,
          color: palette.foreground,
          paddingVertical: 0,
        }}
      />
    </View>
  ) : undefined;
  return (
    <>
      <NativeStackScreenOptions options={{ headerShown: false }} />
      <No3yPageHeader title={props.title} search={search}>
        {props.searching ? (
          <No3yCircleButton
            palette={palette}
            accessibilityLabel={`Close ${props.subject} search`}
            icon={XIcon}
            onPress={() => {
              props.onSearchQueryChange("");
              props.onSearchingChange(false);
            }}
          />
        ) : (
          <>
            <No3yCircleButton
              palette={palette}
              accessibilityLabel={`Search ${props.subject}`}
              icon={Search01Icon}
              onPress={() => props.onSearchingChange(true)}
            />
            {props.children}
          </>
        )}
      </No3yPageHeader>
    </>
  );
}

/** Chat's header, Threads' shape: Search, Settings and Usage. */
export function No3yChatHeader(props: No3yHeaderSearch) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { openWorkspaceTab } = useAdaptiveWorkspaceLayout();
  const openUsage = useOpenUsage();
  return (
    <No3ySearchHeader {...props} title="Chat" subject="chats">
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
    </No3ySearchHeader>
  );
}

/** New agent's header: its title and Search, which narrows the project tiles. */
export function No3yNewAgentHeader(props: No3yHeaderSearch) {
  return <No3ySearchHeader {...props} title="New agent" subject="projects" />;
}

const IDLE_ATOM = Atom.make(undefined);

/** The share of the provider's tightest current limit that is left, or null when it reports none. */
function useProviderUsageRemaining(
  usage:
    | { readonly environmentId: EnvironmentId; readonly providerInstanceId: ProviderInstanceId }
    | undefined,
): number | null {
  const configs = useServerConfigs();
  // The ring reads limits nothing else may have fetched: keep them fresh (throttled per machine).
  useAtomMount(usage ? limitsAutoRefreshSetAtom(String(usage.environmentId)) : IDLE_ATOM);
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
  readonly menu: AppBarMenu;
  /** The provider's remaining limit, or null when it reports none (the bar shows a gauge). */
  readonly remaining: number | null;
  readonly openUsage: () => void;
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
  const remaining = useProviderUsageRemaining(input);
  const openUsage = useOpenUsage();
  if (!enabled || input === undefined) return undefined;
  const info = [
    ...input.subtitle.split(" · ").filter((part) => part.length > 0),
    ...(input.branch ? [input.branch] : []),
  ];
  const menu: AppBarMenu = {
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
        .filter((candidate): candidate is AppBarMenu => candidate !== null)
        .map((candidate) => ({
          id: candidate.title,
          title: candidate.title,
          items: candidate.items,
        })),
      ...(input.openFiles
        ? [{ id: "files", title: "Files", icon: "folder", onPress: input.openFiles }]
        : []),
    ],
  };
  return { menu, remaining, openUsage };
}

/** The floating row's height under the status bar: 44pt bubbles with 8pt above and below. */
const THREAD_BAR_ROW = 60;
const BUBBLE = NO3Y_CONTROL_SIZE;
/** How far the top fade reaches below the bubbles. */
const TOP_FADE_TAIL = 16;

/** Where content under the floating thread bar starts: the status bar plus the bubble row. */
function useNo3yThreadBarInset(): number {
  return useSafeAreaInsets().top + THREAD_BAR_ROW;
}

/**
 * Gives the thread screen's body the floating bar's height as its header height, so the
 * transcript starts below the bubbles and still scrolls under them. A draft lays New agent's
 * header out above its body, so its body starts at its own top.
 */
export function No3yThreadBarInset(props: {
  readonly draft: boolean;
  readonly children: ReactNode;
}) {
  const enabled = useNo3yBottomNavEnabled();
  const inset = useNo3yThreadBarInset();
  if (!enabled) return props.children;
  return (
    <HeaderHeightContext value={props.draft ? 0 : inset}>{props.children}</HeaderHeightContext>
  );
}

/** An AppBar menu as native menu actions, for the fork's own glass header buttons. */
export function menuActions(items: ReadonlyArray<AppBarMenuItem>): MenuAction[] {
  return items.map((item) =>
    "items" in item
      ? {
          id: item.id,
          title: item.title ?? "",
          ...(item.icon ? { image: item.icon } : {}),
          displayInline: item.inline === true,
          subactions: menuActions(item.items),
        }
      : {
          id: item.id,
          title: item.title,
          ...(item.subtitle ? { subtitle: item.subtitle } : {}),
          ...(item.icon ? { image: item.icon } : {}),
          ...(item.selected ? { state: "on" as const } : {}),
          attributes: { disabled: item.disabled === true, destructive: item.destructive === true },
        },
  );
}

export function findMenuItem(
  items: ReadonlyArray<AppBarMenuItem>,
  id: string,
): (() => void) | null {
  for (const item of items) {
    if ("items" in item) {
      const found = findMenuItem(item.items, id);
      if (found) return found;
    } else if (item.id === id) {
      return item.onPress;
    }
  }
  return null;
}

/**
 * The no3y thread bar: no native bar, three glass bubbles floating over the transcript (back, the
 * title in its own pill, usage and ⋯) above a fade from the page colour. iPhone iOS 27 scrolls the
 * content to the top on any tap in a UINavigationBar, buttons included; with no bar it can't.
 */
export function No3yThreadHeader(props: {
  readonly title: string;
  readonly onBack: () => void;
  readonly bar: No3yThreadBar;
}) {
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const fadeId = `no3y-top-fade-${useId().replace(/[^\w-]/g, "")}`;
  const height = useNo3yThreadBarInset() + TOP_FADE_TAIL;
  const { menu, remaining, openUsage } = props.bar;
  return (
    <>
      <NativeStackScreenOptions options={{ headerShown: false }} />
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 40 }}
      >
        <Svg
          width="100%"
          height={height}
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0 }}
        >
          <Defs>
            <LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.stageBackground} stopOpacity={1} />
              <Stop
                offset={String(insets.top / height)}
                stopColor={palette.stageBackground}
                stopOpacity={0.92}
              />
              <Stop offset="1" stopColor={palette.stageBackground} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${fadeId})`} />
        </Svg>
        <View
          pointerEvents="box-none"
          style={{
            marginTop: insets.top,
            height: THREAD_BAR_ROW,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <No3yCircleButton
            palette={palette}
            accessibilityLabel="Back"
            icon={ArrowLeft01Icon}
            onPress={props.onBack}
          />
          <View pointerEvents="box-none" style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
            <View style={{ maxWidth: "100%", height: BUBBLE, justifyContent: "center" }}>
              <No3yGlassLayer radius={BUBBLE / 2} />
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={{
                  paddingHorizontal: 16,
                  ...NO3Y_FONT.medium,
                  fontSize: 16,
                  color: palette.titleInk,
                }}
              >
                {props.title}
              </Text>
            </View>
          </View>
          <View style={{ height: BUBBLE, flexDirection: "row", alignItems: "center" }}>
            <No3yGlassLayer radius={BUBBLE / 2} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={remaining === null ? "Usage" : `${remaining}% of usage left`}
              onPress={openUsage}
              style={({ pressed }) => ({
                width: BUBBLE,
                height: BUBBLE,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              {remaining === null ? (
                <HugeIcon icon={GaugeIcon} size={20} color={palette.foreground} filled />
              ) : (
                <No3yUsageRing palette={palette} remainingPercent={remaining} />
              )}
            </Pressable>
            <Menu
              accessibilityLabel={menu.title}
              actions={menuActions(menu.items)}
              onPressAction={({ nativeEvent }) => findMenuItem(menu.items, nativeEvent.event)?.()}
            >
              <View
                accessibilityRole="button"
                accessibilityLabel={menu.title}
                style={{
                  width: BUBBLE,
                  height: BUBBLE,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <HugeIcon icon={MoreHorizontalIcon} size={20} color={palette.foreground} />
              </View>
            </Menu>
          </View>
        </View>
      </View>
    </>
  );
}

/** The thread bar's title at the mocks' size: one 16pt Medium line, centred by UIKit. */
export function No3yThreadTitleStyle() {
  return (
    <NativeStackScreenOptions options={{ headerTitleStyle: { fontSize: 16, fontWeight: "500" } }} />
  );
}
