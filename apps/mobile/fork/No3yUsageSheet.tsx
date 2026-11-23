/**
 * The no3y usage sheet, sized to its content (`.fork/customizations.yaml#no3y-mobile-redesign`):
 * the Mac composer's usage drawer as one compact row per provider (its mark, then a 5hr / 7d bar
 * each with % left and reset), limit notices, usage links and a "See all usage" link.
 */
import Alert02Icon from "@hugeicons/core-free-icons/Alert02Icon";
import { useAtomValue } from "@effect/atom-react";
import { useNavigation } from "@react-navigation/native";
import {
  collectExternalUsageLinks,
  collectLimitAccounts,
  collectLimitPools,
  formatResetsIn,
  type LimitPool,
} from "@t3tools/shared/usageLimits";
import { useEffect, useEffectEvent, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../src/components/ui/AppText";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { openSettings } from "../src/features/settings/settings-navigation";
import { useRefreshLimits } from "../src/features/usage/UsageLimitsSection";
import { environmentPresentations } from "../src/state/presentation";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { No3yProviderMark } from "./No3yProviderMark";
import {
  actionableLimitNotices,
  compactTrayWindows,
  compactWindowLabel,
  fullWindowLabel,
  no3yUsageSheetState,
  usageBarTone,
} from "./no3yUsageCompact";

/** The Mac drawer's calmer green; amber and red keep the palette's. */
const CALM_GREEN = "#38a169";

export function No3yUsageSheet() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const limits = useRefreshLimits(null, true);
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  const pools = collectLimitPools(collectLimitAccounts(presentations), limits.now);
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
      style={{ backgroundColor: palette.stageBackground }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 24,
        paddingBottom: Math.max(insets.bottom, 16),
        gap: 14,
      }}
      showsVerticalScrollIndicator={false}
    >
      {state === "checking" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="small" color={palette.quietInk} />
          <Text style={{ fontSize: 14, color: palette.metaInk }}>Checking usage limits…</Text>
        </View>
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
        <ProviderRow key={pool.driver} pool={pool} now={limits.now} palette={palette} />
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
          style={{ marginLeft: "auto" }}
          onPress={() => {
            navigation.goBack();
            openSettings(navigation, "SettingsUsage");
          }}
        >
          <Text style={{ ...NO3Y_FONT.medium, fontSize: 13, color: palette.peekRing }}>
            See all usage
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ProviderRow(props: {
  readonly pool: LimitPool;
  readonly now: number;
  readonly palette: FlatGlassPalette;
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
          return (
            <View
              key={`${window.kind}:${window.id}`}
              accessible
              accessibilityLabel={`${fullWindowLabel(pool, window)}: ${window.remainingPercent}% left${resetsIn ? `, ${resetsIn}` : ""}`}
              style={{ flexGrow: 1, flexBasis: 110, gap: 4 }}
            >
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text
                  style={{ flex: 1, ...NO3Y_FONT.medium, fontSize: 12, color: palette.quietInk }}
                >
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
