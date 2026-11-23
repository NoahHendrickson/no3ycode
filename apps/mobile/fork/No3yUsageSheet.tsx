/**
 * The no3y usage half sheet (`.fork/customizations.yaml#no3y-mobile-redesign`):
 * the Mac composer's usage drawer as one compact row per provider (its mark, then a 5hr / 7d bar
 * each with % left and reset), limit notices, usage links and a "See all usage" link.
 */
import Alert02Icon from "@hugeicons/core-free-icons/Alert02Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import { useAtomValue } from "@effect/atom-react";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import {
  collectExternalUsageLinks,
  collectLimitAccounts,
  collectLimitPools,
  formatResetsIn,
  type LimitPool,
} from "@t3tools/shared/usageLimits";
import { useEffect, useEffectEvent, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { openSettings } from "../src/features/settings/settings-navigation";
import { useRefreshLimits } from "../src/features/usage/UsageLimitsSection";
import { environmentPresentations } from "../src/state/presentation";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { no3ySheetBackground } from "./no3ySheet";
import { HugeIcon } from "./HugeIcon";
import { NO3Y_FADE_IN, NO3Y_FADE_OUT } from "./no3yMotion";
import { No3yProviderMark } from "./No3yProviderMark";
import {
  actionableLimitNotices,
  bindingPoolWindow,
  compactTrayWindows,
  compactWindowLabel,
  fullWindowLabel,
  no3yUsageSheetState,
  usageBarTone,
} from "./no3yUsageCompact";

/** The Mac drawer's calmer green; amber and red keep the palette's. */
const CALM_GREEN = "#38a169";

export function No3yUsageSheet(props: StaticScreenProps<{ readonly driver?: string } | undefined>) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const limits = useRefreshLimits(null, true);
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  // A thread's ring opens the sheet with its provider first, its binding window marked.
  const threadDriver = props.route.params?.driver;
  const pools = [...collectLimitPools(collectLimitAccounts(presentations), limits.now)].sort(
    (left, right) => Number(right.driver === threadDriver) - Number(left.driver === threadDriver),
  );
  const notices = actionableLimitNotices(presentations);
  const externalLinks = collectExternalUsageLinks(presentations);
  const failed = limits.failedLabels;
  const connected = [...presentations.values()].filter(
    (presentation) => presentation.connection.phase === "connected",
  ).length;
  // Opening the sheet asks every connected machine for fresh limits, so it never shows a stale
  // or never-fetched empty state; the spinner shows until that answer lands.
  const [checked, setChecked] = useState(false);
  const refreshOnOpen = useEffectEvent(() => {
    void limits.refresh().finally(() => setChecked(true));
  });
  useEffect(() => refreshOnOpen(), []);
  const state = no3yUsageSheetState({
    connected,
    checked,
    pools: pools.length,
    notices: notices.length + failed.length,
    links: externalLinks.length,
  });
  const muted = { fontSize: 12, color: palette.metaInk } as const;
  return (
    <ScrollView
      style={{ backgroundColor: no3ySheetBackground(palette.stageBackground) }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        // 24pt clear of the grabber, which sits in the sheet's top 12pt, and of the rounded bottom.
        paddingTop: 36,
        paddingBottom: insets.bottom + 24,
        gap: 14,
      }}
      showsVerticalScrollIndicator={false}
    >
      {state === "checking" ? (
        <Animated.View
          exiting={NO3Y_FADE_OUT}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <ActivityIndicator size="small" color={palette.quietInk} />
          <Text style={{ fontSize: 14, color: palette.metaInk }}>Checking usage limits…</Text>
        </Animated.View>
      ) : state === "offline" ? (
        <Text style={{ fontSize: 14, color: palette.metaInk }}>
          Connect to an environment to see its usage limits.
        </Text>
      ) : state === "empty" ? (
        <Text style={{ fontSize: 14, color: palette.metaInk }}>
          No provider on your connected environments reports subscription limits.
        </Text>
      ) : null}
      {pools.map((pool) => (
        <Animated.View key={pool.driver} entering={NO3Y_FADE_IN}>
          <ProviderRow
            pool={pool}
            now={limits.now}
            palette={palette}
            bindingId={pool.driver === threadDriver ? (bindingPoolWindow(pool)?.id ?? null) : null}
          />
        </Animated.View>
      ))}
      {[...notices, ...failed.map((label) => `${label}: could not refresh limits`)].map(
        (notice) => (
          <View key={notice} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <HugeIcon icon={Alert02Icon} size={14} color={palette.statusAttention} />
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 13, color: palette.quietInk }}>
              {notice}
            </Text>
          </View>
        ),
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
        {externalLinks.map((link) => (
          <Pressable
            key={link.url}
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => void Linking.openURL(link.url).catch(() => undefined)}
          >
            <Text style={muted}>{`${link.label} ↗`}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="See all usage"
          hitSlop={8}
          style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 2 }}
          onPress={() => {
            navigation.goBack();
            openSettings(navigation, "SettingsUsage");
          }}
        >
          <Text style={{ ...NO3Y_FONT.medium, fontSize: 13, color: palette.foreground }}>
            See all usage
          </Text>
          <HugeIcon icon={ArrowRight01Icon} size={14} color={palette.foreground} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ProviderRow(props: {
  readonly pool: LimitPool;
  readonly now: number;
  readonly palette: FlatGlassPalette;
  /** The window that will interrupt the thread first, marked with a dot. */
  readonly bindingId: string | null;
}) {
  const { pool, palette } = props;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingBottom: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.hairline,
      }}
    >
      <View style={{ paddingTop: 1 }}>
        <No3yProviderMark provider={pool.driver} size={18} />
      </View>
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {compactTrayWindows(pool).map((window) => {
          const reset =
            window.resets.find((entry) => entry.restoresPercent > 0) ?? window.resets[0];
          const resetsIn = reset ? formatResetsIn(reset.member.window, props.now) : null;
          const tone = usageBarTone(window.remainingPercent);
          const fill =
            tone === "good"
              ? CALM_GREEN
              : tone === "low"
                ? palette.statusAttention
                : palette.statusFailed;
          const binding = window.id === props.bindingId;
          return (
            <View
              key={`${window.kind}:${window.id}`}
              accessible
              accessibilityLabel={`${fullWindowLabel(pool, window)}: ${window.remainingPercent}% left${resetsIn ? `, ${resetsIn}` : ""}${binding ? ", the limit this thread hits first" : ""}`}
              style={{ flexGrow: 1, flexBasis: 110, gap: 4 }}
            >
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text
                  style={{
                    flex: 1,
                    ...NO3Y_FONT.medium,
                    fontSize: 12,
                    color: binding ? palette.foreground : palette.quietInk,
                  }}
                >
                  {binding ? "● " : ""}
                  {compactWindowLabel(pool, window)}
                </Text>
                <Text
                  style={{
                    ...NO3Y_FONT.medium,
                    fontSize: 12,
                    fontVariant: ["tabular-nums"],
                    color: palette.foreground,
                  }}
                >
                  {`${window.remainingPercent}%`}
                </Text>
              </View>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  overflow: "hidden",
                  backgroundColor: palette.usageRingTrack,
                }}
              >
                <View
                  style={{
                    width: `${Math.max(0, Math.min(100, window.remainingPercent))}%`,
                    height: 4,
                    backgroundColor: fill,
                  }}
                />
              </View>
              {resetsIn ? (
                <Text numberOfLines={1} style={{ fontSize: 11, color: palette.metaInk }}>
                  {resetsIn.charAt(0).toUpperCase() + resetsIn.slice(1)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
